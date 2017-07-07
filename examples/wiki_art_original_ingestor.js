'use strict';

const libingester = require('libingester');
const rp = require('request-promise');
const url = require('url');

const base_uri = "https://www.wikiart.org/";
const paintings_json_uri = "https://www.wikiart.org/en/profile/594bd184edc2c91224abfcd5/albums/selection?json=2&page=1"; //Paintings URI

//Remove elements (body)
const remove_elements = [
    '.advertisement',
    '.arrow-container',
    '.pointer',
    '.social-container-flat',
    '.thumbnails_data',
    '#thumbnails_container',
];

function ingest_artwork_profile(hatch, uri) {
    return libingester.util.fetch_html(uri).then(($profile) => {
        const base_uri = libingester.util.get_doc_base_uri($profile, uri);
        const asset = new libingester.GalleryImageArticle();

        //Set title section
        const title = $profile('meta[property="og:title"]').attr('content');
        asset.set_title(title);
        asset.set_canonical_uri(uri);
        asset.set_date_published('9999');


        // Pull out the updated date
        asset.set_last_modified_date(new Date());
        asset.set_tags(['Artwork']);

        // Set article description
        const article_description = $profile('meta[property="og:description"]').attr('content');
        asset.set_synopsis(article_description);

        // Pull out the main image
        const main_img = $profile('img[itemprop="image"]');
        const main_image = libingester.util.download_img(main_img, base_uri);
        const image_copyright = $profile('.popup_copyPublicDomain .copyright-box').text();
        const image_description = $profile('.svg-icon-public-domain a.pointer').text();
        asset.set_synopsis(image_description);
        main_image.set_title(title);
        main_image.set_license(image_copyright);
        asset.set_main_image(main_image, title);
        hatch.save_asset(main_image);
        asset.set_thumbnail(main_image);


        let info = $profile('.info').first();
        const description = $profile('span[itemprop="description"]').text();

        //remove elements (info)
        for (const remove_element of remove_elements) {
            info.find(remove_element).remove();
        }

        //Fix relative links
        info.find('a').map(function() {
            this.attribs.href = url.resolve(base_uri, this.attribs.href);
        });

        // const content = mustache.render(template_artwork.structure_template, {
        //     title: title,
        //     asset_id: main_image.asset_id,
        //     image_description: image_description,
        //     info: info.html(),
        //     description: description,
        // });
        //
        // asset.set_document(content);
        asset.set_body(description);
        // asset.set_read_more_text(info);

        asset.render();
        hatch.save_asset(asset);
    }).catch((err) => {
        console.log(err);
    });
}


function main() {
    const hatch = new libingester.Hatch("wikiart", "en");

    const paintings = rp({ uri: paintings_json_uri, json: true }).then((response) => {
        if (response.Paintings != null) {
            return response.Paintings.map((datum) => url.resolve(base_uri, datum.paintingUrl));
        }
    }).then((links) => {
        return Promise.all(links.map((uri) => ingest_artwork_profile(hatch, uri)));
    });

    Promise.all([paintings]).then(() => {
        return hatch.finish();
    });
}

main();
