'use strict';

const libingester = require('libingester');
const rp = require('request-promise');
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
  {
    'title' : 'Sky',
    'author' : 'Joan Chen',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/Joan-Chen-is-Sky.aspx',
    'video_uri' : 'http://embed.wistia.com/deliveries/449ff34cb1f0f64318b063b33817f75b8d7784e1/file.mp4',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/sky_bg_medium.jpg',
  },
  {
    'title' : 'Home',
    'author' : 'Reese Witherspoon',
    'url' : 'http://www.conservation.org/nature-is-speaking/pages/reese-witherspoon-is-home.aspx',
    'video_uri' : 'https://www.youtube.com/watch?v=mkjwxmcdb0E',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/home_bg_medium.jpg',
  },
  {
    'title' : 'Mountain',
    'author' : 'Lee Pace',
    'url' : 'http://www.conservation.org/nature-is-speaking/pages/lee-pace-is-mountain.aspx',
    'video_uri' : 'http://embed.wistia.com/deliveries/1a6272d420e827fc10be088c0b3a34d6bac501d9/file.mp4',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/mountain_bg_medium.jpg',
  },
  {
    'title' : 'Flower',
    'author' : 'Lee Pace',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/Lupita-Nyongo-Is-Flower.aspx',
    'video_uri' : 'https://www.youtube.com/watch?v=0_OxI2JZex4',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/flower_bg_medium.jpg',
  },
  {
    'title' : 'Coral Reef',
    'author' : 'Ian Somerhalder',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/Ian-Somerhalder-Is-Coral-Reef.aspx',
    'video_uri' : 'http://embed.wistia.com/deliveries/d89c2531c6def6e2b0890e997d7c16c06fa3a1c2/file.mp4',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/coral_bg_medium.jpg',
  },
  {
    'title' : 'The Redwood',
    'author' : 'Roberd Redford',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/Ian-Somerhalder-Is-Coral-Reef.aspx',
    'video_uri' : 'https://www.youtube.com/watch?v=3e66bnuxV2A',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/redwood_bg_medium.jpg',
  },
  {
    'title' : 'Mother Nature',
    'author' : 'Julia Roberts',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/Julia-Roberts-Is-Mother-Nature.aspx',
    'video_uri' : 'https://www.youtube.com/watch?v=WmVLcj-XKnM',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/mothernature_bg_medium.jpg',
  },
  {
    'title' : 'The Soil',
    'author' : 'Edward Norton',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/Edward-Norton-Is-the-Soil.aspx',
    'video_uri' : 'https://www.youtube.com/watch?v=Dor4XvjA8Wo',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/soil_bg_medium.jpg',
  },
  {
    'title' : 'The Rainforest',
    'author' : 'Kevin Spacey',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/Kevin-Spacey-Is-the-Rainforest.aspx',
    'video_uri' : 'https://www.youtube.com/watch?v=jBqMJzv4Cs8',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/rainforest_bg_medium.jpg',
  },
  {
    'title' : 'Water',
    'author' : 'Penelope Cruz',
    'url' : 'http://www.conservation.org/nature-is-speaking/Pages/Penelope-Cruz-Is-Water.aspx',
    'video_uri' : 'https://www.youtube.com/watch?v=fwV9OYeGN88',
    'image_uri' : 'http://www.conservation.org/nature-is-speaking/publishingimages/water_bg_medium.jpg',
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
