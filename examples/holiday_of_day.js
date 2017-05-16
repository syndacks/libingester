'use strict';

const libingester = require('libingester');
const mustache = require('mustache');
const rp = require('request-promise');
const template = require('./holiday_of_day_template');
const url = require('url');

const HOMEPAGE = 'http://www.thefreedictionary.com/_/archive.htm'; // Home section

function ingestArticleProfile(hatch, uri) {
    return libingester.util.fetch_html(uri).then(($profile) => {
        const baseUri = libingester.util.get_doc_base_uri($profile, uri);

        const asset = new libingester.NewsArticle();
        asset.set_canonical_uri(uri);

        // Use 'url' module to pull out query string date object
        const parts = url.parse(uri, true);
        const articleDate = parts.query.d;
        const modified_date = new Date(Date.parse(articleDate));
        asset.set_last_modified_date(modified_date);

        // Set title
        const title = $profile('h1').first().text() + ": " + articleDate;

        // // Pluck todaysHolidayBlob
        const todaysHolidayBlob = $profile('tr:contains("Today\'s Holiday")').next().text();

        // Pluck todaysHolidayYearFinal
        const reHoliday = /\(([0-9]){4}\)/g;
        const todaysHolidayYear = reHoliday.exec(todaysHolidayBlob)[0];
        const todaysHolidayYearFinal = todaysHolidayYear.slice(1,5);
        asset.set_license(todaysHolidayYearFinal);

        // Pluck todaysHolidayHead
        const todaysHolidayHead = todaysHolidayBlob.split(todaysHolidayYear)[0];
        const todaysHolidayHeadFinal = todaysHolidayHead.trim();
        asset.set_title(todaysHolidayHeadFinal);

        // Pluck todaysHolidayBody
        const todaysHolidayBody = todaysHolidayBlob.split(todaysHolidayYear)[1];
        const todaysHolidayBodyFinal = todaysHolidayBody.split("\tMore...")[0].trim();
        asset.set_synopsis(todaysHolidayBodyFinal);

        const content = mustache.render(template.structure_template, {
            title: title,
            articleDate: articleDate,

            todaysHolidayHead: todaysHolidayHead,
            todaysHolidayBody: todaysHolidayBodyFinal,
            todaysHolidayYear: todaysHolidayYearFinal
        });

        asset.set_document(content);
        asset.set_section("holiday_of_day");

        hatch.save_asset(asset);
    });
}

function main() {
    const hatch = new libingester.Hatch();
    // make request to the index (home) page
    libingester.util.fetch_html(HOMEPAGE).then(($pages) => {
      // retrieve article URLs; '-2n+2' returns ~30 articles instead of 2,000+
        const articles_links = $pages('#Calendar div:nth-child(-2n+2) a').map(function() {
            const uri = $pages(this).attr('href');
            return url.resolve(HOMEPAGE, uri);
        }).get();

        Promise.all(articles_links.map((uri) => ingestArticleProfile(hatch, uri)))
        .catch(err => console.log(err.stack)).then(() => {
            return hatch.finish();
        });
    });
}

main();
