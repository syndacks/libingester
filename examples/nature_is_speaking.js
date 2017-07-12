'use strict';

const libingester = require('libingester');
const mustache = require('mustache');
const request = require('request');
const rp = require('request-promise');
// const template_artist = require('./template_artist');
// const template_artwork = require('./template_artwork');
const url = require('url');

const base_uri = "http://www.conservation.org";


const nature_elements = [
  {
    'title' : 'Ice',
    'author': 'Liam Neeson',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/liam-neeson-is-ice.aspx',
    'video_uri' : 'http://embed.wistia.com/deliveries/35a0775f3d8143af313c72ed2c1c45f194883b7a/file.mp4',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/ice_bg_medium.jpg'
  },
  {
    'title' : 'Ocean',
    'author' : 'Harrison Ford',
    'url' : 'http://www.conservation.org/nature-is-speaking/pages/harrison-ford-is-the-ocean.aspx',
    'video_uri' : 'http://embed.wistia.com/deliveries/d23c3bbc754f25c8937a2bd4adf63456ebdb5ad6/file.mp4',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/ocean_bg_medium.jpg',
  },
];


function ingest_article(hatch, nature_element){
  return libingester.util.fetch_html(nature_element.url).then(($profile) => {

    const asset = new libingester.BlogArticle();

    const title = nature_element.title;
    const author = nature_element.author;
    const synopsis = $profile('#ctl00_PlaceHolderMain_RichHtmlField__ControlWrapper_RichHtmlField > section:nth-child(5) > h2').text();
    const body = $profile('div.grid p').map(function(){ return $profile(this)}).get().join(' ');


    asset.set_title(title);
    asset.set_author(author);
    asset.set_synopsis(synopsis);
    asset.set_canonical_uri(nature_element.url);
    asset.set_date_published(new Date('11/20/2015'));
    asset.set_last_modified_date(new Date());
    asset.set_tags(['nature']);
    asset.set_body(body);

    //image
    const image_uri = nature_element.image_uri;
    const main_image = libingester.util.download_image(image_uri);
    main_image.set_title(title + "_image");
    main_image.set_license('Conservation International');
    asset.set_thumbnail(main_image);
    hatch.save_asset(main_image);

    //video
    const video_uri = nature_element.video_uri;
    const video = new libingester.VideoAsset();
    video.set_download_uri(video_uri);
    video.set_title(title + "_video");
    video.set_thumbnail(main_image);
    hatch.save_asset(video);

    asset.render();
    hatch.save_asset(asset);

  }).catch(err => console.log(err));
}

function main() {
    const hatch = new libingester.Hatch("nature-is-speaking", "en");

    Promise.all(nature_elements.map((link_obj) => ingest_article(hatch, link_obj))).then(() => {
        return hatch.finish();
    });
}

main();
