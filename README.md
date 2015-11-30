# browserify

> **[Exhibit.js](https://github.com/exhibitjs/exhibit) builder**. Bundles your scripts with [Browserify](http://browserify.org/).
> 
> [![NPM version][npm-image]][npm-url] [![Dependency Status][depstat-image]][depstat-url]


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

Specifies extra extensions (*in addition& to `.js` and `.json`) that should be handled by this plugin. Might be useful in conjunction with certain Browserify transforms like [coffeeify](https://github.com/jnordberg/coffeeify) and [hbsfy](https://github.com/epeli/node-hbsfy). (But note you probably don't need Browserify transforms with Exhibit – you can just use other builders earlier in the sequence so everything is ES5 JavaScript by the time it reaches Browserify.)


#### `entries` or `entry`
Default: `"**/*.entry.js"`
Specifies which files should be considered bundle entry points.
Follows Exhibit's [matching convention](https://github.com/exhibitjs/exhibit/docs/matching.md).


#### `ignore`
Default: `null`
Files you want Browserify to ignore, even if they have a Browserify-able extension. For example, to avoid Browserifying your vendor scripts: `ignore: 'scripts/vendor/**/*.js'`
Follows Exhibit's [matching convention](https://github.com/exhibitjs/exhibit/docs/matching.md).


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
