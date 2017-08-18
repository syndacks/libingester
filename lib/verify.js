'use strict';

const Validator = require('validator');
const FileType = require('file-type');

const MAX_TITLE_LENGTH = 140;

class VerificationError extends Error {
}

function assert(value, message) {
    if (!value)
        throw new VerificationError(`${message}: ${value}`);
}

function verify_metadata(metadata) {
    let object_type = metadata['objectType'];

    assert((metadata['assetID'].length === 40), "Asset has invalid assetID");
    assert(typeof metadata['canonicalURI'] === "string", "Asset has invalid canonicalURI");
    assert(typeof metadata['contentType'] === "string", "Asset has invalid contentType");

    assert(!!metadata['matchingLinks'], "Asset missing matchingLinks");
    assert(metadata['matchingLinks'].every((s) => (typeof s === "string")), "Some asset matching URIs are not strings");

    assert(!!metadata['tags'], "Asset missing tags");
    assert(metadata['tags'].every((s) => (typeof s === "string")), "Some asset tags are not strings");

    assert(!!metadata['revisionTag'], "Asset missing revisionTag");

    if (object_type === 'ArticleObject') {
        // XXX: This should be really attached to stuff that can show up in sets / search
        assert(!!metadata['title'], "metadata missing title");
        if (metadata['title'].length > MAX_TITLE_LENGTH) {
            console.warn(`WARNING: Found a really long title! "${metadata['title'].length}"`);
        }
        assert(!!metadata['document'], "metadata missing document");
        assert(metadata['document'].length > 0, "document is empty");
    } else if (object_type === 'ImageObject') {
        assert(!!metadata['cdnFilename'], "Image object missing cdnFilename (has no data?)");
    } else if (object_type === "DictionaryObjectModel") {
        assert(!!metadata['word'], "metadata missing word");
        assert(!!metadata['definition'], "metadata missing definition");
    } else {
        throw new VerificationError("metadata has wrong objectType");
    }
}

exports.verify_metadata = verify_metadata;

function verify_manifest_entry (entry) {
    assert(Validator.isURL(entry.uri));
}

exports.verify_manifest_entry = verify_manifest_entry;

function verify_image_data (data) {
    const type = FileType(data);
    assert(!!type, `couldn't detect mimetype of image data ${data}`);
    assert(type.mime.startsWith('image/'), "data is not an image");
}

exports.verify_image_data = verify_image_data;
