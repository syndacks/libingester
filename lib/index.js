'use strict';

const aws = require('aws-sdk');
const cheerio = require('cheerio');
const crypto = require('crypto');
const mustache = require('mustache');
const path = require('path');
const sass = require('node-sass');
const verify = require('./verify');

const thenify_all = require('thenify-all');
const fs = thenify_all(require('fs-extra'), {}, ['readFile', 'writeFile', 'readdir', 'copy']);
const targz = require('tar.gz');

const EKN_STATIC_TAG = 'EknStaticTag';

function new_asset_id() {
    var hash = crypto.createHash('sha1');
    hash.update(crypto.randomBytes(32));
    return hash.digest('hex');
}

// Date formatting is awful in JS but using a lib was too heavy
function getTimestamp() {
    var date = new Date();

    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let hour = date.getHours();
    let minute = date.getMinutes();
    let second = date.getSeconds();

    month = (month < 10 ? "0" : "") + month;
    day = (day < 10 ? "0" : "") + day;
    hour = (hour < 10 ? "0" : "") + hour;
    minute = (minute < 10 ? "0" : "") + minute;
    second = (second < 10 ? "0" : "") + second;

    return year + month + day + "_" +  hour + minute + second;
}

function _ensure_cheerio(value) {
    if (typeof value === 'string')
        return cheerio.load(value);
    return value;
}

function _ensure_date (value) {
    if (value instanceof Date) {
        if (isNaN(value.getTime())) {
            console.error(`WARNING: provided an invalid date object`);
            return null;
        }
        return value;
    }
    try {
        return new Date(value);
    } catch (e) {
        console.error(`WARNING: Could not coerce value into a date: ${value}`);
        return null;
    }
}

class ValidationError extends Error {
}

class BaseAsset {
    constructor() {
        this._asset_id = new_asset_id();
        this._ekn_tags = [];
    }

    get asset_id() { return this._asset_id; }

    set_title(value) { this._title = value.trim(); }
    set_synopsis(value) { this._synopsis = value.trim(); }
    set_thumbnail(value) { this._thumbnail_asset_id = value.asset_id; }
    set_canonical_uri(value) { this._canonical_uri = value; }
    set_last_modified_date(value) { this._last_modified_date = _ensure_date(value); }
    set_date_published(value) { this._date_published = _ensure_date(value); }
    set_license(value) { this._license = value; }

    to_data() { return null; }

    to_metadata() {
        // Build an object with all required fields
        let metadata = {
            "assetID": this._asset_id,
            "objectType": this._object_type,
            "contentType": this._content_type,

            "canonicalURI": this._canonical_uri,
            "matchingLinks": [ this._canonical_uri ],

            "title": this._title,
            "tags": this._make_tags().concat(this._ekn_tags),
            "revisionTag": getTimestamp(),
        };

        // Add optional fields if they're present
        if (this._date_published)
            metadata.datePublished = this._date_published.toISOString();
        if (this._last_modified_date) {
            metadata.lastModifiedDate = this._last_modified_date.toISOString();
            metadata.revisionTag = this._last_modified_date.toISOString();
        }
        if (this._license)
            metadata.license = this._license;
        if (this._synopsis)
            metadata.synopsis = this._synopsis;
        if (this._thumbnail_asset_id)
            metadata.thumbnail = this._thumbnail_asset_id;

        return metadata;
    }

    _process() { return Promise.resolve(); }

    _make_tags() { return []; }

    _save_to_hatch(hatch) {
        const hatch_path = hatch._path;
        hatch._assets.push(this);
        hatch._promises.push(this._process().then(() => {
            const data = this.to_data();
            const metadata = this.to_metadata();

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

    _get_thumbnail_asset_id() {
        return this._thumbnail_asset_id;
    }

    _get_dependent_asset_ids() {
        return [];
    }

    get_dependent_assets() {
        const assets = new Set();
        const thumbnail_id = this._get_thumbnail_asset_id();
        if (thumbnail_id)
            assets.add(thumbnail_id);
        for (let dependent_asset_id of this._get_dependent_asset_ids())
            assets.add(dependent_asset_id);
        return assets;
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

    _process() {
        // In case _image_data is a promise, resolve it before verifying it
        return Promise.resolve(this._image_data).then(() => {
            verify.verify_image_data(this._image_data);
        });
    }

    to_data() { return this._image_data; }
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

class DictionaryAsset extends BaseAsset {
    constructor() {
        super();
        this._object_type = "DictionaryObjectModel";
        this._content_type = "text/html";
    }

    set_word (value) { this._word = value; }
    set_definition (value) { this._definition = value; }
    set_part_of_speech (value) { this._part_of_speech = value; }
    set_tags (value) { this._tags = value; }

    to_metadata() {
        const metadata = super.to_metadata();
        Object.assign(metadata, {
            'word': this._word,
            'definition': this._definition,
            'partOfSpeech': this._part_of_speech,
            'tags': [this._tags],
            'document': this._document.html()
        });
        return metadata;
    }

    render() {
        let template_path = path.join(__dirname, './assets/dictionary-article.mst');
        let template = fs.readFileSync(template_path, 'utf8');

        let document = mustache.render(template, {
            word: this._word,
            definition: this._definition,
            part_of_speech: this._part_of_speech
        });

        this._document = cheerio.load(document);
    }

    _make_tags() { return this._tags; }
}

exports.DictionaryAsset = DictionaryAsset;

class BlogArticle extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ArticleObject";
        this._content_type = "text/html";
        this._tags = [];
    }

    set_author(value) { this._author = value; }
    set_main_image(value) { this._main_image = value; }
    set_main_image_caption(value) { this._main_image_caption = value; }
    set_body(value) { this._body = _ensure_cheerio(value); }
    set_custom_scss(value) { this._custom_scss = value; }
    set_read_more_text(value) { this._read_more_text = value; }
    set_tags (value) { this._tags = value; }
    set_as_static_page() { this._ekn_tags.push(EKN_STATIC_TAG); }

    to_metadata() {
        const metadata = super.to_metadata();
        Object.assign(metadata, {
            'document': this._document.html(),
            'authors': [this._author],
        });

        return metadata;
    }

    _process() {
        return Promise.resolve().then(() => {
            const $elem = this._document;

            if (!$elem) {
                throw new Error(`Must call asset.render() before saving BlogArticle to a hatch.`);
            }

            $elem('img, video, audio').each(function() {
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

    render() {
        let template_path = path.join(__dirname, './assets/blog-article.mst');
        let template = fs.readFileSync(template_path, 'utf8');

        let stylesheet;
        let blog_stylesheet = path.join(__dirname, './assets/blog-stylesheet.scss');
        if (this._custom_scss) {
            stylesheet = sass.renderSync({
                data: this._custom_scss,
                outputStyle: 'compressed',
                importer(uri, prev, done) {
                    if (uri === '_default') {
                        return {
                            file: blog_stylesheet,
                        };
                    }
                    return null;  // default handler
                },
            });
        } else {
            stylesheet = sass.renderSync({
                file: blog_stylesheet,
                outputStyle: 'compressed',
            });
        }

        let main_image;
        if (this._main_image) {
            main_image = this._main_image.asset_id;
        }

        let document = mustache.render(template, {
            stylesheet: stylesheet.css,
            author: this._author,
            title: this._title,
            main_image: main_image,
            main_image_caption: this._main_image_caption,
            body: this._body.html(),
            canonical_uri: this._canonical_uri,
            read_more_text: this._read_more_text,
        });

        this._document = cheerio.load(document);
    }

    _make_tags() { return this._tags; }

    _get_dependent_asset_ids() {
        return this._document('[data-soma-job-id]').map(function() {
            return cheerio(this).attr('data-soma-job-id');
        }).get();
    }
}

exports.BlogArticle = BlogArticle;

class GalleryImageArticle extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ArticleObject";
        this._content_type = "text/html";
        this._temporal_coverage = [];
    }

    set_author(value) { this._author = value; }
    set_main_image(value) { this._main_image = value; }
    set_body(value) { this._body = _ensure_cheerio(value); }
    set_custom_scss(value) { this._custom_scss = value; }
    set_read_more_text(value) { this._read_more_text = value; }
    set_tags (value) { this._tags = value; }
    set_as_static_page() { this._ekn_tags.push(EKN_STATIC_TAG); }

    // temporal_coverage here is an array of dates, sorted
    // in ascending order. The consumer is responsible for
    // translating this into something sensible in accordance
    // with the user's localisation preferences per
    // http://schema.org/temporalCoverage
    set_temporal_coverage(value) {
        const arrayValue = value instanceof Array ? value : [value];
        this._temporal_coverage = arrayValue.map((v) => {
            if (!(v instanceof Date)) {
                return new Date(v);
            }

            return v;
        }).sort();
    }

    to_metadata() {
        const metadata = super.to_metadata();
        Object.assign(metadata, {
            'document': this._document.html(),
            'authors': [this._author],
            'temporalCoverage': this._temporal_coverage
        });
        return metadata;
    }

    _process() {
        return Promise.resolve().then(() => {
            const $elem = this._document;

            $elem('img, video, audio').each(function() {
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

    render() {
        let template_path = path.join(__dirname, './assets/gallery-image-article.mst');
        let template = fs.readFileSync(template_path, 'utf8');

        let stylesheet;
        let gallery_image_stylesheet = path.join(__dirname, './assets/gallery-image-stylesheet.scss');
        if (this._custom_scss) {
            stylesheet = sass.renderSync({
                data: this._custom_scss,
                outputStyle: 'compressed',
                importer(uri, prev, done) {
                    if (uri === '_default') {
                        return {
                            file: gallery_image_stylesheet,
                        };
                    }
                    return null;  // default handler
                },
            });
        } else {
            stylesheet = sass.renderSync({
                file: gallery_image_stylesheet,
                outputStyle: 'compressed',
            });
        }

        let main_image;
        if (this._main_image) {
            main_image = this._main_image.asset_id;
        }

        let document = mustache.render(template, {
            stylesheet: stylesheet.css,
            author: this._author,
            title: this._title,
            main_image: main_image,
            body: this._body.html(),
            canonical_uri: this._canonical_uri,
            read_more_text: this._read_more_text,
        });

        this._document = cheerio.load(document);
    }

    _make_tags() { return this._tags; }

    _get_dependent_asset_ids() {
        return this._document('[data-soma-job-id]').map(function() {
            return cheerio(this).attr('data-soma-job-id');
        }).get();
    }
}

exports.GalleryImageArticle = GalleryImageArticle;

class GalleryVideoArticle extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ArticleObject";
        this._content_type = "text/html";
    }

    set_author(value) { this._author = value; }
    set_main_image(value) { this._main_image = value; }
    set_body(value) { this._body = _ensure_cheerio(value); }
    set_custom_scss(value) { this._custom_scss = value; }
    set_read_more_text(value) { this._read_more_text = value; }
    set_tags (value) { this._tags = value; }
    set_as_static_page() { this._ekn_tags.push(EKN_STATIC_TAG); }

    to_metadata() {
        const metadata = super.to_metadata();
        Object.assign(metadata, {
            'document': this._document.html(),
            'authors': [this._author],
        });
        return metadata;
    }

    _process() {
        return Promise.resolve().then(() => {
            const $elem = this._document;

            $elem('img, video, audio').each(function() {
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

    render() {
        let template_path = path.join(__dirname, './assets/gallery-video-article.mst');
        let template = fs.readFileSync(template_path, 'utf8');

        let stylesheet;
        let gallery_video_stylesheet = path.join(__dirname, './assets/gallery-video-stylesheet.scss');
        if (this._custom_scss) {
            stylesheet = sass.renderSync({
                data: this._custom_scss,
                outputStyle: 'compressed',
                importer(uri, prev, done) {
                    if (uri === '_default') {
                        return {
                            file: gallery_video_stylesheet,
                        };
                    }
                    return null;  // default handler
                },
            });
        } else {
            stylesheet = sass.renderSync({
                file: gallery_video_stylesheet,
                outputStyle: 'compressed',
            });
        }

        let main_image;
        if (this._main_image) {
            main_image = this._main_image.asset_id;
        }

        let playbutton_svg_path = path.join(__dirname, './assets/play-button.svg');
        let playbutton_decoration_xml = fs.readFileSync(playbutton_svg_path, 'utf8');
        let playbutton_decoration = cheerio.load(playbutton_decoration_xml, {
            xmlMode: true,
        });
        cheerio('.main-image-wrapper', this._body).append(`<div class="play-button-wrapper">
            ${playbutton_decoration.html('svg')}
        </div>`);

        let document = mustache.render(template, {
            stylesheet: stylesheet.css,
            author: this._author,
            title: this._title,
            main_image: main_image,
            body: this._body.html(),
            canonical_uri: this._canonical_uri,
            read_more_text: this._read_more_text,
        });

        this._document = cheerio.load(document);
    }

    _make_tags() { return this._tags; }

    _get_dependent_asset_ids() {
        return this._document('[data-soma-job-id]').map(function() {
            return cheerio(this).attr('data-soma-job-id');
        }).get();
    }
}

exports.GalleryVideoArticle = GalleryVideoArticle;

class NewsArticle extends BaseAsset {
    constructor() {
        super();
        this._object_type = "ArticleObject";
        this._content_type = "text/html";
        this._authors = [];
    }

    // Takes a string or array of strings
    set_authors(value) {
        this._authors = value;
        if (!(value instanceof Array))
            this._authors = [value];
    }

    set_main_image(asset, caption) {
        this._main_image = asset;
        this._main_image_caption = _ensure_cheerio(caption);
    }

    set_section(value) { this._section = value; }
    set_as_static_page() { this._ekn_tags.push(EKN_STATIC_TAG); }
    set_source(value) { this._source = value; }
    set_lede(value) { this._lede = _ensure_cheerio(value); }
    set_body(value) { this._body = _ensure_cheerio(value); }
    set_custom_scss(value) { this._custom_scss = value; }
    set_read_more_link(value) {
        this._read_more_link = cheerio.load(`<p>${value}</p>`);
    }

    render() {
        let main_image = false;
        if (this._main_image) {
            main_image = {
                asset_id: this._main_image.asset_id,
            };
            if (this._main_image_caption.length) {
                main_image['caption'] = cheerio.html(this._main_image_caption);
            }
        }

        let quote_svg_path = path.join(__dirname, './assets/quote.svg');
        let quote_decoration_xml = fs.readFileSync(quote_svg_path, 'utf8');
        let quote_decoration = cheerio.load(quote_decoration_xml, {
            xmlMode: true,
        });
        cheerio('blockquote', this._body).prepend(`<div class="quote-decoration">
            ${quote_decoration.html('svg')}
        </div>`);

        cheerio('a', this._read_more_link).addClass('eos-show-link');

        let template_path = path.join(__dirname, './assets/news-article.mst');
        let template = fs.readFileSync(template_path, 'utf8');

        let stylesheet;
        let news_stylesheet = path.join(__dirname, './assets/news-stylesheet.scss');
        if (this._custom_scss) {
            stylesheet = sass.renderSync({
                data: this._custom_scss,
                outputStyle: 'compressed',
                importer(uri, prev, done) {
                    if (uri === '_default') {
                        return {
                            file: news_stylesheet,
                        };
                    }
                    return null;  // default handler
                },
            });
        } else {
            stylesheet = sass.renderSync({
                file: news_stylesheet,
                outputStyle: 'compressed',
            });
        }

        let body = mustache.render(template, {
            stylesheet: stylesheet.css,
            canonical_uri: this._canonical_uri,
            source: this._source,
            authors: this._authors.join(' &mdash; '),
            title: this._title,
            lede: this._lede.html(),
            main_image: main_image,
            body: this._body.html(),
            read_more: this._read_more_link.html('p'),
        });
        this._document = cheerio.load(body);
    }

    _process() {
        return Promise.resolve().then(() => {
            const $elem = this._document;

            if (!$elem) {
                throw new Error(`Must call asset.render() before saving BlogArticle to a hatch.`);
            }

            $elem('img, video, audio').each(function() {
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

    to_metadata() {
        const metadata = super.to_metadata();
        Object.assign(metadata, {
            'document': this._document.html(),
            'authors': this._authors,
            'sourceName': this._source,
        });
        return metadata;
    }

    _make_tags() { return [ this._section ]; }

    _get_dependent_asset_ids() {
        return this._document('[data-soma-job-id]').map(function() {
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
    constructor(name, language, options) {
        this._promises = [];
        this._assets = [];
        this._videos = [];

        options = options || {};

        if (!name) {
            throw new Error("ERROR! Hatch name must be specified!");
        }

        // The string check is to ensure that we don't consider older-api `options`
        // as the language which was in this position before
        if (!language || (typeof language !== 'string' && !(language instanceof String))) {
            throw new Error("ERROR! Hatch language must be specified!");
        }

        this._name = name;
        this._language = language;
        this._path = `hatch_${this._name.toLowerCase()}_${getTimestamp()}`;

        options.argv = options.argv || process.argv.slice(2)
        options = Object.assign(options, this._parse_argv(options.argv));

        this._path = options.path || this._path;
        this._is_exporting_tgz = !options.no_tgz;

        if (!fs.existsSync(this._path)) {
            fs.mkdirSync(this._path, 0o775);
        }
    }

    // XXX: This allows us to pass params from SOMA worker
    //      directly into libingester with minimal changes
    //      to the actual ingester.
    // TODO: Do this generic when we have more args
    _parse_argv(argv) {
        let options = {};
        if (argv instanceof Array) {
            const path_index = argv.indexOf('--path');
            if (path_index >= 0 &&
                path_index < argv.length + 1) {
                options.path = argv[path_index + 1];
            }

            const no_tgz = argv.indexOf('--no-tgz');
            if (no_tgz >= 0) {
                options.no_tgz = true;
            }
        }

        return options;
    }

    is_exporting_tgz() {
      return this._is_exporting_tgz;
    }

    get_language() { return this._language; }
    get_name() { return this._name; }
    get_path() { return this._path; }

    _validate_asset_references() {
        // Assure that all outgoing edges are satisfied.

        // Outgoing edges.
        const outgoing = new Set();

        // Node labels
        const asset_ids = new Set();

        this._assets.forEach((asset) => {
            asset_ids.add(asset.asset_id);
            for (let outgoing_asset_id of asset.get_dependent_assets())
                outgoing.add(outgoing_asset_id);
        });
        this._videos.forEach((video) => {
            asset_ids.add(video.asset_id);
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

        // Sanity check the entries
        assets.forEach(verify.verify_manifest_entry);

        const manifest = { name: this._name,
                           language: this._language,
                           assets: assets,
                           videos: this._videos };
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
        })
        .then(() => {
            console.log('hatch: exporting hatch manifest...');
            return this._save_hatch_manifest();
        })
        .then(() => {
            console.log('hatch: creating hatch tarball...');

            // If we only are saving the dir, we return the path
            if (!this._is_exporting_tgz) {
              return this._path;
            }

            return this._create_hatch_archive();
        })
        .then((tarballPath) => {
            console.log(`hatch: finished, saved to ${tarballPath}`);
        })
        .catch((err) => {
          console.error(err.stack);
          throw err;
        });
    }

    save_asset(asset) {
        asset._save_to_hatch(this);
    }

    copy_to_directory(directory) {
        return fs.copy(this._path, directory);
    }

    copy_to_s3(bucket) {
        const hatch_id = path.basename(this._path);

        /* XXX: Configure this to use us-west-2 */
        const s3 = new aws.S3();

        let targetBucket = this._get_default_bucket();
        if (bucket) {
            targetBucket = bucket;
        }

        return fs.readdir(this._path).then((files) => {
            const promises = files.map((filename) => {
                const full_path = path.join(this._path, filename);
                return fs.readFile(full_path).then((contents) => {
                    return s3.putObject({
                        Bucket: targetBucket,
                        Key: `${hatch_id}/${filename}`,
                        Body: contents,
                    }).promise();
                });
            });

            return Promise.all(promises);
        }).then(() => {
            console.log(`Hatch copied to http://${targetBucket}.s3.amazonaws.com/${hatch_id}`);
        });
    }
}

exports.Hatch = Hatch;

exports.util = require('./util');
