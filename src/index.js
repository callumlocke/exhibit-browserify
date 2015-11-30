import {createReadStream} from 'streamifier';
import path from 'path';
import getCreateDeps from './get-create-deps';

const defaults = {
  entries: '**/*.entry.js',
  extensions: null,
  cwd: process.cwd(),
  sourceMap: true,
};

export default function () {
  const _arguments = arguments;

  let allSetUp, options, allExtensions, browserifyOptions, Browserify;

  /**
   * One-time setup function to fix up the options.
   */
  function setup(_) {
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

    // allow expressing some options in the singular
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

    // create the options that will be used to instantiate every Browserify instance
    browserifyOptions = {
      extensions: options.extensions,
      basedir: options.cwd, // or should this be the source dir?
      debug: options.sourceMap,
      fullPaths: true,
      paths: path.join(options.cwd, 'node_modules'),
    };

    // load browserify
    Browserify = require('browserify'); // eslint-disable-line global-require

    // delete it from the global cache because we're going to monkey-patch it
    delete require.cache[require.resolve('browserify')];

    allSetUp = true;
  }


  /**
   * Return a builder function.
   */
  return function exhibitBrowserify(job) {
    const {
      file, matches, contents, ext,
      util: {Promise, _},
    } = job;

    // always return a promise
    return Promise.resolve().then(() => {
      // do initial setup only once
      if (!allSetUp) setup(_);

      // pass through if it's not a filetype we care about
      // OR if it's been manually skipped.
      if (allExtensions.indexOf(ext) === -1 || matches(options.ignore)) return contents;

      // block if it's a non-entry script
      if (!matches(options.entries)) return null;

      // it's an entry file...

      // monkey-patch Browserify for this one instance
      Browserify.prototype._createDeps = getCreateDeps(job, allExtensions);

      // make a browserify instance
      const b = new Browserify(browserifyOptions);

      // browserify expects a stream, not a buffer
      const stream = createReadStream(contents);
      stream.file = file; // https://github.com/substack/node-browserify/issues/816
      b.add(stream);


      // bundle it
      return Promise.promisify(b.bundle.bind(b))()
        .then(bundledContents => {
          // TODO: separate out souce map? ensure extension is correct?

          // output the bundle
          return bundledContents;
        })
        .catch(err => {
          // can't throw a SourceError due to
          // https://github.com/substack/node-browserify/issues/1117

          throw err;
        });
    });
  };
}
