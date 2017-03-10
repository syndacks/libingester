'use strict';

const cheerio = require('cheerio');
const libingester = require('./index');
const rp = require('request-promise');
const url = require('url');

function fetch_html(uri) {
    return rp(uri).then((res) => {
        return cheerio.load(res);
    });
}

exports.fetch_html = fetch_html;

function get_doc_base_uri(doc, base_uri) {
    const $ = cheerio(doc);
    const $base = $.find('base[href]');
    if ($base.length)
        return $base.attr('href');

    return base_uri;
}

exports.get_doc_base_uri = get_doc_base_uri;

function get_img_src($img, base_uri) {
    const src = $img.attr('src');
    if (src)
        return url.resolve(base_uri, src);

    const srcset = $img.attr('srcset');
    if (srcset) {
        const first_decl = srcset.split(',')[0];
        const first_uri = first_decl.split(/\s+/)[0];
        return url.resolve(base_uri, first_uri);
    }

    throw new Error("Could not parse img tag's src");
}

function download_image(uri) {
    uri = encodeURI(uri);
    const asset = new libingester.ImageAsset();
    asset.set_canonical_uri(uri);
    asset.set_last_modified_date(new Date());

    const promise = rp({ uri: uri, encoding: null, resolveWithFullResponse: true }).then((response) => {
        asset.set_image_data(response.headers['content-type'], response.body);
    }).catch(function(error){
        throw new Error("img url has accent mark");
    });
    
    asset.set_image_data(undefined, promise);
    return asset;
}

exports.download_image = download_image;

function download_img(img, base_uri) {
    const $img = cheerio(img);

    if ($img.attr('data-libingester-asset-id'))
        throw new Error("img already has associated ImageAsset");

    const src = get_img_src($img, base_uri);

    // Knock these out.
    $img.attr('src', null);
    $img.attr('srcset', null);

    const asset = download_image(src);
    $img.attr('data-libingester-asset-id', asset.asset_id);
    return asset;
}

exports.download_img = download_img;
