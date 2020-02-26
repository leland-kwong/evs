# EVS

Data-driven DOM events for web applications.

## Benefits

* works with any web application
* simple to debug
* no more event listener management
* no more callbacks in your render

# EVS components

## Examples

### Render a component

```js
const Hello = ({ name }) => {
  return (
    [div,
      [p, name]]
  )
}
```

### Render a list
```js
const numbers = [1, 2]
const Doubled = num => num * 2
const List = [numbers, Doubled]

// lists are also automatically expanded
const AsFragment = (
  [div, 1, [List], [List]] // <div>1 2 4 2 4</div>
)
```

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
