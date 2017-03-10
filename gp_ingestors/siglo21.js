'use strict';

const mustache = require('mustache');
const rp = require('request-promise');
const url = require('url');
const libingester = require('libingester');
const feed = require('rss-to-json');

function ingest_profile(hatch, uri) {
    return libingester.util.fetch_html(uri).then(($profile) => {
        const base_uri = libingester.util.get_doc_base_uri($profile, uri);

        const asset = new libingester.NewsArticle();
        asset.set_canonical_uri(uri);

        // Pull out the updated date
        const modified_str = $profile('meta[property="article:modified_time"]').attr('content');
        const modified_date = new Date(Date.parse(modified_str));
        asset.set_last_modified_date(modified_date);

         // Create constant for tags
        var tags = [];
        $profile('meta[property="article:tag"]').map(function() {
               // Set tags
               tags.push(this.attribs.content)
        });

         asset.set_section(tags);

        // Pull out the title
        const title = $profile('.gdlr-page-title').text();
        asset.set_title(title);

        // Pull out the main image
        const main_img = $profile('article.post .gdlr-blog-thumbnail img').first();
        const main_image = libingester.util.download_img(main_img, base_uri);
        hatch.save_asset(main_image);       

        // Create constant for body
        const body = $profile('article.post .gdlr-blog-content').first();
        // Create constant for gallery
        const gallery = $profile('article.post .wp-caption img, .gdlr-blog-content a>img');
       
        //Remove elements
        body.find('.addtoany_share_save_container').remove(); //share buttons
        body.find('.wp-caption').remove(); //share buttons image attachments
        body.find('.gdlr-single-blog-tag').remove(); //image tags
        body.find('.gdlr-blog-thumbnail').remove(); //main image
        body.find('script').remove(); //twitter script
        body.find('.wp-embedded-content').remove(); //embded content and blockquote
        body.find('h3').remove(); //any iframe title
        body.find('iframe').remove(); //any iframe
        body.find('script').remove(); //any script injection
        body.find('[class*="wp-image-"]').parents("a").remove(); //fancybox images

        // Pull out the other images for gallery
        const image_gallery = gallery.map(function() {
            var srcImage = this.attribs["data-lazy-src"];
            if (typeof srcImage != "undefined") {
                this.attribs.src = srcImage;
                const asset = libingester.util.download_img(this, base_uri);
                hatch.save_asset(asset);
                return asset; 
            }
        }).get();

        // Construct a new document containing the content we want.
        const template = (`<section class="title">
            <h1>{{ title }}</h1>
            <img data-libingester-asset-id="{{main_image.asset_id}}">
            </section>
            <section class="body">
                {{ body_html }}
            </section>
            {{#image_gallery.0}}
                <section class="gallery">
                    <h2>Images</h2>
                    {{#image_gallery}}
                        <img data-libingester-asset-id="{{asset_id}}">
                    {{/image_gallery}}
                </section>
            {{/image_gallery.0}}`);

        const content = mustache.render(template, {
            title: title,
            main_image: main_image,
            image_gallery: image_gallery,
            body_html: body.html(),
        });

        asset.set_document(content);
        hatch.save_asset(asset);  
    });

}

function main() {
    const hatch = new libingester.Hatch();

    const base_uri = 'http://www.s21.gt';
    const news_list = 'http://www.s21.gt/feed';

    feed.load(news_list, function(err, rss){
       const news_uris =  rss.items.map((datum) => datum.url);
            Promise.all(news_uris.map((uri) => ingest_profile(hatch, uri)))
            .then(() => {
                return hatch.finish();
            }); 
    });   
}

main();
