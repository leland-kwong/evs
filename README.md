# EVS

Data-driven DOM events for web applications.

## Benefits

* works with any web application
* simple to debug
* no more event listener management
* no more callbacks in your render

# EVS components

## Setting up webpack and eslint

Having to require common functions like `div`, `input` for every new file gets tedious very quickly. We can set these up to be "globals" in webpack and eslint for specific file types.

### Webpack globals

In our `webpack.config.js` file:

```js

const htmlGlobals = require('./src/internal/ldom-globals.json');

module.exports = {
  ...,
  plugins: [
    /*
    * This transforms all ldom calls to `autoDom.{tagName}.
    */
    new webpack.DefinePlugin({
      ...Object.keys(htmlGlobals).reduce((defs, key) => {
        const d = defs;

        d[key] = `autoDom.${key}`;
        return d;
      }, {}),
    }),
  ]
}
```

### eslint globals

In our `eslintrc.js` file:

```js
{
  ...,
  "no-unused-vars": [
    "error", { "varsIgnorePattern": "autoDom" }
  ],
  "overrides": [
    {
      files: ['*.ldom.js'],
      globals: ldomGlobals
    }
  ]
}
```

## Component Example

```js
const scope = evs.createScope('myNamespace');
```
