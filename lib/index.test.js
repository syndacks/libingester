'use strict';

const pillowfort = require('./index');

describe('ImageAsset', function() {
    it('can serialize out correctly', function() {
        const asset = new pillowfort.ImageAsset();
        asset.set_title('Test Asset');
        asset.set_license('Proprietary');
        asset.set_canonical_uri('https://www.example.com/');
        asset.set_last_modified_date(new Date(2017, 2, 31));
        asset.set_image_data('image/jpeg', 'asdf');

        const metadata = asset._to_metadata();

        // Remove randomness -- should probably be a mock if I can
        // figure out how to use it.
        delete metadata['assetID'];

        expect(metadata).toEqual({
            "objectType": 'ImageObject',
            "contentType": 'image/jpeg',

            "canonicalURI": 'https://www.example.com/',
            "matchingLinks": [ 'https://www.example.com/' ],

            "title": 'Test Asset',
            "license": 'Proprietary',
            "tags": [],
            "lastModifiedDate": '2017-03-31T07:00:00.000Z',
            "revisionTag": '2017-03-31T07:00:00.000Z',
        });

        const data = asset._to_data();
        expect(data).toEqual('asdf');
    });
});
