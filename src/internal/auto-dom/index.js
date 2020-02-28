import isPlainObject from 'is-plain-object';
import { outdent } from 'outdent';
import * as snabbdom from 'snabbdom';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import { getSupportedEventTypes } from '../../get-event-types';
import { isArray, isFunc,
  setValue, stringifyValueForLogging } from '../utils';

const vnodeType = Symbol('@vnode');

const patch = snabbdom.init([
  snabbdomProps,
]);

// vnode utils
const isVnode = (node) =>
  (node
    ? node[vnodeType]
    : false);

const getDomNode = (vnode) => {
  if (!isVnode(vnode)) {
    throw new Error(
      'can only get a dom node from a vnode ref',
    );
  }

  return vnode.elm;
};

const remappedEventTypes = {
  focusin: 'focus',
  focusout: 'blur',
};

const handleProp = {
  // do nothing here because we want to
  // exclude it from being applied to the dom
  children() {},

  style(oldStyle = {}, newStyleObj, ref) {
    Object.keys(newStyleObj).forEach((k) => {
      const nextValue = newStyleObj[k];
      const isSameValue = oldStyle[k] === nextValue;

      if (isSameValue) return;
      setValue(
        getDomNode(ref).style, k, nextValue,
      );
    });
  },

  class(oldValue, newValue, ref) {
    setValue(
      getDomNode(ref), 'className', newValue,
    );
  },

  /*
   * TODO:
   * We should probably setup the synthetic event system
   * so we can do more advance event handling that the
   * traditional system can't do for us.
   */
  // setup builtin dom event types
  ...[
    ...getSupportedEventTypes(),
    'focusin',
    'focusout',
  ].reduce((handlerCallbacks, eventName) => {
    const h = handlerCallbacks;
    const remappedName = remappedEventTypes[eventName];
    const domEventPropName = `on${remappedName || eventName}`;

    h[domEventPropName] = (
      oldValue, newValue, ref,
    ) => {
      getDomNode(ref)[
        domEventPropName] = newValue;
    };

    return handlerCallbacks;
  }, {}),
};

const validateValue = (value) => {
  if (process.env.NODE_ENV !== 'development') {
    return value;
  }

  const isFuncChild = isFunc(value);

  if (isFuncChild) {
    const stringified = stringifyValueForLogging(value);
    throw new Error(outdent`
      Sorry, functions are not valid as a child.

      Received:
      ${stringified}

    `);
  }

  const isObjectChild = typeof value === 'object';

  if (isObjectChild) {
    const stringified = stringifyValueForLogging(value);
    throw new Error(outdent`
      Sorry, objects are not valid as a child.

      Received:
      ${stringified}

    `);
  }

  const isInvalidCollection = isArray(value)
    // children should not be nested arrays
    && value.find(isArray);

  if (isInvalidCollection) {
    const stringified = (() => {
      const res = stringifyValueForLogging(value);
      if (res.length > 300) {
        return `${res.slice(0, 300)} ...`;
      }
      return res;
    })();

    throw new Error(outdent`
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
  }

  return value;
};

function textVnode(text) {
  return {
    text,
    [vnodeType]: true,
  };
}

const falsyValues = new Set([
  false,
  null,
  undefined,
]);

function coerceToVnode(newChildren, value) {
  // ignore falsy values
  if (falsyValues.has(value)) {
    return newChildren;
  }

  if (isVnode(value)) {
    newChildren.push(value);
    return newChildren;
  }

  // everything else we consider text
  newChildren.push(
    textVnode(
      validateValue(value),
    ),
  );
  return newChildren;
}

const Vnode = (tagName, props) => {
  const { children } = props;

  return {
    sel: tagName,
    props,
    /*
     * TODO:
     * Check if `data` property is necessary for
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
};

const identity = (v) =>
  v;

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
    const value = callback(arg);
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
  const { children: childrenFromProps } = props;
  const children = hasArrayValue
    // auto-expand children
    ? args.flat() : args;
  const combinedChildren = childrenFromProps
    ? [...childrenFromProps, ...children]
    : children;

  /**
   * we can validate/sanitize the props
   */
  // don't mutate the original
  return { ...props,
           children: combinedChildren };
};

const getLispFunc = (lisp) =>
  lisp[0];

/**
 * Recursively processes a tree of Arrays
 * as lisp data structures.
 */
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
 * Add support for rendering an array of vnodes
 * so we don't require a single parent vnode.
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
  getDomNode,
};
