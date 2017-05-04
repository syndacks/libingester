'use strict';

const libingester = require('libingester');
const mustache = require('mustache');
const rp = require('request-promise');
const template = require('./word_of_day_template');
const url = require('url');
const home_page = 'http://www.thefreedictionary.com/_/archive.htm'; // Home section

function ingest_article_profile(hatch, uri) {
    return libingester.util.fetch_html(uri).then(($profile) => {
        const base_uri = libingester.util.get_doc_base_uri($profile, uri);

        const asset = new libingester.NewsArticle();
        asset.set_canonical_uri(uri);

        // Use 'url' module to pull out query string date object
        const parts = url.parse(uri, true);
        const modified_date = new Date(Date.parse(parts.query.d));
        asset.set_last_modified_date(modified_date);

        // Set date and title section
        const date = parts.query.d;
        const title = $profile('h1').first().text() + ": " + date;

        // Pluck wordOfDay
        const wordOfDay = $profile('table.widget', 'div#colleft').first().find('h3').children().text();
        asset.set_title(wordOfDay);

        // Pluck wordOfDayDef
        const wordOfDayMixedString = $profile('td:contains("Definition:")').next().text();
        const wordOfDayDef = wordOfDayMixedString.slice(wordOfDayMixedString.indexOf(" ")).trim();
        if(wordOfDayDef){
          asset.set_synopsis(wordOfDayDef);
        }

        // Pluck wordOfDayType
        const wordTypeBlob = wordOfDayMixedString.split(" ")[0];
        const wordOfDayType = wordTypeBlob.substr(1, wordTypeBlob.length-2);
        asset.set_license(wordOfDayType);

        const content = mustache.render(template.structure_template, {
            title: title,
            date: date,

            wordOfDay: wordOfDay,
            wordOfDayType: wordOfDayType,
            wordOfDayDef: wordOfDayDef,
        });

        asset.set_document(content);
        asset.set_section("word_of_day");

        hatch.save_asset(asset);
    });
}

function main() {
    const hatch = new libingester.Hatch();
    libingester.util.fetch_html(home_page).then(($pages) => {
        const articles_links = $pages('#Calendar div:nth-child(-2n+2) a').map(function() {
            const uri = $pages(this).attr('href');
            return url.resolve(home_page, uri);
        }).get();

        Promise.all(articles_links.map((uri) => ingest_article_profile(hatch, uri)))
        .catch(err => console.log(err.stack)).then(() => {
            return hatch.finish();
        });
    });
}

main();
