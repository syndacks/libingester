'use strict';

const expect = require('chai').expect;

const libingester = require('../../lib/index');

describe('ImageAsset', function() {
    it('can serialize out correctly', function() {
        const asset = new libingester.ImageAsset();
        asset.set_title('Test Asset');
        asset.set_license('Proprietary');
        asset.set_canonical_uri('https://www.example.com/');
        asset.set_last_modified_date(new Date(1492545280000));
        asset.set_image_data('image/jpeg', 'asdf');

        const metadata = asset.to_metadata();

        // Remove randomness -- should probably be a mock if I can
        // figure out how to use it.
        delete metadata['assetID'];

        expect(metadata).to.deep.equal({
            "objectType": 'ImageObject',
            "contentType": 'image/jpeg',

            "canonicalURI": 'https://www.example.com/',
            "matchingLinks": [ 'https://www.example.com/' ],

            "title": 'Test Asset',
            "license": 'Proprietary',
            "tags": [],
            "lastModifiedDate": '2017-04-18T19:54:40.000Z',
            "revisionTag": '2017-04-18T19:54:40.000Z',
        });

        const data = asset.to_data();
        expect(data).to.equal('asdf');
    });
});
