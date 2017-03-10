'use strict';

const verify = require('./verify');

const basic_metadata = {
    "assetID": "03d9d97e112b3b4513d246bda42c853656f200e8",
    "objectType": "ImageObject",
    "contentType": "image/jpeg;charset=UTF-8",
    "canonicalURI": "https://stillmed.olympic.org/media/Videos/2012/06/29/Flying%20Finn%20Ritola%20signs%20off%20with%20fifth%20gold/Flying%20Finn%20Ritola%20signs%20off%20with%20fifth%20gold_thumbnail.jpg?interpolation=lanczos-none&resize=*:185",
    "matchingLinks": [
        "https://stillmed.olympic.org/media/Videos/2012/06/29/Flying%20Finn%20Ritola%20signs%20off%20with%20fifth%20gold/Flying%20Finn%20Ritola%20signs%20off%20with%20fifth%20gold_thumbnail.jpg?interpolation=lanczos-none&resize=*:185"
    ],
    "tags": [],
    "lastModifiedDate": "2017-03-10T23:25:20.765Z",
    "revisionTag": "2017-03-10T23:25:20.765Z",
    "cdnFilename": "03d9d97e112b3b4513d246bda42c853656f200e8.data",
};

describe('verify', function() {
    it('passes real metadata correctly', function() {
        expect(() => (verify.verify_metadata(basic_metadata))).not.toThrow();
    });

    it('fails fake metadata', function() {
        expect(() => (verify.verify_metadata({}))).toThrow();
    });

    it('tests asset IDs correctly', function() {
        const fake_id_metadata = Object.assign({}, basic_metadata, { "assetID": "12345" });
        expect(() => (verify.verify_metadata(fake_id_metadata))).toThrow();
    });

    it('tests tags correctly', function() {
        const bad_tags_metadata = Object.assign({}, basic_metadata, { "tags": [ ["A", "B"] ] });
        expect(() => (verify.verify_metadata(fake_id_metadata))).toThrow();
    });
});
