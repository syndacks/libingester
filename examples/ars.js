'use strict';

// Ars Technica, Open Source tag example

const Libingester = require('libingester');
const thenifyAll = require('thenify-all');
const RssToJson = thenifyAll(require('rss-to-json'), {}, ['load']);
const fs = thenifyAll(require('fs'), {}, ['writeFile']);

const FEED_URI = 'http://feeds.arstechnica.com/arstechnica/open-source';
const COMMENT_NODE = 8;

function remove_intermediate($, selector) {
    $(selector).each((i, elem) => $(elem).replaceWith($(elem).contents()));
}

function ingest_article(hatch, entry) {
    return Libingester.util.fetch_html(entry.url).then($ => {
        const BASE_URI = Libingester.util.get_doc_base_uri($, entry.url);
        let asset = new Libingester.NewsArticle();

        console.log('processing', entry.title);
        asset.set_title(entry.title);
        asset.set_synopsis(entry.description);
        asset.set_date_published(entry.created);
        asset.set_last_modified_date(new Date(entry.created));
        asset.set_source('Ars Technica');
        asset.set_license('Proprietary');
        asset.set_section('open-source');
        asset.set_custom_scss(`
            $body-font: Lato;
            $title-font: Raleway;
            $primary-light-color: #729fcf;
            $primary-dark-color: #204a87;
            $accent-light-color: #8ae234;
            $accent-dark-color: #4e9a06;
            $background-light-color: #eeeefc;
            $background-dark-color: #888a95;
            @import '_default';
        `);

        let canonical_uri = $('head link[rel="canonical"]').attr('href');
        asset.set_canonical_uri(canonical_uri);
        asset.set_read_more_link(`Read more at <a href="${canonical_uri}">Ars Technica</a>`);

        let thumb_uri = $('meta[property="og:image"]').attr('content');
        let thumb_asset = Libingester.util.download_image(thumb_uri);
        hatch.save_asset(thumb_asset);
        asset.set_thumbnail(thumb_asset);

        // Clean up
        $('div').filter(function () {
            return $(this).text().trim() === '';
        }).remove();
        $('head, script, .site-header, .ad, #social-left').remove();
        ['.site-wrapper', '.content-wrapper', '.column-wrapper', '.left-column',
            '.article-content'].forEach(sel => remove_intermediate($, sel));
        $('.page-numbers').remove();  // oops, should deal with multiple pages
        $(`.story-sidebar, .enlarge-link, .post-upperdek, .article-author,
            #social-footer, #article-footer-wrap, .site-footer, .tools-info,
            #promoted-comments`).remove();
        $('*').contents().each(function () {
            if(this.nodeType === COMMENT_NODE) {
                $(this).remove();
            }
        });

        let authors = $('header [itemprop~="author"] [itemprop~="name"]')
            .map((i, elem) => $(elem).text())
            .get();
        asset.set_authors(authors);
        $('header').remove();

        let main_candidates = $('figure.intro-image');
        if (!main_candidates.length)
            main_candidates = $('figure');
        if (main_candidates.length) {
            let main = main_candidates.first();
            let img = $('img', main);
            let img_asset = Libingester.util.download_img(img, BASE_URI);
            hatch.save_asset(img_asset);
            asset.set_main_image(img_asset, $('figcaption', main));
            $(main).remove();
        }

        let first_para = $('section p').first();
        asset.set_lede(first_para);
        $(first_para).remove();

        // Clean up classes for readability
        $('body, article, section, figure, figcaption').removeAttr('class');
        $('article').removeAttr('itemscope itemtype');
        $('figure').removeAttr('style');

        // Save assets for any remaining figures
        $('figure').each(function () {
            let fig_asset = Libingester.util.download_img($('img', this),
                BASE_URI);
            hatch.save_asset(fig_asset);
        });

        asset.set_body($('section'));

        asset.render();
        hatch.save_asset(asset);
    });
}

function main() {
    let hatch = new Libingester.Hatch('ars');
    RssToJson.load(FEED_URI).then(rss =>
        Promise.all(rss.items.map(entry => ingest_article(hatch, entry))))
    .then(() => hatch.finish())
    .catch(err => {
        console.log('there was an error', err);
        process.exitCode = 1;
    });
}

main();
