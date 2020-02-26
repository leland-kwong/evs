import classnames from 'classnames';
import * as evs from '../src';

const {
  autoDom,
  createElement,
} = require('../src/internal/auto-dom');

/**
 * Build a props object using a
 * chainable syntax
 *
 * Example:
 * props
 *  .on('click)
 *  .class('foobar')
 */
const propsApi = {
  setScope(scope) {
    this.scope = scope;
  },
  on(event, callback, arg = null) {
    const eventName = `evs.${event}`;
    this[eventName] = this.scope
      .call(callback, arg);
  },
  type(name) {
    this.type = name;
  },
  hidden(isHidden) {
    this.hidden = isHidden;
  },
  class(classes) {
    this.class = classnames(classes);
  },
  // set multiple props
  assign(propsToAdd) {
    Object.assign(this, propsToAdd);
  },
  // set single prop
  prop(name, value) {
    this[name] = value;
  },
};

function makeChainable(chainApi, [key, fn]) {
  const c = chainApi;
  const descriptor = {
    props: {
      value: {},
    },
  };
  const scopeDescriptor = {
    value: evs.defaultScope,
    writable: true,
  };

  /*
  * TODO:
  * We can optimize by not needing spread
  */
  c[key] = function chainableFn(...args) {
  /**
   * create a new instance if
   * it is same as prototype
   */
    const isNew = !this.$isInstance;
    const instance = isNew
      ? Object.create(this, descriptor)
      : this;
    if (isNew) {
      instance.$isInstance = true;
      /**
       * make non-enumerable to prevent from
       * being reflected during vnode -> dom
       * conversion
       */
      Object.defineProperty(
        instance.props,
        'scope',
        scopeDescriptor,
      );
    }
    fn.apply(instance.props, args);
    return instance;
  };

  return c;
}

const props = Object.entries(propsApi)
  .reduce(makeChainable, {
    $specialValue(self) {
      return self.props;
    },
  });

const AddTodo = (data) =>
  ({
    type: 'AddTodo',
    data,
  });

const TodosList = ({ items }) =>
  [ul, items.map((text) =>
    [li, text])];

const TodoForm = () =>
  [form,
    [input, {
      type: 'text',
      placeholder: 'my todo',
    }],
    [button,
      props
        .on('click', AddTodo)
        .type('button'),
      'add todo']];

const TodoApp = ({ todos }) =>
  [div, props.class('app'),
    [h1, 'Todos'],
    [TodoForm],
    [TodosList, { items: todos }]];

function SetName(name) {
  return {
    type: 'SetName',
    name,
  };
}

const NameInput = ({ name, scope }) =>
  [label,
    'Name: ',
    [input, props
      .type('text')
      .prop('value', name)
      .setScope(scope)
      .on(
        'input',
        SetName,
        evs.InputValue,
      )]];

const Greeting = ({ name }) =>
  [h1, 'Hello ', name];

const MultiChars = ({ name }) =>
  [div, [...name].map((char) =>
    [strong, char])];

const Hello = ({ name, scope }) =>
  [div,
    [NameInput, { name, scope }],
    [Greeting, { name }],
    [MultiChars, { name }]];

export {
  TodoApp,
  Hello,
  createElement,
};
