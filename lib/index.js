'use strict';

const aws = require('aws-sdk');
const cheerio = require('cheerio');
const crypto = require('crypto');
const path = require('path');
const verify = require('./verify');

const thenify_all = require('thenify-all');
const fs = thenify_all(require('fs-extra'), {}, ['readFile', 'writeFile', 'readdir', 'copy']);
const targz = require('tar.gz');

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

    _process() { return Promise.resolve(); }

    _save_to_hatch(hatch) {
        const hatch_path = hatch._path;
        hatch._assets.push(this);
        hatch._promises.push(this._process().then(() => {
            const data = this._to_data();
            const metadata = this._to_metadata();

            if (data)
                metadata['cdnFilename'] = `${metadata['assetID']}.data`;

            verify.verify_metadata(metadata);

            let metadata_text = JSON.stringify(metadata, null, 2);
            let promises = [];

            promises.push(fs.writeFile(path.join(hatch_path, `${this._asset_id}.metadata`), metadata_text));

            if (data)
                promises.push(fs.writeFile(path.join(hatch_path, `${this._asset_id}.data`), data));

            return Promise.all(promises);
        }));
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
    _process() { return Promise.resolve(this._image_data); }

    _to_data() { return this._image_data; }

    _get_outgoing_asset_ids() { return []; }
}

exports.ImageAsset = ImageAsset;

class VideoAsset extends BaseAsset {
    constructor() {
        super();
        this._object_type = "VideoObject";
    }

    set_download_uri(value) { this._download_uri = value; }

    _save_to_hatch(hatch) {
        hatch._videos.push({
            asset_id: this.asset_id,
            uri: this._download_uri,
            title: this._title,
        });
    }
}

exports.VideoAsset = VideoAsset;

class NewsArticle extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ArticleObject";
        this._content_type = "text/html";
    }

    set_document(value) { this._document = cheerio(value); }
    set_section(value) { this._section = value; }

    _process() {
        return Promise.resolve().then(() => {
            const $elem = this._document;

            $elem.find('img, video, audio').each(function() {
                const $asset = cheerio(this);

                const asset_id = $asset.attr('data-libingester-asset-id');
                if (asset_id) {
                    $asset.attr('data-soma-job-id', asset_id);
                    $asset.attr('data-libingester-asset-id', null);
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
    constructor(name) {
        this._promises = [];
        this._assets = [];
        this._videos = [];

        // If name is not specified, make sure we don't cause problems
        // but otherwise add it to the prefix
        if (!name) {
            name = "";
        } else {
            name += '_';
        }

        this._path = fs.mkdtempSync('hatch_' + name.toLowerCase());
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

    // The manifest should contain a subset of the asset's fields needed by the
    // Portal to display the hatch's contents
    _save_hatch_manifest() {
        const assets = this._assets.map((asset) => {
            return {
                asset_id: asset.asset_id,
                uri: asset._canonical_uri,
                title: asset._title,
            };
        });

        const manifest = { assets: assets, videos: this._videos };
        const manifest_str = JSON.stringify(manifest, null, 2);
        return fs.writeFile(path.join(this._path, 'hatch_manifest.json'), manifest_str);
    }

    // Endless provides two buckets by default: dev and prod. If you're
    // ingesting content for use on the production Portal, be sure to set
    // NODE_ENV=production
    _get_default_bucket() {
        const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
        return `com-endless--cloud-soma-${env}-hatch`;
    }

    _create_hatch_archive() {
        const tarballPath = `${this._path}.tar.gz`;
        return new Promise((resolve, reject) => {
            targz().compress(this._path, tarballPath, err => {
                if (err) { return reject(err); }
                resolve(tarballPath);
            });
        });
    }

    finish() {
        console.log('hatch: waiting for pending downloads...');
        return Promise.all(this._promises).then(() => {
            return this._validate_asset_references();
        }).then(() => {
            console.log('hatch: exporting hatch manifest...');
            return this._save_hatch_manifest();
        }).then(() => {
            console.log('hatch: creating hatch tarball...');
            return this._create_hatch_archive();
        }).then((tarballPath) => {
            console.log(`hatch: finished, saved to ${tarballPath}`);
        });
    }

    save_asset(asset) {
        asset._save_to_hatch(this);
    }

    copy_to_directory(directory) {
        return fs.copy(this._path, directory);
    }

    copy_to_s3(bucket = null) {
        const hatch_id = path.basename(this._path);

        /* XXX: Configure this to use us-west-2 */
        const s3 = new aws.S3();
        bucket = bucket || this._get_default_bucket();

        return fs.readdir(this._path).then((files) => {
            const promises = files.map((filename) => {
                const full_path = path.join(this._path, filename);
                return fs.readFile(full_path).then((contents) => {
                    return s3.putObject({
                        Bucket: bucket,
                        Key: `${hatch_id}/${filename}`,
                        Body: contents,
                    }).promise();
                });
            });

            return Promise.all(promises);
        }).then(() => {
            console.log(`Hatch copied to http://${bucket}.s3.amazonaws.com/${hatch_id}`);
        });
    }
}

exports.Hatch = Hatch;

exports.util = require('./util');
