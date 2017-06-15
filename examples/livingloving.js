'use strict';

const libingester = require('libingester');
const rss2json = require('rss-to-json');

const rss_uri = "http://www.livingloving.net/feed/";

const img_metadata = [
    'class',
    'data-jpibfi-indexer',
    'data-jpibfi-post-excerpt',
    'data-jpibfi-post-url',
    'data-jpibfi-post-title',
    'height',
    'id',
    'rscset',
    'sizes',
    'src',
    'width',
];

const remove_elements = [
    'iframe',
    'input',
    'noscript',
    'script',
    '.link_pages',
    '.jp-relatedposts',
    '.post-tags',
    '.sharedaddy',
    '[id*="more-"]',
];

function ingest_article(hatch, uri) {
    return libingester.util.fetch_html(uri).then(($profile) => {
        let base_uri = libingester.util.get_doc_base_uri($profile, uri);

        let modified_date = $profile('meta[property="article:modified_time"]').attr('content');
        let article_entry = $profile('.post .post-heading .meta').first();
        let article_data = $profile(article_entry).text().split(' • ');
        let author = article_data[0];
        let date_published = article_data[1];
        let category = article_data[2];
        let title = $profile('meta[property="og:title"]').attr('content');
        let synopsis = $profile('meta[property="og:description"]').attr('content');
        let body = $profile('.post-entry').first();

        let tags = $profile('a[rel="category tag"]').map(function() {
            return $profile(this).text();
        }).get();

        let meta = $profile('.post .post-heading .meta').first();
        meta.find(".bullet").remove();

        let main_img = $profile('.post-img a img');
        let main_image = libingester.util.download_img(main_img, base_uri);
        main_image.set_title(title);
        hatch.save_asset(main_image);

        body.find("img").map(function() {
            if (this.attribs.src != undefined) {
                let image = libingester.util.download_img(this, base_uri);
                image.set_title(title);
                hatch.save_asset(image);
                this.attribs["data-libingester-asset-id"] = image.asset_id;
                for (let img_meta of img_metadata) {
                    delete this.attribs[img_meta];
                }
            }
        });

        for (let remove_element of remove_elements) {
            body.find(remove_element).remove();
        }

        let asset = new libingester.BlogArticle();
        asset.set_canonical_uri(uri);
        asset.set_last_modified_date(new Date(Date.parse(modified_date)));
        asset.set_title(title);
        asset.set_synopsis(synopsis);
        asset.set_thumbnail(main_image);
        asset.set_author(author);
        asset.set_date_published(date_published);
        asset.set_license('Proprietary');
        asset.set_main_image(main_image);
        asset.set_main_image_caption('Image Caption');
        asset.set_body(body);
        asset.set_tags(tags);
        asset.set_read_more_text('Original Article at wwww.livingloving.net');
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
        asset.render();

        hatch.save_asset(asset);
    })
    .catch(err => {
        console.error(err.stack);
        throw err;
    });
}

function main() {
    let hatch = new libingester.Hatch('livingloving', 'id');
    rss2json.load(rss_uri, function(err, rss) {
        let articles_links = rss.items.map((datum) => datum.url);
        Promise.all(articles_links.map((uri) => ingest_article(hatch, uri))).then(() => hatch.finish());
    });
}

main();
