import isPlainObject from 'is-plain-object';
import { init as snabbdomInit } from 'snabbdom';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import {
  isVnode, createVnode, ignoredValues, primitiveTypes,
} from './vnode';

import { isArray, isFunc,
  identity } from '../utils';


const patch = snabbdomInit([
  snabbdomProps,
]);

const prepareArgs = (
  lisp = [],
  callback = identity,
) => {
  // skip first value since it is the lisp function
  const startFrom = 1;
  const { length } = lisp;
  let i = startFrom;
  // mutated in while loop
  const args = new Array(length - startFrom);

  while (i < length) {
    const value = callback(lisp[i]);
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
const parseProps = (value = [], argProcessor) => {
  const args = prepareArgs(value, argProcessor);
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
  const argProcessor = f.isVnodeFactory
    // eagerly evaluate for vnodes
    ? processLisp
    : identity;
  const props = parseProps(value, argProcessor);
  const nextValue = f(props);

  return processLisp(nextValue);
};

const createElement = (value) => {
  if (isVnode(value)) {
    return value;
  }

  return processLisp(value);
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
  function elementFactory(props) {
    return createVnode(tagName, props);
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

/*
 * TODO:
 * Add support for rendering an array of vnodes
 * so we don't require a single parent vnode.
 */
const renderToDomNode = (domNode, component) => {
  const d = domNode;
  const fromNode = d.oldVnode || domNode;
  const toNode = createElement(component);

  d.oldVnode = toNode;
  patch(fromNode, toNode);
};

const nativeElements = Object.keys(elementTypes)
  .reduce((elementFactories, tagName) => {
    const e = elementFactories;

    e[tagName] = defineElement(tagName);

    return e;
  }, {});

// the `!` symbol is a comment in snabbdom
nativeElements.comment = defineElement('!');

/**
 * Clone and return a new vnode. New children will
 * replace existing children.
 */
const cloneElement = (...args) => {
  const [element, config, children = []] = args;
  const value = createElement(element);

  if (ignoredValues.has(value)) {
    return value;
  }

  if (primitiveTypes.has(typeof value)) {
    return value;
  }

  /*
   * TODO:
   * Need to figure out an idiomatic way to also
   * combine the hooks
   */
  const { sel } = value;
  const props = config
    ? { ...value.props,
        ...config }
    : value.props;
  const childrenLength = args.length - 2;

  if (childrenLength === 1) {
    props.children = children;
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
