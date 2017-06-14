'use strict';

const libingester = require('libingester');
const mustache = require('mustache');
const rp = require('request-promise');
const template = require('./quote_of_day_template');
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
        const modifiedDate = new Date(Date.parse(articleDate));
        asset.set_last_modified_date(modifiedDate);

        // Set title
        const title = $profile('h1').first().text() + ": " + articleDate;

        // Pluck quoteAuthor
        const quoteAuthor = $profile('table.widget', 'div#colleft').last().find('p').text();
        asset.set_title(quoteAuthor);

        // Pluck quoteText
        const quoteText = $profile('table.widget', 'div#colleft').last().find('span').text();
        asset.set_synopsis(quoteText);

        const content = mustache.render(template.structure_template, {
            title: title,
            articleDate: articleDate,

            quoteText: quoteText,
            quoteAuthor: quoteAuthor
        });

        // TODO: Convert to v2.0 API
        asset.set_document(content);
        asset.set_section("quote_of_the_day");

        hatch.save_asset(asset);
    })
    .catch(err => {
        console.error(err.stack);
        throw err;
    });
}

function main() {
    const hatch = new libingester.Hatch('quote_of_day', 'en');
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
