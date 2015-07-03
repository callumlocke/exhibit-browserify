import {extname} from 'path';
import {createReadStream} from 'streamifier';
import {join} from 'path';
import browserResolve from 'browser-resolve-noio';
import getCreateDeps from './get-create-deps';


const defaults = {
  extensions: null,
  cwd: process.cwd(),
  sourceMap: true,
};


export default function (entryMatcher = '**/{*.,}entry.js', _options) {
  let allSetUp, options, allExtensions, browserifyOptions, Browserify;


  /**
   * One-time setup function.
   */
  function setup(Promise, _, minimatch) {
    options = _.assign({}, defaults, _options);

    if (_.isString(entryMatcher)) {
      entryMatcher = minimatch.filter(entryMatcher);
    }
    else if (!_.isFunction(entryMatcher)) {
      throw new TypeError('First argument to exhibit-browserify should be a string or function');
    }

    allExtensions = ['.js', '.json'];
    if (options.extensions) allExtensions = allExtensions.concat(options.extensions);

    // create the options that will be used to instantiate every Browserify instance
    browserifyOptions = {
      extensions: options.extensions,
      basedir: options.cwd, // or should this be the source dir?
      debug: options.sourceMap,
      fullPaths: true,
      paths: join(options.cwd, 'node_modules'),
      // cache: cache,
      // packageCache: packageCache,
    };


    // load browserify
    Browserify = require('browserify');

    // delete it from the global cache because we're going to monkey-patch it
    // delete require.cache[require.resolve('browserify')]

    allSetUp = true;
  }



  /**
   * Return the actual plugin function.
   */
  return function exhibitBrowserify(path, contents) {
    const {Promise, _, minimatch} = this;

    // do initial setup only once
    if (!allSetUp) setup(Promise, _, minimatch);

    // TODO: delete from cache?

    // pass through if it's not a JS file (or another extension we've been configured to care about)
    const extension = extname(path);
    if (allExtensions.indexOf(extension) === -1) return contents;

    // block if it's a non-entry file
    if (!entryMatcher(path)) return null;


    // it's an entry file...

    // monkey-patch Browserify for this one instance
    Browserify.prototype._createDeps = getCreateDeps(this);

    // make a browserify instance
    const b = new Browserify(browserifyOptions);

    // browserify expects a stream, not a buffer
    const stream = createReadStream(contents);
    stream.file = path; // https://github.com/substack/node-browserify/issues/816
    b.add(stream);

    
    // bundle it
    return Promise.promisify(b.bundle.bind(b))()
      .then(bundledContents => {
        // TODO: separate out souce map? ensure extension is correct?

        // return the bundle!
        return bundledContents;
      })
      .catch(err => {
        console.log('BROWSERIFY BUNDLING ERROR!', err.message, Object.keys(err));

        // TODO: throw a SourceError if appropriate
        throw err;
      });
  };
}
