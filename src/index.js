import {extname} from 'path';
import {createReadStream} from 'streamifier';
import {join, relative} from 'path';
import browserResolve from 'browser-resolve-noio';
import getCreateDeps from './get-create-deps';

const defaults = {
  entries: '**/*.entry.js',
  extensions: null,
  cwd: process.cwd(),
  sourceMap: true,
};


export default function () {
  const _arguments = arguments;

  let allSetUp, options, allExtensions, browserifyOptions, Browserify,
      skip, isEntry;

  /**
   * One-time setup function to fix up the options.
   */
  function setup(Promise, _, micromatch) {
    // handle varying numbers of arguments
    switch (_arguments.length) {
      case 0:
        options = _.assign({}, defaults);
        break;
      case 1:
        const arg = _arguments[0];
        if (_.isFunction(arg) || _.isString(arg) || _.isArray(arg)) {
          options = _.assign({}, defaults, {entries: arg});
        }
        else options = _.assign({}, defaults, arg);
        break;
      case 2:
        options = _.assign({}, defaults, _arguments[1], {entries: _arguments[0]});
        break;
      default:
        throw new TypeError('Invalid options');
    }

    // allow singular forms for some options
    if (options.entry) {
      options.entries = options.entry;
      delete options.entry;
    }
    if (options.extension) {
      options.extensions = options.extension;
      delete options.extension;
    }

    // validate and normalize the extensions (make sure they've all got a dot)
    if (options.extensions) {
      if (_.isString(options.extensions)) options.extensions = [options.extensions];

      options.extensions.forEach((item, i) => {
        if (!_.isString(item)) {
          throw new TypeError('options.extensions should be an array of strings, or a single string');
        }

        if (item.length && item.charAt(0) !== '.') options.extensions[i] = '.' + item;
      });
    }


    // make an array of all extensions (including the standard two)
    allExtensions = ['.js', '.json'];
    if (options.extensions) allExtensions = allExtensions.concat(options.extensions);

    // make the isEntry function
    console.log('options', options);
    if (_.isFunction(options.entries)) isEntry = options.entries;
    else if (_.isString(options.entries) || _.isArray(options.entries)) isEntry = micromatch.filter(options.entries);
    else throw new TypeError('options.entries should be a string, array or function');


    // make the skip function (decides which 
    if (options.skip) {
      if (_.isFunction(options.skip)) skip = options.skip;
      else if (_.isString(options.skip)) skip = micromatch.filter(options.skip);
      else throw new TypeError('options.skip should be a string or function');
    }

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
    delete require.cache[require.resolve('browserify')]

    allSetUp = true;
  }


  /**
   * Return a builder function.
   */
  return function exhibitBrowserify(path, contents) {
    const {Promise, _, micromatch} = this.util;

    // always return a promise
    return Promise.resolve().then(() => {
      // do initial setup only once
      if (!allSetUp) setup(Promise, _, micromatch);

      // TODO: delete from cache?

      // pass through if it's not a JS file (or another extension we've been configured to care about)
      const extension = extname(path);
      if (allExtensions.indexOf(extension) === -1) return contents;

      // block if it's a non-entry, non-skipped file
      const relativePath = relative(this.base, path);
      if (!isEntry(relativePath) && (!skip || !skip(relativePath))) return null;

      // it's an entry file...

      // monkey-patch Browserify for this one instance
      Browserify.prototype._createDeps = getCreateDeps(this, allExtensions);

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
          console.log('BROWSERIFY BUNDLING ERROR', err.message, Object.keys(err));

          // TODO: throw a SourceError if appropriate
          throw err;
        });
    });
  };
}
