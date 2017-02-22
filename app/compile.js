
const fs = require('fs');
const babel = require('babel-core');

const input = fs.readFileSync(process.argv[2]);

function collectImports(input) {
    const imports = new Set();
    babel.transform(input, {
        presets: ['es2015'],
        ast: false,
        code: false,
        resolveModuleSource: function(module) { imports.add(module); },
    });
    return imports;
}

// const imports = collectImports(input);

function compileSystemJS(input) {
    const res = babel.transform(input, {
        presets: ['es2015'],
        plugins: ['transform-es2015-modules-systemjs'],
        ast: false,
    });
    return res.code;
}

console.log(compileSystemJS(input));
