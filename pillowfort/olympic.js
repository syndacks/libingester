'use strict';

const mustache = require('mustache');
const rp = require('request-promise');
const url = require('url');
const pillowfort = require('./index');

function ingest_profile(hatch, uri) {
    return pillowfort.util.fetch_html(uri).then(($profile) => {
        const base_uri = pillowfort.util.get_doc_base_uri($profile, uri);

        const asset = new pillowfort.NewsArticle();
        asset.set_canonical_uri(uri);

        // Pull out the last-modified date.
        const modified_str = $profile('meta[property="article:modified_time"]').attr('content');
        const modified_date = new Date(Date.parse(modified_str));
        asset.set_last_modified_date(modified_date);

        // Put this in the "Profiles" sections of the app. Must match the name of the section
        // in the rest of the app.
        asset.set_section('Profiles');

        // Pull out the title from the profile box.
        const title = $profile('.profile-box [itemprop="name"]').text();
        asset.set_title(title);

        // Pull out the biography.
        const bio = $profile('[itemtype="http://schema.org/NewsArticle"]').first();

        const headshot_img = $profile('.profile-box picture img').first();
        const headshot_image = pillowfort.util.download_img(headshot_img, base_uri);
        hatch.save_asset(headshot_image);

        const image_gallery = $profile('.Collage img').map(function() {
            const asset = pillowfort.util.download_img(this, base_uri);
            hatch.save_asset(asset);
            return asset;
        }).get();

        // Construct a new document containing the content we want.
        const template = (`
<section class="title">
  <h1>{{ title }}</h1>
  <img data-pillowfort-asset-id="{{headshot_image.asset_id}}">
</section>

{{{ bio_html }}}

<section class="gallery">
  <h2>Gallery</h2>
  {{#image_gallery}}
  <img data-pillowfort-asset-id="{{asset_id}}">
  {{/image_gallery}}
</section>`);

        const content = mustache.render(template, {
            title: title,
            headshot_image: headshot_image,
            image_gallery: image_gallery,
            bio_html: bio.html(),
        });

        asset.set_document(content);

        hatch.save_asset(asset);
    });
}

function main() {
    const hatch = new pillowfort.Hatch();

    const base_uri = 'https://www.olympic.org/';
    const profiles_list = 'https://www.olympic.org/ajaxscript/loadmoretablelist/games/athletes/%7BA5FEFBC6-8FF7-4B0A-A96A-EB7943EA4E2F%7D/100/0';
    rp({ uri: profiles_list, json: true }).then((response) => {
        const profile_uris = response.content.map((datum) => url.resolve(base_uri, datum.urlName));
        return Promise.all(profile_uris.map((uri) => ingest_profile(hatch, uri)));
    }).then(() => {
        return hatch.finish();
    });
}

main();
