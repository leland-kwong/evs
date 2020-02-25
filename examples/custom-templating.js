import classnames from 'classnames';
import isPlainObject from 'is-plain-object';
import { isFunc } from '../src/internal/is-func';
import * as evs from '../src';

/**
 * Build a custom inspector that maps the lisp structure
 * to the dom? This could be awesome if we can manage it.
 * Not sure about the complexity though.
 */

const { isArray } = Array;
const dataType = Symbol('@type');
const dataValue = Symbol('@value');

const getSpecialValue = (v) => {
  const dataFn = v
    ? v[dataValue]
    : null;
  if (dataFn) {
    return dataFn(v);
  }

  return v;
};

const isDomFunc = (v) =>
  v.isDomFn;

const identity = (v) =>
  v;

const sliceList = (
  arrayLike,
  callback = identity,
  startFrom = 0,
  endAt = arrayLike.length,
) => {
  const { length } = arrayLike;
  const isSingleArg = length === 2;

  if (isSingleArg) {
    const firstArg = arrayLike[1];
    return [callback(firstArg)];
  }

  let i = startFrom;
  // mutated in while loop
  const args = new Array(length - startFrom);

  while (i < endAt) {
    const arg = arrayLike[i];
    const val = callback(arg);

    args[i - startFrom] = val;
    i += 1;
  }

  return args;
};

const getLispFunc = (lisp) =>
  lisp[0];

/**
 * lisp structure is:
 * [function, ...args]
 */
const isLisp = (v) =>
  /**
   * All truthy values in javascript are
   * objects, so we can safely check this
   * way. There can be those edge-cases
   * where a plain object has a 0 property
   * on it. But doing it this way is more
   * performant since we don't need to do
   * an extra `isArray` check everytime.
   */
  v && isFunc(v[0]);

const processLisp = (
  value,
) => {
  if (!isLisp(value)) {
    return value;
  }

  const f = getLispFunc(value);
  // ignore first value since it
  // is the lisp function.
  const args = sliceList(value, processLisp, 1);
  const nextValue = isDomFunc(f)
    ? f(args)
    /*
     * TODO:
     * Setup the multi-arity functions so we
     * don't have to apply. Also, the arity
     * functions can take the lisp directly
     * instead of needing to slice the rest
     * of the args. This will make processing
     * almost as cheap as a function call. We
     * also should only try to handle up to
     * 6 args. Anything more than that and we
     * we'll just apply and throw a warning.
     *
     * Example:
     * ```
     * function arity2(lisp) {
     *  const [fn, arg1, arg2] = lisp;
     *  return fn(arg1, arg2);
     * }
     * ```
     */
    : f(...args);

  return processLisp(nextValue);
};

function createElement(templateFn, arg) {
  return processLisp(
    templateFn(arg),
  );
}

function convertNodeIfNeeded(node) {
  if (typeof node === 'string'
    || typeof node === 'number') {
    return { type: 'text', value: node };
  }
  return node;
}

function prepareChildren(nodes) {
  if (isArray(nodes)) {
    return nodes.map(convertNodeIfNeeded);
  }
  return nodes !== undefined
    ? [convertNodeIfNeeded(nodes)]
    : [];
}

// hast-compatible vnode
function VNode(tagName, props, children) {
  return {
    type: 'element',
    tagName,
    properties: getSpecialValue(props),
    children: prepareChildren(children),
  };
}

const tagCache = new Map();

const autoDom = new Proxy({}, {
  /**
   * auto-generates a element vnode function
   * based on the tag name.
   */
  get(source, tagName) {
    const fromCache = tagCache.get(tagName);

    if (fromCache) return fromCache;

    function getProps(args) {
      const firstArg = args[0];
      if (isPlainObject(firstArg)
        && !firstArg.tagName) {
        return firstArg;
      }
      return null;
    }

    /**
     * Supports the following formats
     *
     * [tagFn, nodeList]
     * [tagFn, props, nodeList]
     * [tagFn, props, node1, node2, ...]
     * [tagFn, node1, node2, ...]
     */
    const newElement = (args) => {
      const firstArg = args[0];
      const isNodeList = isArray(firstArg);
      if (isNodeList) {
        return VNode(tagName, {}, firstArg.map(processLisp));
      }

      const isOnlyProps = isPlainObject(args);
      if (isOnlyProps) {
        return VNode(tagName, args);
      }

      const props = getProps(args);
      if (props) {
        /*
         *
         * TODO: we can consider just unshifting
         * first item so we don't have to recreate
         * the list.
         * */
        // eslint-disable-next-line no-unused-vars
        const children = sliceList(args, identity, 1);
        return VNode(tagName, props, children);
      }
      return VNode(tagName, {}, args);
    };
    newElement.isDomFn = true;
    tagCache.set(tagName, newElement);

    return newElement;
  },
});

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
    const isNew = this === props;
    const instance = isNew
      ? Object.create(this, descriptor)
      : this;
    if (isNew) {
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
    [dataType]: '@props',
    [dataValue](self) {
      return self.props;
    },
  });

const {
  div, ul, li, h1, form, input, button, label,
  strong,
} = autoDom;

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
        .on('blur', console.log)
        .type('button')
        .hidden(false)
        .class(['foo', 'bar', 'blah']),
      'add todo']];

const TodoApp = (todos) =>
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

const MultipleChars = (name) =>
  [div, [...name].map((char) =>
    [strong, char.toUpperCase()])];

const Hello = ({ name, scope }) =>
  [div,
    [NameInput, { name, scope }],
    [h1,
      'Hello ', name],
    [MultipleChars, name]];

export { TodoApp, Hello, createElement };
