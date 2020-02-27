import isPlainObject from 'is-plain-object';
import { outdent } from 'outdent';
import * as snabbdom from 'snabbdom';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import { isArray, isFunc,
  setValue, stringifyValueForLogging } from '../utils';

const vnodeType = Symbol('@vnode');

const patch = snabbdom.init([
  snabbdomProps,
]);

const isVnode = (node) =>
  (node
    ? node[vnodeType]
    : false);

const handleProp = {
  // do nothing here because we don't
  // want it reflected to the dom during
  // rendering
  children() {},
  style(oldStyle = {}, newStyleObj, elm) {
    Object.keys(newStyleObj).forEach((k) => {
      const nextValue = newStyleObj[k];
      const isSameValue = oldStyle[k] === nextValue;

      if (isSameValue) return;
      setValue(elm.style, k, nextValue);
    });
  },
  class(oldValue, newValue, elm) {
    setValue(elm, 'className', newValue);
  },

  onChange(oldValue, newValue, elm) {
    elm.setAttribute('evs.change', newValue);
  },
  onInput(oldValue, newValue, elm) {
    elm.setAttribute('evs.input', newValue);
  },
  onClick(oldValue, newValue, elm) {
    elm.setAttribute('evs.click', newValue);
  },
};

function coerceToVnode(newChildren, value) {
  if (isVnode(value)) {
    newChildren.push(value);
    return newChildren;
  }

  const isFalsy = value === false
    || value === null;
  // ignore falsy values
  if (isFalsy) {
    return newChildren;
  }

  // everything else we consider text
  newChildren.push({ text: value });
  return newChildren;
}

function Vnode(tagName, props) {
  const { children } = props;

  return {
    sel: tagName,
    props,
    /**
     * NOTE: this property is necessary for
     * snabbdom to work
     */
    data: {
      handleProp,
    },
    children: children.reduce(
      coerceToVnode, [],
    ),
    [vnodeType]: true,
  };
}

const identity = (v) =>
  v;

// values should not be nested arrays
const invalidCollectionValue = (value) =>
  isArray(value);

const validateValue = (value) => {
  if (process.env.NODE_ENV !== 'development') {
    return value;
  }

  const isInvalidCollection = isArray(value)
    && value.find(invalidCollectionValue);

  if (isFunc(value)
    || isInvalidCollection
  ) {
    const stringified = (() => {
      const res = stringifyValueForLogging(value);
      if (res.length > 300) {
        return `${res.slice(0, 300)} ...`;
      }
      return res;
    })();

    console.warn(outdent`
      Sorry,

      ${stringified}

      is not a valid component. This can happen when
      we either nested the arrays too deeply or forgot to
      wrap a component in an array.

      The supported formats are:

      \`\`\`javascript

      // basic component
      [Function, value1, value2, ...]

      // component with props
      [Function, Object, value1, value2, ...]

      // collection of nodes
      [value1, value2, ...]

      // collection of nodes with a map function
      [Array, Function]

      \`\`\`
    `);

    const styles = {
      container: `
        background: #3c3601;
        color: #ffff4a;
        padding: .5rem;
        font-size: 14px;
        font-weight: normal;
        font-family: monospace`,
      helpText: `
        font-weight: bold`,
    };

    return Vnode(
      'div',
      { style: styles.container },
      [
        Vnode(
          'div',
          { style: styles.helpText },
          ['invalid component detected:'],
        ),
        Vnode(
          'pre',
          {},
          [stringified],
        ),
      ],
    );
  }

  return value;
};

const sliceList = (
  lisp = [],
  callback = identity,
  startFrom = 0,
  endAt = lisp.length,
) => {
  const { length } = lisp;
  let hasArrayValue = false;
  let i = startFrom;
  // mutated in while loop
  const args = new Array(length - startFrom);

  while (i < endAt) {
    const arg = lisp[i];
    const value = validateValue(
      callback(arg),
    );
    const currentIndex = i - startFrom;

    hasArrayValue = hasArrayValue || isArray(value);
    args[currentIndex] = value;
    i += 1;
  }

  return [args, hasArrayValue];
};

const getVnodeProps = (args, hasArrayValue) => {
  const firstArg = args[0];
  const hasProps = isPlainObject(firstArg)
    && !isVnode(firstArg);
  const props = hasProps
    // remove the first argument
    ? args.shift() : {};
  // auto-expand children
  const children = hasArrayValue
    ? args.flat() : args;

  // don't mutate the original
  return { ...props, children };
};

const getLispFunc = (lisp) =>
  lisp[0];

const processLisp = (value) => {
  const isList = isArray(value);
  /**
   * lisp structure is:
   * [function, ...args]
   */
  const isLispLike = isList
    && isFunc(value[0]);

  if (!isLispLike) {
    if (isList) {
      return value.map(processLisp);
    }

    return value;
  }

  const f = getLispFunc(value);
  // everything after the first value
  const [args, hasArrayValue] = sliceList(value, processLisp, 1);
  const props = getVnodeProps(args, hasArrayValue);
  const nextValue = f(props);

  return processLisp(nextValue);
};

/**
 * Generates a convenience method for element factories
 * so we can do something like:
 *
 * const A = {
 *  div: defineElement('div'),
 *  span: defineElement('span'),
 * }
 *
 * ```js
 * [A.div,
 *  [A.span, 1, 2, 3]]
 * ```
 */
const defineElement = (tagName) => {
  const elementFactory = (props) =>
    Vnode(tagName, props);

  elementFactory.isVnodeFactory = true;

  return elementFactory;
};

const createElement = processLisp;

/*
 * TODO:
 * If we get an array of vnodes, then we can
 * automatically wrap them with a parent vnode
 * with a selector that matches the dom node.
 */
const renderToDomNode = (domNode, component) => {
  const d = domNode;
  const fromNode = d.oldVnode || domNode;
  const toNode = processLisp(component);

  patch(fromNode, toNode);
  d.oldVnode = toNode;
};

const nativeElements = Object.keys(elementTypes)
  .reduce((elementFactories, tagName) => {
    const e = elementFactories;

    e[tagName] = defineElement(tagName);

    return e;
  }, {});

export {
  defineElement,
  createElement,
  nativeElements,
  renderToDomNode,
};
