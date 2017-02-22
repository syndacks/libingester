'use strict';

const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rp = require('request-promise');
const verify = require('./verify');
const url = require('url');

function write_file_but_with_a_promise(path, data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, (err) => {
            if (err) return reject(err);
            else return resolve();
        });
    });
}

function new_asset_id() {
    var hash = crypto.createHash('sha1');
    hash.update(crypto.randomBytes(32));
    return hash.digest('hex');
}

class ValidationError extends Error {
}

class BaseAsset {
    constructor() {
        this._asset_id = new_asset_id();
    }

    get asset_id() { return this._asset_id; }

    set_title(value) { this._title = value; }
    set_canonical_uri(value) { this._canonical_uri = value; }
    set_thumbnail(value) { this._thumbnail = value; }
    set_last_modified_date(value) { this._last_modified_date = value; }
    set_license(value) { this._license = value; }

    _to_metadata() {
        return Promise.accept({
            "assetID": this._asset_id,
            "objectType": this._object_type,
            "contentType": this._content_type,

            "canonicalURI": this._canonical_uri,
            "matchingLinks": [ this._canonical_uri ],

            "title": this._title,
            "license": this._license,
            "tags": this._make_tags(),
            "lastModifiedDate": this._last_modified_date.toJSON(),
            "revisionTag": this._last_modified_date.toJSON(),
        }).then((metadata) => {
            verify.verify_metadata(metadata);
            return metadata;
        });
    }

    _wait() { return Promise.accept(); }

    _save_to_hatch(hatch_path) {
        return this._wait().then(() => {
            return Promise.all([this._to_data(), this._to_metadata()]);
        }).then(([data, metadata]) => {
            let metadata_text = JSON.stringify(metadata, null, 2);
            return Promise.all([
                write_file_but_with_a_promise(path.join(hatch_path, `${this._asset_id}.data`), data),
                write_file_but_with_a_promise(path.join(hatch_path, `${this._asset_id}.metadata`), metadata_text),
            ]);
        });
    }
};

class ImageAsset extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ImageObject";
    }

    set_image_data(value) { this._image_data = value; }

    _make_tags() { return []; }

    // Allow setting image_data to a Promise... probably a bad idea.
    _wait() { return this._image_data; }

    _to_data() { return this._image_data; }
}

exports.ImageAsset = ImageAsset;

function download_image(uri) {
    const promise = rp(uri).then((res) => {
        // XXX: pull this from headers
        asset._content_type = "image/jpeg";
        asset.set_image_data(res);
    });

    const asset = new ImageAsset();
    asset.set_canonical_uri(uri);
    asset.set_last_modified_date(new Date());
    asset.set_image_data(promise);
    return asset;
}

function node_root(node) {
    while (node.parent)
        node = node.parent;
    return node.root;
}

function parse_img_src(p) {
    const $img = cheerio(p);
    const img = $img.get(0);

    // Trick set in fetch_html.
    const root_node = node_root(img);
    const base_uri = root_node.$pillowfort_base_uri;

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

function download_img(img) {
    const $img = cheerio(img);

    if ($img.attr('data-pillowfort-asset-id'))
        throw new ValidationError("img already has associated ImageAsset");

    const src = parse_img_src($img);

    // Knock these out.
    $img.attr('src', null);
    $img.attr('srcset', null);

    const asset = download_image(src);
    $img.attr('data-pillowfort-asset-id', asset.asset_id);
    return asset;
}

exports.download_img = download_img;

class NewsArticle extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ArticleObject";
        this._content_type = "text/html";
    }

    set_document(value) { this._document = cheerio(value); }
    set_section(value) { this._section = value; }

    validate() {
        return Promise.accept().then(() => {
            const $elem = this._document;

            $elem.find('img, video, audio').each(function() {
                const $asset = cheerio(this);

                const asset_id = $asset.attr('data-pillowfort-asset-id');
                if (asset_id) {
                    $asset.attr('data-soma-job-id', asset_id);
                    $asset.attr('data-pillowfort-asset-id', null);
                }

                if (!$asset.attr('data-soma-job-id')) {
                    throw new ValidationError("Document has media without associated asset. Please ingest it or drop it.");
                }
            });
        });
    }

    _to_data() {
        return this.validate().then(() => {
            return this._document.html();
        });
    }

    _make_tags() { return [ this._section ]; }
}

exports.NewsArticle = NewsArticle;

function fetch_html(uri) {
    return rp(uri).then((res) => {
        const $doc = cheerio.load(res);
        $doc._root.$pillowfort_base_uri = uri;
        return $doc;
    });
}

exports.fetch_html = fetch_html;

class Hatch {
    constructor() {
        this._promises = [];
        this._hatch = fs.mkdtempSync('hatch_');
    }

    finish() {
        return Promise.all(this._promises);
    }

    save_asset(asset) {
        this._promises.push(asset._save_to_hatch(this._hatch));
    }
}

exports.Hatch = Hatch;
