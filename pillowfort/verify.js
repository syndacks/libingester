
class VerificationError extends Error {
}

function assert(value, message) {
    if (!value)
        throw new VerificationError(message);
}

function verify_metadata(metadata) {
    let object_type = metadata['objectType'];

    assert(!!metadata['assetID'], "metadata missing assetID");
    assert(!!metadata['canonicalURI'], "metadata missing canonicalURI");
    assert(!!metadata['matchingLinks'], "metadata missing matchingLinks");
    assert(!!metadata['contentType'], "metadata missing contentType");

    if (object_type === 'ArticleObject') {
        assert(!!metadata['title'], "metadata missing title");
    } else if (object_type === 'ImageObject') {
        //
    } else {
        throw new VerificationError("metadata has wrong objectType");
    }
}

exports.verify_metadata = verify_metadata;
