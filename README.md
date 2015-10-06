# exhibit-builder-browserify [![NPM version][npm-image]][npm-url] [![Dependency Status][depstat-image]][depstat-url]

> [Exhibit.js](https://github.com/exhibitjs/exhibit) builder plugin for bundling scripts with [Browserify](http://browserify.org/).

## Installation

```sh
$ npm install --save-dev exhibit-builder-browserify
```


## Usage

```js
exhibit('src')
  .use('browserify', options)
  .build('dist', {watch: true});
```

- Any scripts with the extension `.entry.js` as an entry point for bundling.
    - The `.entry.js` naming convention is just a convenient default – see options below for changing it.

- Any `.js` and `.json` files thare are *not* entries are discarded (though of course they may still be bundled into an entry).
    - Use the `skip` option if you want some to get through.

- All other filetypes (e.g. `.css`) are passed straight through.


### Options

Syntax: `.use('browserify', options)`. Alternatively you may pass the `entries` option as a separate argument before your options, e.g. `.use('browserify', 'main.js', options)` ...or even just: `.use('browserify', 'main.js')`.


#### `extensions` or `extension`

**Default:** `null`

This should be an array of strings like `['.coffee', '.hbs']`. (Although the dots are optional.)

Specifies extra extensions (in addition to `.js` and `.json`) that should be handled by this plugin. Useful in conjunction with certain Browserify transforms like [coffeeify](#) and [hbsfy](#). (But note you probably don't need Browserify transforms with Exhibit; you can just use other builders before this one so everything is already JavaScript by the time it gets here.)


#### `entries` or `entry`

**Default:** `"**/*.entry.js"`

This can be a filename/glob or an array thereof, or a custom function that returns true/false for each path.


#### `skip`

**Default:** `null`

Provide a filename/glob (or array thereof), or a callback function, to identify files that should be skipped.

The point of this is to skip files that would normally be handled by Browserify, i.e. `.js` and `.json` files (and possibly others if you're using the `extensions` option).

Good example: `skip: 'scripts/vendor/**/*.js'`


#### `sourceMap`

**Default:** `true`

Change to `false` if you don't want source maps.


## License

MIT


<!-- badge URLs -->
[npm-url]: https://npmjs.org/package/exhibit-builder-browserify
[npm-image]: https://img.shields.io/npm/v/exhibit-builder-browserify.svg?style=flat-square

[travis-url]: http://travis-ci.org/exhibitjs/exhibit-builder-browserify
[travis-image]: https://img.shields.io/travis/exhibitjs/exhibit-builder-browserify.svg?style=flat-square

[depstat-url]: https://david-dm.org/exhibitjs/exhibit-builder-browserify
[depstat-image]: https://img.shields.io/david/exhibitjs/exhibit-builder-browserify.svg?style=flat-square
