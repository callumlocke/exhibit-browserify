import {extname} from 'path';
import browserify from 'browserify';
import {createReadStream} from 'streamifier';
import {join} from 'path';

const defaults = {
  extensions: null,
  cwd: process.cwd(),
  sourceMap: true,
};


export default function (entryMatcher = '**/{*.,}entry.js', _options) {
  let options;
  let allExtensions;
  let nodeModulesPath;

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

    nodeModulesPath = join(options.cwd, 'node_modules');
  }



  /**
   * Return the actual plugin function.
   */
  return function exhibitBrowserify(path, contents) {
    const {Promise, _, minimatch} = this;

    // perform initial setup, only once
    if (!options) setup(Promise, _, minimatch);

    // TODO: delete from cache?

    // pass through if it's not a JS file (or another extension we've been configured to care about)
    const extension = extname(path);
    if (allExtensions.indexOf(extension) === -1) return contents;

    // block if it's a non-entry file
    if (!entryMatcher(path)) return null;

    // it's an entry file; process it.


    const stream = createReadStream(contents);
    // const stream = createReadStream(new Buffer('alert("hi");'));

    const b = browserify({
      extensions: options.extensions,
      basedir: options.cwd, // or should this be the source dir?
      // cache: cache,
      // packageCache: packageCache,
      debug: options.sourceMap,
      fullPaths: true,
      paths: [nodeModulesPath],
    });

    // weird way to tell browserify what the file's name is when passing in a stream
    stream.file = path; // https://github.com/substack/node-browserify/issues/816

    // give the stream to the bundler
    b.add(stream);

    // run the bundler
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
