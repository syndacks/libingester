
const cheerio = require('cheerio');
const mustache = require('mustache');
const pillowfort = require('./index');

function main() {
    const hatch = new pillowfort.Hatch();

    const uri = 'https://www.olympic.org/michael-phelps';

    pillowfort.fetch_html(uri).then(($profile) => {
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
        const headshot_image = pillowfort.download_img(headshot_img);
        hatch.save_asset(headshot_image);

        const image_gallery = $profile('.Collage img').map(function() {
            const asset = pillowfort.download_img(this);
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

main();
