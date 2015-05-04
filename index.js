'use strict';

module.exports = function (settings) {
    var path = require('path');
    var browserify = require('browserify');
    var streamifier = require('streamifier');
    var browserResolve = require('browser-resolve-noio');
    var Promise = require('bluebird');
    var cwd = process.cwd();

    var transforms;
    if (settings.transform) {
        transforms = settings.transform;
        if (!Array.isArray(transforms)) transforms = [transforms];
    }
    else transforms = [];

    // promise-getter to load all the transforms once
    var getTransforms = (function () {
        var promise;

        return function () {
            if (!promise) {
                var requireResolve = require('browser-resolve-noio/node_modules/resolve');
                promise = Promise.all(transforms.map(function (transform) {
                    // return a promise to load this particular transform module
                    return new Promise(function (resolve, reject) {
                        // resolve with the actual required module.
                        if (typeof transform === 'function') {
                            // no need to do anything - this one appears to be an already-loaded module.
                            resolve(transform);
                        }
                        else if (typeof transform === 'string') {
                            requireResolve(transform, {basedir: cwd}, function (err, modulePath) {
                                if (err) {
                                    // failed to resolve eg "coffeeify" to a full system path.
                                    var loadError = new Error(
                                        'Could not find a browserify transform named "' +
                                        transform + '" - is it installed?'
                                    );
                                    loadError.originalError = err;
                                    reject(loadError);
                                }
                                else {
                                    // require() the module path
                                    var module;
                                    try { module = require(modulePath); }
                                    catch (err) { return reject(err); }

                                    resolve(modulePath);
                                }
                            });
                        }
                        else {
                            reject(new TypeError('Unexpected type for browserify transform: ' + typeof transform));
                        }
                    });
                }));
            }

            return promise;
        };
    })();

    var log;
    if (!settings.debugLog) log = function () {};
    else log = function () {
        var args = [].slice.call(arguments);
        args.unshift('exhibit-browserify:');
        console.log.apply(null, args);
    };

    // cache all deps whenever they appear
    var packageCache = {};
    var cache = {}; // will contain dep objects, which already have transforms applied

    return function (file, triggers, done) {
        log('processing file: ', file);
        log('triggers: ', triggers ? triggers.join(', ') : typeof triggers);

        var self = this;

        log('cache keys:\n', Object.keys(cache));

        // delete the trigger file(s) from the cache
        if (triggers) {
            triggers.forEach(function (trigger) {
                // console.log('TRIGGER', self.sourceDir);
                trigger = path.resolve(self.sourceDir, trigger); // todo: using exhibit-provided method?

                if (cache[trigger]) {
                    log('AM PURGING', trigger);
                    delete cache[trigger];
                }
                else {
                    log('NOT PURGING:', trigger);
                }
            });
        }

        // make a phoney absolute path
        // var relPath = path.join(self.sourceDir, file.path);
        // var numDirectoryParts = process.cwd().split(path.sep).length;
        // var fakeBase = '';
        // for (var i = 1; i < numDirectoryParts; i++) {
        //     fakeBase = path.join(fakeBase, '_');
        // }
        // fakeBase = path.join('/_fake_', fakeBase); // maybe do x:\ on windows?
        // var fullPath = path.join(fakeBase, self.sourceDir, file.path);

        var fullPath = path.resolve(self.sourceDir, file.path);

        var stream = streamifier.createReadStream(file.contents);

        // just hang the file path on the stream object - this is undocumented but seems to be how watchify does it
        stream.file = fullPath; // https://github.com/substack/node-browserify/issues/816
        // stream.file = relPath;

        var b = browserify({
            extensions: settings.extensions,
            basedir: process.cwd(),
            cache: cache,
            packageCache: packageCache,
            debug: settings.sourcemap,
            noParse: settings.noParse,
            fullPaths: true
        });

        // monkey patch the browserify pipeline's module-deps instance
        // with new resolver and readFile methods
        (function () {
            var mdeps = b.pipeline.get('deps')._streams[0];

            // make the resolver function diskless
            mdeps.resolver = function (id, parent, cb) {
                var extend = require('xtend');

                var options = extend(parent, {
                    isFile: function (filePath, cb) {
                        log('ISFILECALLED', filePath);
                        // make it back into a relative path
                        // filePath = path.relative(fakeBase, filePath);
                        self.isFile(filePath, function (err, answer) {
	                        log('ISFILE', filePath, err, answer);
                        	cb(err, answer);
                        });
                    },
                    readFile: function (filePath, encoding, cb) {
                        log('READFILECALLED', filePath);
                        // filePath = path.relative(fakeBase, filePath);
                        self.readFile(filePath, encoding, cb);
                    }
                });

                browserResolve(id, options, function (err, path) {
                    // if (err) console.log('WARNING did not resolve', id, err);

                    cb(err, path);
                });
            };
        })();

        // apply all the transforms (after resolving them into actual modules)
        getTransforms().then(function (transforms) {
            // `transforms` is an array of fully loaded modules.
            log('__transforms', transforms[0]);

            transforms.map(function (transform) {
                b.transform(transform);
            });

            b.on('package', function (pkg) {
                log('on package!', pkg.name);
                packageCache[path] = pkg;
            });

            b.on('dep', function (dep) {
                log('on dep!', dep.id, dep.file, dep.source.length + ' chrs');
                cache[dep.id] = dep;
            });

            b.add(stream);

            b.bundle(function (err, bundledContents) {
                if (err) {
                    console.log('BROWSERIFY BUNDLING ERROR!', err.message, Object.keys(err));

                    // if browserify provided filepath/linenumber details, try to read the file
                    var relativePath;
                    var gotFile = new Promise(function (resolve) {
                        if (!err.filename) return resolve(false);

                        relativePath = path.relative(self.sourceDir, err.filename);
                        // console.log('LOADING', relativePath);

                        // we have to read the file again :(
                        self.readFile(relativePath, function (readErr, contents) {
                            if (readErr || (contents === false)) {
                                console.log('readErr', readErr);
                                return resolve(false);
                            }

                            return resolve(contents);
                        });
                    });

                    gotFile.then(function (contents) {
                        // log full details
                        if (contents) {
                            self.report('exhibit-browserify', err.message.split(' while parsing file:')[0], {
                                file: {
                                    path: relativePath,
                                    contents: contents
                                },
                                line: err.line,
                                column: err.column
                            });
                        }
                        else {
                            // just log the message, no file details
                            self.report('exhibit-browserify', err.message);
                        }
                        done();
                    });

                    return;
                }

                var dotIndex = file.path.lastIndexOf('.'),
                    slashIndex = file.path.lastIndexOf('/');
                if (dotIndex > slashIndex || slashIndex === -1) {
                    file.path = file.path.substring(0, dotIndex + 1) + 'js';
                }

                // update the output file with the new string, then pass it on
                file.contents = bundledContents;
                done(null, file);
            });
        }, done);
    };
};
