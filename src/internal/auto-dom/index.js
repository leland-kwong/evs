/**
 * @TODO
 * Add check for reusing a vnode between two components in the tree.
 * Snabbdom stores dom node references on vnodes, so if we share a
 * vnode in the tree, we will have race conditions during re-renders.
 */

import isPlainObject from 'is-plain-object';
import { init as snabbdomInit } from 'snabbdom';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import {
  createVnode,
  createTextVnode,
  primitiveTypes,
  ignoredValues,
  validateVnodeValue,
  hooksByRefId,
} from './vnode';
import { string } from '../string';
import { isArray, isFunc,
  isDef,
  stringifyValueForLogging,
  identity } from '../utils';
import { emptyArr } from '../../constants';
import * as valueTypes from './value-types';

const { isType } = valueTypes;

const vnodeKeyTypes = {
  string: true,
  number: true,
};

const keyRegex = /^[a-zA-Z0-9-_@]*$/;

const validateKey = (key) => {
  if (process.env.NODE_ENV !== 'development') {
    return key;
  }

  if (isDef(key)) {
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
  }

  return key;
};

const patch = snabbdomInit([
  snabbdomProps,
]);

const addToRefId = (currentPath, location) =>
  `${currentPath}.${location}`;

/**
 * Makes a new list of arguments. This also
 * gives us the safety to mutate it later without
 * interfering with the original lisp structure.
 * @returns {Array}
 */
const prepareArgs = (
  lisp = emptyArr,
  callback,
  path = [0],
  skip = 0,
) => {
  const { length } = lisp;
  const argsLength = Math.max(0, length - skip);
  // mutated in while loop
  const args = new Array(argsLength);
  let i = 0;

  while (i < args.length) {
    const argIndex = i + skip;
    const arg = lisp[argIndex];
    const refId = addToRefId(path, i);
    const evaluated = callback(arg, refId, i);

    args[i] = evaluated;
    i += 1;
  }

  return args;
};

const emptyProps = Object.freeze({
  empty: true,
});

/**
 * Mutates the source by applying transformations
 * and remapping as necessary
 */
const transformConfig = (
  config, props,
) => {
  const keys = Object.keys(props || emptyProps);

  let i = 0;
  while (i < keys.length) {
    const k = keys[i];
    const v = props[k];

    // transfer props onto config props
    const p = config.props;
    p[k] = v;

    i += 1;
  }

  return config;
};

const getPropsFromArgs = (value) => {
  const firstArg = value[1];
  const hasProps = isPlainObject(firstArg)
    && !isType(firstArg, valueTypes.vnode);

  return hasProps ? firstArg : emptyProps;
};

/**
 * @param {Array|arguments} value
 * @param {Function} argProcessor
 * @returns props object
 */
const parseProps = (value = [], argProcessor, path, prevKey, ctor) => {
  const props = getPropsFromArgs(value);
  const lastDotIndex = path.lastIndexOf('.');
  const { key = prevKey } = props;
  const refId = isDef(key)
    /**
     * Replace last position of path with key so that
     * the path remains consistent when an element's
     * position changes amongst its siblings.
     */
    ? addToRefId(
      path.slice(0, lastDotIndex !== -1
        ? lastDotIndex : path.length),
      key,
    )
    : path;
  const skipValues = !props.empty ? 2 : 1;
  const args = prepareArgs(
    value, argProcessor, refId, skipValues,
  );
  const baseConfig = {
    props: {
      key: validateKey(key),
      $$refId: refId,
      children: args,
    },
    ctor,
  };

  transformConfig(baseConfig, props);
  return baseConfig;
};

const getLispFunc = (lisp) =>
  lisp[0];

/**
 * Recursively processes a tree of Arrays
 * as lisp data structures.
 *
 * @param {any} value
 * @param {String} path
 * @param {String | Number} prevKey The key prop
 * that transferred through from a previous functional
 * component call.
 */
const processLisp = (value, path, prevKey, prevCtor) => {
  const $type = typeof value;

  if (primitiveTypes.has($type)) {
    return createTextVnode(value);
  }

  if (ignoredValues.has(value)) {
    return createVnode('!',
      { props: emptyProps,
        children: String(value) });
  }

  const isList = isArray(value);
  /**
   * lisp structure is:
   * [function, ...args]
   */
  const isLispLike = isList
    && isFunc(value[0]);

  if (!isLispLike) {
    if (isList) {
      return value.map((v, defaultKey) => {
        /**
         * @important
         * We use the index as a default key so when
         * siblings are shuffled, form controls can
         * still maintain their focus.
         */
        const nextPath = addToRefId(path, defaultKey);
        return processLisp(
          v, nextPath, defaultKey, prevCtor,
        );
      });
    }

    validateVnodeValue(value);
    return value;
  }

  if (process.env.NODE_ENV === 'development') {
    const v = value;
    // add type annotation for dev purposes
    v.type = valueTypes.fnComponent;
  }

  const f = getLispFunc(value);
  const isDomComp = isType(
    f, valueTypes.domComponent,
  );
  const nextCtor = prevCtor || f;
  const argProcessor = isDomComp
    // only eagerly process vnode functions
    ? processLisp : identity;
  const config = parseProps(
    value, argProcessor, path, prevKey, nextCtor,
  );
  const fInput = isDomComp ? config : config.props;
  const nextValue = f(fInput, path);
  const { props: { key = prevKey, $$refId } } = config;

  return processLisp(nextValue, $$refId, key, nextCtor);
};

const validateSeedPath = (seedPath) => {
  if (!vnodeKeyTypes[typeof seedPath]) {
    throw new Error(string([
      '[createElement] `seedPath` must be one of ',
      `[${Object.keys(vnodeKeyTypes)}]`,
    ]));
  }
};

/**
 * @param {Array} value atomic ui component
 * @param {String | Number} seedPath id prefix
 * @returns vnode
 */
const createElement = (value, seedPath) => {
  if (isType(value, valueTypes.vnode)) {
    return value;
  }

  if (process.env.NODE_ENV === 'development') {
    validateSeedPath(seedPath);
  }

  return processLisp(value, String(seedPath));
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
  function elementFactory(config) {
    return createVnode(tagName, config);
  }

  const defineProps = Object.defineProperties;
  return defineProps(elementFactory, {
    name: {
      value: tagName,
    },
    type: {
      value: valueTypes.domComponent,
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

const fragmentComment = (props) => {
  const comment = nativeElements.comment({ props });
  comment.fragmentNode = true;
  comment.text = props.isEnd ? ' /fragment ' : ' fragment ';
  return comment;
};

/*
 * TODO:
 * Add support for rendering an array of vnodes
 * so we don't require a single parent vnode.
 */
const renderWith = (
  fromNode,
  component,
  seedPath,
) => {
  const toNode = createElement(component, seedPath);

  return patch(fromNode, toNode);
};

/**
 * Extends a component, by assigning new props
 * to the component.
 * New children will replace existing children.
 */
const CloneElement = ({ children: extendWith, $$refId }) => {
  const [baseComponent] = extendWith;
  const baseConfig = getPropsFromArgs(baseComponent);
  const [baseCtor] = baseComponent;
  const config = getPropsFromArgs(extendWith);
  const newChildren = !config.empty
    ? extendWith.slice(2)
    : extendWith.slice(1);
  const baseVnode = createElement(
    [baseCtor, baseConfig, ...newChildren],
    $$refId,
  );
  const isTextNode = valueTypes
    .isType(baseVnode, valueTypes.vnodeText);

  if (isTextNode) {
    return baseVnode;
  }

  const { sel, ctor } = baseVnode;
  const { props: oProps } = baseVnode;
  const props = {
    ...oProps,
    ...config,
  };
  const newConfig = { props, ctor };

  transformConfig(newConfig, config);
  return createVnode(sel, newConfig);
};

const useHook = (refId, callback, arg) => {
  const curHooks = hooksByRefId.get(refId);

  if (!curHooks) {
    hooksByRefId.set(refId, []);
    useHook(refId, callback, arg);
    return;
  }

  curHooks.push([callback, arg]);
};

const Fragment = ({ children }) =>
  [
    [fragmentComment],
    children,
    [fragmentComment, { isEnd: true }],
  ];

export {
  defineElement,
  nativeElements,
  renderWith,
  createElement,
  CloneElement,
  valueTypes,
  useHook,
  Fragment,
};

export { getDomNode } from './vnode';
