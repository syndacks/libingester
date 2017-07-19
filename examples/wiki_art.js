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

        const tags = $profile('span[itemprop="keywords"] a').map((i, elem) => $profile(elem).text()).get();
        asset.set_tags(tags);

        // need to add +1 cause Js does some weird with date year
        const date = new Date(artwork_metadata.year).getFullYear() + 1;
        console.log("date: ", date);


        if (date) {
          const date_published = date.toString();
          asset.set_date_published(date_published);
        } else {
          asset.set_date_published("");
        }

        asset.set_last_modified_date(new Date());

        // remove A tags
        $profile('a').each(function () {
          $profile(this).replaceWith($profile(this).html());
        });


        const body = $profile('.info').first();
        // remove elements
        body.find('h1').remove();
        body.find('a.artist-name').remove();
        body.find('div.arrow-container').remove();
        body.find('sub').remove();
        body.find('li.advListItem').remove();
        body.find('#thumbnails_container').remove();
        body.find('ul.social-container-flat').remove();
        body.find('div.info-line.references').remove();

        const intro_paragraph = $profile('span[itemprop="description"]').text();
        body.append('<br/><div class="intro-paragraph">' + intro_paragraph +
          '</div class="intro_paragraph">' || '');

        asset.set_body(body);
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

    const artworks_2 = rp({ uri: RSS_BASE_2, json: true }).then((response) => {
        if (response.Paintings != null) {
            return response.Paintings;
        }
    }).then((art_json) => {
        return Promise.all(art_json.map((art_metadata) => ingest_art(hatch, art_metadata)));
    });

    Promise.all([artworks, artworks_2])
           .then(() => hatch.finish());
}

main();
