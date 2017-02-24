
const cheerio = require('cheerio');
const mustache = require('mustache');
const pillowfort = require('./index');

function main() {
    const hatch = new pillowfort.Hatch();

    const uri = 'https://www.olympic.org/michael-phelps';

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
        const headshot_job = pillowfort.util.simple_img_job(headshot_img, base_uri);
        hatch.save_job(headshot_job);

        const image_gallery = $profile('.Collage img').map(function() {
            const job = pillowfort.util.simple_img_job(this, base_uri);
            hatch.save_job(job);
            return job;
        }).get();

        // Construct a new document containing the content we want.
        const template = (`
<section class="title">
  <h1>{{ title }}</h1>
  <img data-soma-job-id="{{headshot_job.asset_id}}">
</section>

{{{ bio_html }}}

<section class="gallery">
  <h2>Gallery</h2>
  {{#image_gallery}}
  <img data-soma-job-id="{{job_id}}">
  {{/image_gallery}}
</section>`);

        const content = mustache.render(template, {
            title: title,
            headshot_job: headshot_job,
            image_gallery: image_gallery,
            bio_html: bio.html(),
        });

        asset.set_document(content);

        hatch.save_asset(asset);
        return hatch.finish();
    });
}

main();
