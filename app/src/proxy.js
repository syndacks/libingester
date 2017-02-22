
const http = require('http');
const httpProxy = require('http-proxy');
const url = require('url');

// Ignore the path to make our parsing easier.
const proxy = httpProxy.createProxyServer({ changeOrigin: true, ignorePath: true, secure: false });

proxy.on('proxyRes', (proxyRes, req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
});

const server = http.createServer(function(req, res) {
    try {
        const target = url.parse(req.url, true).query.target;

        // target is a URL like http://example.com/foo
        const parsedTarget = url.parse(target);

        req.url = parsedTarget.path;
        proxy.web(req, res, { target: target });
    } catch(e) {
        console.error(e);
        res.writeHead(500);
        res.end();
    }
});

server.listen(10023);
