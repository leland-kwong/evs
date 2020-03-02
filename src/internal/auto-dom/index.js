import isPlainObject from 'is-plain-object';
import { init as snabbdomInit } from 'snabbdom';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import {
  isVnode, createVnode, ignoredValues,
} from './vnode';
import { string } from '../string';
import { isArray, isFunc,
  identity,
  isDef,
  stringifyValueForLogging } from '../utils';

const vnodeKeyTypes = {
  string: true,
  number: true,
  undefined: true,
};

const keyRegex = /^[a-zA-Z0-9-_]*$/;

const validateKey = (key) => {
  if (process.env.NODE_ENV !== 'development') {
    return key;
  }

  if (!vnodeKeyTypes[typeof key]) {
    throw new Error(string([
      'Key may only be a string or number. ',
      `Received: ${stringifyValueForLogging(key)}`,
    ]));
  } else if (!keyRegex.test(key)) {
    throw new Error(string([
      `Key must satisfy the this pattern ${keyRegex}. `,
      `Received: ${stringifyValueForLogging(key)}`,
    ]));
  }

  return key;
};

const patch = snabbdomInit([
  snabbdomProps,
]);

const prepareArgs = (
  lisp = [],
  callback = identity,
  path = [0],
) => {
  // skip first value since it is the lisp function
  const startFrom = 1;
  const { length } = lisp;
  let i = startFrom;
  // mutated in while loop
  const args = new Array(length - startFrom);

  while (i < length) {
    const itemIndex = i - startFrom;
    const value = callback(lisp[i], [...path, itemIndex]);
    const currentIndex = i - startFrom;

    args[currentIndex] = value;
    i += 1;
  }

  return args;
};

/**
 * @param {Array|arguments} value
 * @param {Function} argProcessor
 * @returns props object
 */
const parseProps = (value = [], argProcessor, path) => {
  const args = prepareArgs(value, argProcessor, path);
  const firstArg = args[0];
  const hasProps = isPlainObject(firstArg)
    && !isVnode(firstArg);
  const props = hasProps
    // remove the first argument
    ? args.shift() : {};
  const { children: childrenFromProps } = props;
  const children = args;
  const combinedChildren = childrenFromProps
    ? [...childrenFromProps, ...children]
    : children;

  if (props.key) {
    /**
     * Set the last position in the path to the key
     * instead of the item's index. This is necessary
     * for collections where items can have their
     * positions change but we want to guarantee the
     * ref path.
     */
    path.splice(-1, 1, props.key);
  }

  /**
   * we can validate/sanitize the props
   */
  // don't mutate the original
  return { ...props,
           /**
            * @important
            * This is necessary for stateful components
            * to use as a key for external data sources.
            */
           $$refId: path.join('.'),
           $$refPath: path,
           children: combinedChildren };
};

/**
 * Converts a tree path into array form, so
 * if we received something like:
 *
 * `'uuid.1.2.5.0'` it would become an array
 * `['uuid', 1, 2, 5, 0]`
 *
 * @param {String | Array} value
 * @returns {Array}
 */
const parsePath = (value) => {
  if (isArray(value)) {
    return value;
  }
  // transforms the id back into the original path
  return String(value).split('.').map((v) => {
    const maybeNum = Number(v);
    return !Number.isNaN(maybeNum) ? maybeNum : v;
  });
};

const getLispFunc = (lisp) =>
  lisp[0];

/**
 * Recursively processes a tree of Arrays
 * as lisp data structures.
 */
const processLisp = (value, nodePath) => {
  const pathArray = parsePath(nodePath);
  const isList = isArray(value);
  /**
   * lisp structure is:
   * [function, ...args]
   */
  const isLispLike = isList
    && isFunc(value[0]);

  if (!isLispLike) {
    if (isList) {
      return value.map((v, i) =>
        processLisp(v, [...pathArray, i]));
    }

    return value;
  }

  const f = getLispFunc(value);
  const argProcessor = f.isVnodeFactory
    // eagerly evaluate for vnodes
    ? processLisp
    : identity;
  const props = parseProps(value, argProcessor, pathArray);
  const nextValue = f(props, pathArray);
  const key = validateKey(
    props.key || value.$$keyPassthrough,
  );

  if (isDef(key) && !ignoredValues.has(nextValue)) {
    if (isVnode(nextValue)) {
      /**
       * Automatically add key to vnode in case it
       * wasn't passed through explicitly.
       */
      nextValue.key = key;
    // pass key through to next component function
    } else {
      nextValue.$$keyPassthrough = key;
    }
  }

  return processLisp(nextValue, pathArray);
};

const validateSeedPath = (seedPath) => {
  if (!vnodeKeyTypes[typeof seedPath]
    && !isArray(seedPath)) {
    throw new Error(string([
      '[createElement] `seedPath` must be a string or ',
      'an existing path from a vnode',
    ]));
  }

  if (typeof seedPath === 'string'
    && !keyRegex.test(seedPath)) {
    throw new Error(string([
      '[createElement] `seedPath` must satisfy',
      `${keyRegex}. Received: ${seedPath}`,
    ]));
  }
};

/**
 * @param {Array} value atomic ui component
 * @param {String | Number} seedPath id prefix for component tree
 * @returns vnode
 */
const createElement = (value, seedPath) => {
  if (isVnode(value)) {
    return value;
  }

  if (process.env.NODE_ENV === 'development') {
    validateSeedPath(seedPath);
  }

  return processLisp(value, seedPath);
};

/**
 * Generates a convenience method for element factories.
 *
 * ```js
 * const div = defineElement('div')
 * const span = defineElement('span')
 *
 * const MyComponent = () =>
 *  ([div,
 *    [span, 1, 2, 3]])
 * ```
 */
const defineElement = (tagName) => {
  function elementFactory(props, refId) {
    return createVnode(tagName, props, refId);
  }

  const defineProps = Object.defineProperties;
  return defineProps(elementFactory, {
    name: {
      value: tagName,
    },
    isVnodeFactory: {
      value: true,
    },
  });
};

const nativeElements = Object.keys(elementTypes)
  .reduce((elementFactories, tagName) => {
    const e = elementFactories;

    e[tagName] = defineElement(tagName);

    return e;
  }, {});

// the `!` symbol is a comment in snabbdom
nativeElements.comment = defineElement('!');

/*
 * TODO:
 * Add support for rendering an array of vnodes
 * so we don't require a single parent vnode.
 */
const renderToDomNode = (domNode, component) => {
  const oldVnode = isVnode(domNode)
    ? domNode
    : domNode.oldVnode;
  const fromNode = oldVnode || domNode;
  const rootId = oldVnode
    ? oldVnode.props.$$refPath
    : Math.random().toString(32).slice(2, 7);
  const toNode = createElement(component, rootId);

  patch(fromNode, toNode);
  toNode.elm.oldVnode = toNode;
};

/**
 * Clone and return a new vnode. New children will
 * replace existing children.
 */
const cloneElement = (...args) => {
  const [element, config, children = []] = args;

  if (!isVnode(element)) {
    throw new Error(
      '[cloneElement] Element must be a vnode',
    );
  }

  /*
   * TODO:
   * Need to figure out an idiomatic way to also
   * combine the hooks
   */
  const { sel } = element;
  const props = config
    ? { ...element.props,
        ...config }
    : element.props;
  const childrenLength = args.length - 2;

  if (childrenLength === 1) {
    props.children = [children];
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i += 1) {
      childArray[i] = args[i + 2];
    }
    props.children = childArray;
  }

  return createVnode(sel, props);
};

export {
  defineElement,
  nativeElements,
  renderToDomNode,
  createElement,
  cloneElement,
};

export { getDomNode } from './vnode';
