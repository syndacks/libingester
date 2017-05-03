'use strict';

const expect = require('chai').expect;
const fs = require('fs');

const util = require('../../lib/util');

describe('encode_uri', function() {
    it('encodes URIs correctly', function() {
        // Normal URIs aren't touched.
        expect(util.encode_uri(
            'https://en.wikipedia.org/wiki/Abraham_Lincoln')).to.equal(
            'https://en.wikipedia.org/wiki/Abraham_Lincoln');

        expect(util.encode_uri(
            'https://en.wikipedia.org/w/api.php?action=query&titles=Abraham_Lincoln')).to.equal(
            'https://en.wikipedia.org/w/api.php?action=query&titles=Abraham_Lincoln');

        // Percent-encoded URIs aren't touched.
        expect(util.encode_uri(
            'https://en.wikipedia.org/w/api.php?action=query&titles=Abraham%20Lincoln')).to.equal(
            'https://en.wikipedia.org/w/api.php?action=query&titles=Abraham%20Lincoln');

        // Unicode URIs are encoded properly.
        expect(util.encode_uri(
            'https://en.wikipedia.org/wiki/Merkle–Damgård_construction')).to.equal(
            'https://en.wikipedia.org/wiki/Merkle%E2%80%93Damg%C3%A5rd_construction');

        // Check that we punycode URIs.
        expect(util.encode_uri(
            'http://☃.com/foo.png')).to.equal(
            'http://xn--n3h.com/foo.png');

        // Ensure we can handle file:/// URIs and URIs with empty netlocs.
        expect(util.encode_uri('file:///foo/bar')).to.equal('file:///foo/bar');
        expect(util.encode_uri('file://./foo/bar')).to.equal('file://./foo/bar');
    });
});

describe('download_image', function() {
    it('can handle downloading a regular src image', function() {
        let image_tag = "<img src=\"https://endlessos.com/wp-content/uploads/2016/05/Home_Video@2x.jpg\">test</img>";

        const asset = util.download_img(image_tag, '');
        expect(asset.asset_id).is.not.null;
        expect(asset.asset_id).is.not.undefined;
        expect(asset._image_data).is.not.null;
    });

    describe('data urls', function() {
        it('can handle png urls correctly', function() {
            let imageUrl = fs.readFileSync(__dirname + '/test_files/base64_encoded_image.png.txt');
            let image = fs.readFileSync(__dirname + '/test_files/base64_encoded_image.png');

            // We want this as a string
            imageUrl = imageUrl.toString();

            if (imageUrl == undefined || imageUrl.length <= 0 ||
                image == undefined || image.length <= 0) {
              throw new Error("Invalid data loaded from test image");
            }

            let image_tag = "<img src=" + imageUrl + ">test</img>";

            const asset = util.download_img(image_tag, '');
            expect(asset.asset_id).is.not.null;
            expect(asset.asset_id).is.not.undefined;
            expect(asset._image_data).to.deep.equal(image);
            expect(asset._content_type).to.equal('image/png');
        });

        it('can handle jpeg urls correctly', function() {
            let imageUrl = fs.readFileSync(__dirname + '/test_files/base64_encoded_image.jpeg.txt');
            let image = fs.readFileSync(__dirname + '/test_files/base64_encoded_image.jpeg');

            // We want this as a string
            imageUrl = imageUrl.toString();

            if (imageUrl == undefined || imageUrl.length <= 0 ||
                image == undefined || image.length <= 0) {
              throw new Error("Invalid data loaded from test image");
            }

            let image_tag = "<img src=" + imageUrl + ">test</img>";

            const asset = util.download_img(image_tag, '');
            expect(asset.asset_id).is.not.null;
            expect(asset.asset_id).is.not.undefined;
            expect(asset._image_data).to.deep.equal(image);
            expect(asset._content_type).to.equal('image/jpeg');
        });
    });
});
