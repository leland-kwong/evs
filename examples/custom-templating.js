const fnCache = new Map();

const autoDom = new Proxy({}, {
  get(source, tagName) {
    const elemFn = fnCache.get(tagName);

    if (elemFn) return elemFn();

    const newElemFn = () =>
`@${tagName}`;
    fnCache.set(tagName, newElemFn);

    return newElemFn();
  },
});

const {
  div, ul, li, h1, form, input, button, label, hr,
} = autoDom;

const dataType = Symbol('dataType');

const prop = {
  [dataType]: '@prop',
  on(event, callback, arg = null) {
    /*
     * TODO:
     * Wrap all functions to auto create
     * an instance like this.
     */
    if (this === prop) {
      return Object.create(this)
        .on(event, callback, arg);
    }
    if (!this.eventFns) {
      this.eventFns = {};
    }
    this.eventFns[event] = { callback, arg };
    return this;
  },
  type(name) {
    this.inputType = name;
    return this;
  },
  hidden(isHidden) {
    this.isHidden = isHidden;
    return this;
  },
  class(classList) {
    this.classList = classList;
    return this;
  },
};

const AddTodo = (data) =>
  ({
    type: 'AddTodo',
    data,
  });

const TodosList = (items) =>
  [ul, items.map((text) =>
    [li, text])];

const TodoForm = () =>
  [form,
    [input, {
      type: 'text',
      placeholder: 'my todo',
    }],
    [button, [prop
      .on('click', AddTodo)
      .on('mouseenter', AddTodo)
      .on('blur', console.log)
      .type('button')
      .hidden(false)
      .class(['foo', 'bar', 'blah']),
    ], 'add todo']];

const TodoApp = (todos) =>
  [div, prop.class('app'),
    [h1, 'Todos'],
    [TodoForm],
    [TodosList, todos]];

const Hello = (name) =>
  [div,
    [label, 'Name:'],
    [input, { class: 'field', type: 'text' }],
    [hr],
    [h1, 'Hello', name]];

console.log(TodoForm([
  'email',
  'milk',
  'eggs',
]));

export { TodoApp };
