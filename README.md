# EVS

Data-driven DOM events for web applications.

## Benefits

* works with any web application
* simple to debug
* no more event listener management
* no more callbacks in your render

## Example

# EVS components

## Example

```js
const myNamespace = evs.createScope('myNamespace');
const MyComponent = (
  { text },
  currentNamespace
) => {
  return `
    <input
      type="text"
      value="${text}"
    />
  `;
}

render(domNode, `
  <div class="app">
    <div evs._render="${myNamespace.call(
      MyComponent, {
        text: 'foobar'
      }
    )}">
    </div>
  </div>
`)
```
