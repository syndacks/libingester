'use strict';

const mustache = require('mustache');
const url = require('url');
const libingester = require('libingester');

// TODO: Add image captions handling

function ingest_wowshack_page(hatch, uri) {
    return libingester.util.fetch_html(uri).then(($profile) => {
        const base_uri = libingester.util.get_doc_base_uri($profile, uri);

        const asset = new libingester.NewsArticle();
        asset.set_canonical_uri(uri);

        // Pull out the last-modified date.
        const modified_str = $profile('time[class="published"]').attr('datetime');
        const modified_date = new Date(Date.parse(modified_str));
        asset.set_last_modified_date(modified_date);
        asset.set_section('History');

        // Pull out the title from the profile box.
        const title = $profile('meta[itemprop="name"]').attr('content');
        asset.set_title(title);

        const image_gallery = $profile('img').map(function() {
            const asset = libingester.util.download_img(this, base_uri);
            hatch.save_asset(asset);
            return { asset, caption };
        }).get();

        // Construct a new document containing the content we want.
        const template = (`
<section class="title">
  <h1>{{ title }}</h1>
</section>

<section class="gallery">
  <h2>Gallery</h2>
  {{#image_gallery}}
  <img data-libingester-asset-id="{{asset_id}}">
  {{/image_gallery}}
</section>`);

        const content = mustache.render(template, {
            title: title,
            image_gallery: image_gallery,
        });

        // TODO: Convert to v2.0 API
        asset.set_document(content);

        hatch.save_asset(asset);
    })
    .catch(err => {
        console.error(err.stack);
        throw err;
    });
}

function main() {
    const hatch = new libingester.Hatch('old_indonesia', 'en');

    const base_uri = 'https://www.wowshack.com/a-rare-historical-look-at-old-indonesia-25-photos-taken-pre-1920/';
    ingest_wowshack_page(hatch, base_uri).then(() => {
      return hatch.finish();
    });
}

main();
