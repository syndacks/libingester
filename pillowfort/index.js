'use strict';

const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const verify = require('./verify');

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

    _to_data() { return null; }

    _to_metadata() {
        return {
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
        };
    }

    _wait() { return Promise.resolve(); }

    _save_to_hatch(hatch_path) {
        return this._wait().then(() => {
            const data = this._to_data();
            const metadata = this._to_metadata();

            if (data)
                metadata['cdnFilename'] = `${metadata['assetID']}.data`;

            verify.verify_metadata(metadata);

            let metadata_text = JSON.stringify(metadata, null, 2);
            let promises = [];

            promises.push(write_file_but_with_a_promise(path.join(hatch_path, `${this._asset_id}.metadata`), metadata_text));

            if (data)
                promises.push(write_file_but_with_a_promise(path.join(hatch_path, `${this._asset_id}.data`), data));

            return Promise.all(promises);
        });
    }
}

class ImageAsset extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ImageObject";
    }

    set_image_data(content_type, image_data) {
        this._content_type = content_type;
        this._image_data = image_data;
    }

    _make_tags() { return []; }

    // Allow setting image_data to a Promise... probably a bad idea.
    _wait() { return Promise.resolve(this._image_data); }

    _to_data() { return this._image_data; }

    _get_outgoing_asset_ids() { return []; }
}

exports.ImageAsset = ImageAsset;

class NewsArticle extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ArticleObject";
        this._content_type = "text/html";
    }

    set_document(value) { this._document = cheerio(value); }
    set_section(value) { this._section = value; }

    validate() {
        return Promise.resolve().then(() => {
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

    _to_metadata() {
        const metadata = super._to_metadata();
        metadata['document'] = this._document.toString();
        return metadata;
    }

    _make_tags() { return [ this._section ]; }

    _get_outgoing_asset_ids() {
        return this._document.find('[data-soma-job-id]').map(function() {
            return cheerio(this).attr('data-soma-job-id');
        }).get();
    }
}

exports.NewsArticle = NewsArticle;

function is_subset(a, b) {
    for (let item of a)
        if (!b.has(item))
            return false;

    return true;
}

class Hatch {
    constructor() {
        this._promises = [];
        this._assets = [];
        this._path = fs.mkdtempSync('hatch_');
    }

    _validate_asset_references() {
        // Assure that all outgoing edges are satisfied.

        // Outgoing edges.
        const outgoing = new Set();

        // Node labels
        const asset_ids = new Set();

        this._assets.forEach((asset) => {
            asset_ids.add(asset.asset_id);
            for (let outgoing_asset_id of asset._get_outgoing_asset_ids())
                outgoing.add(outgoing_asset_id);
        });

        // Assert that outgoing edges is contained in asset_ids.
        if (!is_subset(outgoing, asset_ids))
            throw new ValidationError("Asset references inconsistent");
    }

    _save_hatch_manifest() {
        const assets = this._assets.map((asset) => {
            return asset.asset_id;
        });

        const manifest = { assets: assets };
        const manifest_str = JSON.stringify(manifest, null, 2);
        return write_file_but_with_a_promise(path.join(this._path, 'hatch_manifest.json'), manifest_str);
    }

    finish() {
        return Promise.all(this._promises).then(() => {
            return this._validate_asset_references();
        }).then(() => {
            return this._save_hatch_manifest();
        });
    }

    save_asset(asset) {
        this._assets.push(asset);
        this._promises.push(asset._save_to_hatch(this._path));
    }
}

exports.Hatch = Hatch;

exports.util = require('./util');

