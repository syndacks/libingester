'use strict';

const util = require('./util');

describe('encode_uri', function() {
    it('encodes URIs correctly', function() {
        // Normal URIs aren't touched.
        expect(util.encode_uri(
            'https://en.wikipedia.org/wiki/Abraham_Lincoln')).toEqual(
            'https://en.wikipedia.org/wiki/Abraham_Lincoln');

        expect(util.encode_uri(
            'https://en.wikipedia.org/w/api.php?action=query&titles=Abraham_Lincoln')).toEqual(
            'https://en.wikipedia.org/w/api.php?action=query&titles=Abraham_Lincoln');

        // Percent-encoded URIs aren't touched.
        expect(util.encode_uri(
            'https://en.wikipedia.org/w/api.php?action=query&titles=Abraham%20Lincoln')).toEqual(
            'https://en.wikipedia.org/w/api.php?action=query&titles=Abraham%20Lincoln');

        // Unicode URIs are encoded properly.
        expect(util.encode_uri(
            'https://en.wikipedia.org/wiki/Merkle–Damgård_construction')).toEqual(
            'https://en.wikipedia.org/wiki/Merkle%E2%80%93Damg%C3%A5rd_construction');

        // Check that we punycode URIs.
        expect(util.encode_uri(
            'http://☃.com/foo.png')).toEqual(
            'http://xn--n3h.com/foo.png');

        // Ensure we can handle file:/// URIs and URIs with empty netlocs.
        expect(util.encode_uri('file:///foo/bar')).toEqual('file:///foo/bar');
        expect(util.encode_uri('file://./foo/bar')).toEqual('file://./foo/bar');
    });
});
