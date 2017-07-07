'use strict';

const libingester = require('libingester');
const url = require('url');
const rp = require('request-promise');

const base_uri = 'https://www.wikiart.org';
const RSS_BASE = 'https://www.wikiart.org/en/profile/594bd184edc2c91224abfcd5/albums/selection?json=2&page=1';
const RSS_BASE_2 = 'https://www.wikiart.org/en/profile/594bd184edc2c91224abfcd5/albums/selection?json=2&page=2';


function ingest_art(hatch, artwork_metadata) {
    const uri = url.resolve(base_uri, artwork_metadata.id)
    return libingester.util.fetch_html(uri).then(($profile) => {

        const asset = new libingester.GalleryImageArticle();

        asset.set_author(artwork_metadata.artistName)
        asset.set_title(artwork_metadata.title);
        asset.set_canonical_uri(uri);
        asset.set_date_published('9999');

        // Pull out the updated date
        asset.set_last_modified_date(new Date());
        asset.set_tags(['tag']);

        //ensure cheerio value
        asset.set_body('');
        asset.set_read_more_text('');

        // asset.set_as_static_page()
        // image
        const image_description = $profile(".image-wrapper .comment").children();
        const main_image = libingester.util.download_image(artwork_metadata.image);
        asset.set_thumbnail(main_image);
        asset.set_main_image(main_image, artwork_metadata.title);
        hatch.save_asset(main_image);


        asset.render();
        hatch.save_asset(asset);

    }).catch((err) => {
        console.log(err);
    });
}

function main() {
    const hatch = new libingester.Hatch("wikiart", "en");

    const artworks = rp({ uri: RSS_BASE, json: true }).then((response) => {
        if (response.Paintings != null) {
            return response.Paintings;
        }
    }).then((art_json) => {
        return Promise.all(art_json.map((art_metadata) => ingest_art(hatch, art_metadata)));
    });



    Promise.all([artworks])
           .then(() => hatch.finish());

}

main();
