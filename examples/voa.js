'use strict';

const libingester = require('libingester');
const url = require('url');

function ingest_video(hatch, uri) {
    return libingester.util.fetch_html(uri).then(($video_page) => {
        const download_links = $video_page('.media-download li.subitem a');
        const video_downloads = {};

        download_links.each(function() {
            const $a = $video_page(this);
            // Formatted as "quality | filesize";
            const title = $a.attr('title');
            const quality = title.split(' | ')[0];
            video_downloads[quality] = $a.attr('href');
        });

        const video_uri = video_downloads['720p'];
        if (!video_uri)
            return;

        const asset = new libingester.VideoAsset();

        asset.set_canonical_uri(uri);

        // Bizarrely enough, the only publish date information is in the LD-JSON (!!) text.
        const ld_json = JSON.parse($video_page('script[type="application/ld+json"]').text());
        const date = new Date(Date.parse(ld_json.datePublished));
        asset.set_last_modified_date(date);

        const title = $video_page('h1').text();
        asset.set_title(title);

        asset.set_download_uri(video_uri);

        hatch.save_asset(asset);
    });
}

function main() {
    const hatch = new libingester.Hatch();

    // Undocumented feature: if you pass an invalid page it returns all videos.
    const videos_list = 'http://learningenglish.voanews.com/z/4729?p=999';
    libingester.util.fetch_html(videos_list).then(($videos) => {
        const video_links = $videos('.program-body a.img-wrapper').map(function() {
            const link = $videos(this);
            const uri = link.attr('href');
            const full_uri = url.resolve(videos_list, uri);
            return full_uri;
        }).get();

        return Promise.all(video_links.map((uri) => ingest_video(hatch, uri)));
    }).then(() => {
        return hatch.finish();
    });
}

main();
