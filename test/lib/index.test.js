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


    describe('argv no-tgz option', function() {
        it('does not blow up when no-tgz arg is missing', function() {
            // Implicit non-exception
            const hatch = new libingester.Hatch("aacd", { argv: ["--tgz", "/some/path"] });
            fs.rmdirSync(hatch.get_path());
        });

        it('does not blow up when no-tgz arg is at the end', function() {
            // Implicit non-exception
            const hatch = new libingester.Hatch("abad", { argv: ["/blah", "--no-tgz"] });
            fs.rmdirSync(hatch.get_path());
        });

        it('does not blow up when no-tgz arg is at the end', function() {
            // Implicit non-exception
            const hatch = new libingester.Hatch("abbd", { argv: ["/blah", "--no-tgz"] });
            fs.rmdirSync(hatch.get_path());
        });

        it('does not skip tgz by default', function() {
            const hatch = new libingester.Hatch("aaaa", { argv: ["/blah"] });
            expect(hatch.is_exporting_tgz()).to.be.equal(true);

            return hatch.finish().then(() => {
                console.log(`${hatch.get_path()}.tar.gz`);
                expect(fs.existsSync(`${hatch.get_path()}.tar.gz`)).to.be.equal(true);

                fs.unlinkSync(`${hatch.get_path()}/hatch_manifest.json`);
                fs.rmdirSync(hatch.get_path());
            });
        });

        it('skip tgz if flag set', function() {
            const hatch = new libingester.Hatch("abce", { argv: ["/blah", "--no-tgz"] });
            expect(hatch.is_exporting_tgz()).to.be.equal(false);

            return hatch.finish().then(() => {
                expect(fs.existsSync(`${hatch.get_path()}.tar.gz`)).to.be.equal(false);

                fs.unlinkSync(`${hatch.get_path()}/hatch_manifest.json`);
                fs.rmdirSync(hatch.get_path());
            });
        });
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

            expect(fs.existsSync(targetDir)).to.be.equal(false);

            const hatch = new libingester.Hatch("abcd", { argv: ["--path", targetDir] });
            expect(fs.lstatSync(targetDir).isDirectory()).to.be.equal(true);

            fs.rmdirSync(targetDir);
        });

        it('does not break if directory is already there', function() {
            const targetDir = "./abcdefg2";
            if (fs.existsSync(targetDir)) {
                fs.rmdirSync(targetDir);
            }
            fs.mkdirSync(targetDir, 0o775);

            expect(fs.lstatSync(targetDir).isDirectory()).to.be.equal(true);

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

describe('BlogArticle', function() {
    let asset;

    beforeEach(function() {
        asset = new libingester.BlogArticle();
        asset.set_title('Test Asset');
        asset.set_license('Proprietary');
        asset.set_canonical_uri('https://www.example.com/');
        asset.set_last_modified_date(new Date(1492545280000));
        asset.set_synopsis('a long time ago...');
        asset.set_body('<h1>Word of the Day</h1>');
        asset.set_author('Coco');
        asset.set_date_published(new Date(1492545280000));
        asset.set_read_more_text('More!');
        asset.set_tags(['some', 'tags']);
        asset.set_as_static_page();
    });

    it('can serialize out correctly', function() {
        asset.render();

        const metadata = asset.to_metadata();

        delete metadata['assetID'];

        expect(metadata['document']).to.contain('<h1>Word of the Day</h1>');
        expect(metadata['document']).to.contain('More!');
        // Match at least one CSS rule despite no custom SCSS
        expect(metadata['document']).to.match(/<style(.|\n)*{(.|\n)*:(.|\n)*}(.|\n)*<\/style>/);
        delete metadata['document'];

        expect(metadata).to.deep.eql({
            "objectType": 'ArticleObject',
            "contentType": 'text/html',

            "canonicalURI": 'https://www.example.com/',
            "matchingLinks": [ 'https://www.example.com/' ],

            "title": 'Test Asset',
            "license": 'Proprietary',
            "tags": ["some", "tags", "EknStaticTag"],
            "synopsis": 'a long time ago...',
            "lastModifiedDate": '2017-04-18T19:54:40.000Z',
            "revisionTag": '2017-04-18T19:54:40.000Z',

            "authors": ['Coco'],
            "published": '2017-04-18T19:54:40.000Z',
        });
    });

    it('renders the custom stylesheet', function() {
        asset.set_custom_scss('@import "_default"; * { color:red; }');
        asset.render();

        const metadata = asset.to_metadata();
        // Regex handles how libsass might minify the rendered CSS
        expect(metadata['document']).to.match(/\*\s*{\s*color:\s*red;?\s*}/);
    });
});

describe('NewsAsset', function() {
    let asset;

    beforeEach(function () {
        asset = new libingester.NewsArticle();
        asset.set_title('Test Asset');
        asset.set_license('Proprietary');
        asset.set_canonical_uri('https://www.example.com/');
        asset.set_last_modified_date(new Date(1492545280000));
        asset.set_body('<h1>Word of the Day</h1>');
        asset.set_section("word_of_day");
        asset.set_synopsis('a long time ago...');
        asset.set_as_static_page();
        asset.set_authors(['Merriam', 'Webster']);
        asset.set_source('Dictionary');
        asset.set_date_published(new Date(1492545280000));
        asset.set_read_more_link('More!');
        asset.set_lede('<p>Exciting paragraph</p>');
    });

    it('can serialize out correctly', function() {
        asset.render();

        const metadata = asset.to_metadata();

        // Remove randomness -- should probably be a mock if I can
        // figure out how to use it.
        delete metadata['assetID'];

        expect(metadata['document']).to.contain('<h1>Word of the Day</h1>');
        expect(metadata['document']).to.contain('More!');
        expect(metadata['document']).to.contain('<p>Exciting paragraph</p>');
        delete metadata['document'];

        expect(metadata).to.deep.eql({
            "objectType": 'ArticleObject',
            "contentType": 'text/html',

            "canonicalURI": 'https://www.example.com/',
            "matchingLinks": [ 'https://www.example.com/' ],

            "title": 'Test Asset',
            "license": 'Proprietary',
            "tags": ["word_of_day", "EknStaticTag"],
            "synopsis": 'a long time ago...',
            "lastModifiedDate": '2017-04-18T19:54:40.000Z',
            "revisionTag": '2017-04-18T19:54:40.000Z',

            "authors": ['Merriam', 'Webster'],
            "sourceName": 'Dictionary',
            "published": '2017-04-18T19:54:40.000Z',
        });
    });

    it('renders the default stylesheet if no custom SCSS set', function () {
        asset.render();

        const metadata = asset.to_metadata();

        // Match at least one CSS rule despite no custom SCSS
        expect(metadata['document']).to.match(/<style(.|\n)*{(.|\n)*:(.|\n)*}(.|\n)*<\/style>/);
    });

    it('renders the custom SCSS', function () {
        asset.set_custom_scss('@import "_default"; * { color:red; }');
        asset.render();

        const metadata = asset.to_metadata();
        // Regex handles how libsass might minify the rendered CSS
        expect(metadata['document']).to.match(/\*\s*{\s*color:\s*red;?\s*}/);
    });
});
