'use strict';

const fs = require('fs');
const expect = require('chai').expect;

const libingester = require('../../lib/index');

describe('Hatch', function() {
    let hatch;

    afterEach(() => {
        if (fs.existsSync(hatch.get_path())) {
            fs.rmdirSync(hatch.get_path());
        }
    });

    describe('required params', function() {
        it('can return path of hatch', function() {
            hatch = new libingester.Hatch("abcd", "en");
            expect(hatch.get_path()).to.match(/hatch_abcd_[0-9_]+/);
        });

        it('can return the name of hatch', function() {
            hatch = new libingester.Hatch("testing", "en");
            expect(hatch.get_name()).to.equal("testing");
        });

        it('can return the language of hatch', function() {
            hatch = new libingester.Hatch("abcd", "something");
            expect(hatch.get_language()).to.equal("something");
        });

        it('can be forced to use specific path', function() {
            hatch = new libingester.Hatch("abcd", "en", { path: "./foo_bar_baz" });
            expect(hatch.get_path()).to.match(/foo_bar_baz/);
        });

        it('requires name and lang parameters to instantiate', function() {
            expect(() => { new libingester.Hatch() }).to.throw();
            expect(() => { new libingester.Hatch("abcd") }).to.throw();
        });

        // XXX: This is to ensure that v2-converted ingesters know that they
        //      need to use the newer api.
        it('requires second param to be a string', function() {
            expect(() => { new libingester.Hatch("abcd", { foo: "bar" }) }).to.throw();
        });
    });

    describe('argv no-tgz option', function() {
        it('does not blow up when no-tgz arg is missing', function() {
            // Implicit non-exception
            hatch = new libingester.Hatch("aacd", "en", { argv: ["--tgz", "/some/path"] });
        });

        it('does not blow up when no-tgz arg is at the end', function() {
            // Implicit non-exception
            hatch = new libingester.Hatch("abad", "en", { argv: ["/blah", "--no-tgz"] });
        });

        it('does not blow up when no-tgz arg is at the end', function() {
            // Implicit non-exception
            hatch = new libingester.Hatch("abbd", "en", { argv: ["/blah", "--no-tgz"] });
        });

        it('does not skip tgz by default', function() {
            hatch = new libingester.Hatch("aaaa", "en", { argv: ["/blah"] });
            expect(hatch.is_exporting_tgz()).to.be.equal(true);

            return hatch.finish().then(() => {
                expect(fs.existsSync(`${hatch.get_path()}.tar.gz`)).to.be.equal(true);

                fs.unlinkSync(`${hatch.get_path()}/hatch_manifest.json`);
                fs.unlinkSync(`${hatch.get_path()}.tar.gz`);
            });
        });

        it('skip tgz if flag set', function() {
            hatch = new libingester.Hatch("abce", "en", { argv: ["/blah", "--no-tgz"] });
            expect(hatch.is_exporting_tgz()).to.be.equal(false);

            return hatch.finish().then(() => {
                expect(fs.existsSync(`${hatch.get_path()}.tar.gz`)).to.be.equal(false);

                fs.unlinkSync(`${hatch.get_path()}/hatch_manifest.json`);
            });
        });
    });

    describe('argv path option', function() {
        it('does not blow up when path arg is not there', function() {
            // Implicit non-exception
            hatch = new libingester.Hatch("abcd", "en", { argv: ["--foo", "/some/path"] });
        });

        it('can process path correctly from passed in argv', function() {
            hatch = new libingester.Hatch("abcd", "en", { argv: ["--path", "./hatch_foo"] });
            expect(hatch.get_path()).to.equal("./hatch_foo");
        });

        it('does not break if invalid arg position', function() {
            hatch = new libingester.Hatch("abcd", "en", { argv: ["foo", "--path"] });
            expect(hatch.get_path()).to.match(/hatch_abcd_[0-9_]+/);
        });

        it('creates the directory path if missing', function() {
            const targetDir = "./abcdefg";
            if (fs.existsSync(targetDir)) {
                fs.rmdirSync(targetDir);
            }

            expect(fs.existsSync(targetDir)).to.be.equal(false);

            hatch = new libingester.Hatch("abcd", "en", { argv: ["--path", targetDir] });
            expect(fs.lstatSync(targetDir).isDirectory()).to.be.equal(true);
        });

        it('does not break if directory is already there', function() {
            const targetDir = "./abcdefg2";
            if (fs.existsSync(targetDir)) {
                fs.rmdirSync(targetDir);
            }
            fs.mkdirSync(targetDir, 0o775);

            expect(fs.lstatSync(targetDir).isDirectory()).to.be.equal(true);

            hatch = new libingester.Hatch("abcd", "en", { argv: ["--path", targetDir] });
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
