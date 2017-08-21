
'use strict';

const url = require('url');
const libingester = require('libingester');

const HOMEPAGE = 'http://www.thefreedictionary.com/_/archive.htm'; // Home section


function ingest_article(hatch, item) {
    return libingester.util.fetch_html(item).then($ => {
        const asset = new libingester.DictionaryAsset();

        // Use 'url' module to pull out query string date object
        const parts = url.parse(item, true);
        const articleDate = parts.query.d;
        const modifiedDate = new Date(Date.parse(articleDate));

        // Set title
        const title = "Word of the Day: " + articleDate;
        asset.set_title(title);

        // Pluck wordOfDay
        const wordOfDay = $('table.widget', 'div#colleft').first().find('h3').children().text();
        asset.set_word(wordOfDay);

        // Pluck wordOfDayDef
        const wordOfDayMixedString = $('td:contains("Definition:")').next().text();
        const wordOfDayDef = wordOfDayMixedString.slice(wordOfDayMixedString.indexOf(" ")).trim();
        asset.set_word_definition(wordOfDayDef);

        // Pluck wordOfDayType
        const wordTypeBlob = wordOfDayMixedString.split(" ")[0];
        const wordOfDayType = wordTypeBlob.substr(1, wordTypeBlob.length-2);
        asset.set_part_of_speech(wordOfDayType);

        // article settings
        asset.set_canonical_uri(item);
        asset.set_last_modified_date(modifiedDate);
        asset.set_source("thefreedictionary.com");
        asset.set_tags('word_of_day');
        asset.set_body(wordOfDayDef);
        asset.set_custom_scss(`
          $primary-light-color: #898989;
          $primary-dark-color: #383838;
          $accent-light-color: #FFB90C;
          $accent-dark-color: #DB9003;
          $background-light-color: #F0F0F0;
          $background-dark-color: #EBEBEB;
          $title-font: 'Signika Bold';
          $body-font: 'Signika';
          $context-font: 'Signika Medium';
          $support-font: 'Signika Medium';
          @import '_default';
        `);

        // lede and read_more are set to empty strings to avoid errors
        const lede = "";
        asset.set_lede(lede);

        const read_more = "";
        asset.set_read_more_link(read_more);

        asset.render();
        hatch.save_asset(asset);
    }).catch(err => {
      console.log(err.stack);
      throw err;
    });
}

function main() {
    const hatch = new libingester.Hatch('word_of_day', 'en');
    libingester.util.fetch_html(HOMEPAGE).then(($pages) => {
      // retrieve article URLs; '-2n+2' returns ~30 articles instead of 2,000+
      //                        '-n+28' returns ~901 articles
            const articles_links = $pages('#Calendar div:nth-child(-2n + 2) a').map(function() {
            const uri = $pages(this).attr('href');
            return url.resolve(HOMEPAGE, uri);
        }).get();

        Promise.all(articles_links.map((uri) => ingest_article(hatch, uri))).then(() => {
            return hatch.finish();
        }).catch(console.log);
    });
}

main();
