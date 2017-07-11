'use strict';

const libingester = require('libingester');
const url = require('url');
const rp = require('request-promise');

const base_uri = 'https://www.wikiart.org';
const RSS_BASE = 'https://www.wikiart.org/en/profile/594bd184edc2c91224abfcd5/albums/selection?json=2&page=1';
const RSS_BASE_2 = 'https://www.wikiart.org/en/profile/594bd184edc2c91224abfcd5/albums/selection?json=2&page=2';


function ingest_art(hatch, artwork_metadata) {
    const uri = url.resolve(base_uri, artwork_metadata.paintingUrl)
    return libingester.util.fetch_html(uri).then(($profile) => {

        const asset = new libingester.GalleryImageArticle();

        asset.set_author(artwork_metadata.artistName)
        asset.set_title(artwork_metadata.title);
        asset.set_canonical_uri(uri);

        // Pull out date_published
        const date_published = artwork_metadata.year;
        // there is some bad data here for date_published, need to handle
        if (date_published !== "?" && date_published.length === 4) {
          asset.set_date_published(date_published);
        } else {
          asset.set_date_published("9999");
        }

        asset.set_last_modified_date(new Date());

        if ($profile){
          const body = $profile('div.info div.info-line').nextAll().map(function(){
            return $profile(this);
          }).get().join(' ');

          const tags = $profile('span[itemprop=keywords] a').map((i, elem) => $profile(elem).text()).get();
          asset.set_body(body);
          asset.set_tags(tags);

        } else {
          asset.set_body('');
          asset.set_tags(['wiki_art']);
        }

        //ensure cheerio value
        asset.set_read_more_text('www.wikiart.org');

        // image
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
