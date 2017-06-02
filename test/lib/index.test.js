'use strict';

const fs = require('fs');
const expect = require('chai').expect;

const libingester = require('../../lib/index');

describe('Hatch', function() {
    it('can return path of hatch', function() {
        const hatch = new libingester.Hatch("abcd");
        expect(hatch.get_path()).to.match(/hatch_abcd_[0-9_]+/);

        fs.rmdirSync(hatch.get_path());
    });

    it('can be forced to use a specific path', function() {
        const hatch = new libingester.Hatch("abcd", { path: "./foo_bar_baz" });
        expect(hatch.get_path()).to.match(/foo_bar_baz/);

        fs.rmdirSync(hatch.get_path());
    });

    describe('argv path option', function() {
        it('does not blow up when path arg is not there', function() {
            // Implicit non-exception
            const hatch = new libingester.Hatch("abcd", { argv: ["--foo", "/some/path"] });
            fs.rmdirSync(hatch.get_path());
        });

        it('can process path correctly from passed in argv', function() {
            const hatch = new libingester.Hatch("abcd", { argv: ["--path", "./hatch_foo"] });
            expect(hatch.get_path()).to.equal("./hatch_foo");

            fs.rmdirSync(hatch.get_path());
        });

        it('does not break if invalid arg position', function() {
            const hatch = new libingester.Hatch("abcd", { argv: ["foo", "--path"] });
            expect(hatch.get_path()).to.match(/hatch_abcd_[0-9_]+/);

            fs.rmdirSync(hatch.get_path());
        });

        it('creates the directory path if missing', function() {
            const targetDir = "./abcdefg";
            if (fs.existsSync(targetDir)) {
                fs.rmdirSync(targetDir);
            }

            expect(fs.existsSync(targetDir)).to.be.falsey;

            const hatch = new libingester.Hatch("abcd", { argv: ["--path", targetDir] });
            expect(fs.lstatSync(targetDir).isDirectory()).to.be.truthy;

            fs.rmdirSync(targetDir);
        });

        it('does not break if directory is already there', function() {
            const targetDir = "./abcdefg2";
            if (fs.existsSync(targetDir)) {
                fs.rmdirSync(targetDir);
            }
            fs.mkdirSync(targetDir, 0o775);

            expect(fs.lstatSync(targetDir).isDirectory()).to.be.truthy;

            const hatch = new libingester.Hatch("abcd", { argv: ["--path", targetDir] });

            fs.rmdirSync(targetDir);
        });
    });
});

describe('ImageAsset', function() {
    it('can serialize out correctly', function() {
        const asset = new libingester.ImageAsset();
        const thumbnail_asset = new libingester.ImageAsset();
        asset.set_title('Test Asset');
        asset.set_synopsis('Test Asset synopsis');
        asset.set_thumbnail(thumbnail_asset);
        asset.set_license('Proprietary');
        asset.set_canonical_uri('https://www.example.com/');
        asset.set_last_modified_date(new Date(1492545280000));
        asset.set_image_data('image/jpeg', 'asdf');

        const metadata = asset.to_metadata();

        // Check that asset ID and thumbnail asset ID are passed through
        expect(metadata['assetID']).to.equal(asset.asset_id);
        expect(metadata['thumbnail']).to.equal(thumbnail_asset.asset_id);
        // Remove the ID fields before checking the rest
        delete metadata['assetID'];
        delete metadata['thumbnail'];

        expect(metadata).to.deep.equal({
            "objectType": 'ImageObject',
            "contentType": 'image/jpeg',

            "canonicalURI": 'https://www.example.com/',
            "matchingLinks": [ 'https://www.example.com/' ],

            "title": 'Test Asset',
            "synopsis": 'Test Asset synopsis',
            "license": 'Proprietary',
            "tags": [],
            "lastModifiedDate": '2017-04-18T19:54:40.000Z',
            "revisionTag": '2017-04-18T19:54:40.000Z',
        });

        const data = asset.to_data();
        expect(data).to.equal('asdf');
    });
});

describe('NewsAsset', function() {
    it('can serialize out correctly', function() {
        const asset = new libingester.NewsArticle();
        asset.set_title('Test Asset');
        asset.set_license('Proprietary');
        asset.set_canonical_uri('https://www.example.com/');
        asset.set_last_modified_date(new Date(1492545280000));
        asset.set_document('<h1>Word of the Day</h1>');
        asset.set_section("word_of_day");
        asset.set_synopsis('a long time ago...');
        asset.set_as_static_page();

        const metadata = asset.to_metadata();

        // Remove randomness -- should probably be a mock if I can
        // figure out how to use it.
        delete metadata['assetID'];

        expect(metadata).to.deep.equal({
            "objectType": 'ArticleObject',
            "contentType": 'text/html',

            "canonicalURI": 'https://www.example.com/',
            "matchingLinks": [ 'https://www.example.com/' ],

            "title": 'Test Asset',
            "license": 'Proprietary',
            "tags": ["word_of_day", "EknStaticTag"],
            "document": '<h1>Word of the Day</h1>',
            "synopsis": 'a long time ago...',
            "lastModifiedDate": '2017-04-18T19:54:40.000Z',
            "revisionTag": '2017-04-18T19:54:40.000Z',
        });
    });
});
