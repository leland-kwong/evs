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
  setTreeValue,
  hasTreeValue,
} from './vnode';
import { string } from '../string';
import { isArray, isFunc,
  isDef,
  stringifyValueForLogging,
  identity } from '../utils';
import {
  emptyArr,
  pathSeparator,
  nextPathKey,
} from '../constants';
import * as valueTypes from './value-types';
import {
  setCurrentProps,
  setCurrentDispatcher,
} from './render-context';

const { isType } = valueTypes;

const vnodeKeyTypes = {
  string: true,
  number: true,
};

const newPath = Symbol('newPath');

const keyRegex = /^[a-zA-Z0-9-_@/]*$/;

const validateKey = (key, keyType = 'key') => {
  if (process.env.NODE_ENV !== 'development') {
    return key;
  }

  if (isDef(key)) {
    if (!vnodeKeyTypes[typeof key]) {
      throw new Error(string([
        `${keyType} may only be a string or number. `,
        `Received: ${stringifyValueForLogging(key)}`,
      ]));
    } else if (!keyRegex.test(key)) {
      throw new Error(string([
        `${keyType} must satisfy this pattern: ${keyRegex}. `,
        `Received: \`${stringifyValueForLogging(key)}\``,
      ]));
    }
  }

  return key;
};

const patch = snabbdomInit([
  snabbdomProps,
]);

const addToRefId = (currentPath, location) => {
  if (currentPath === newPath) {
    return location;
  }

  return `${currentPath}${pathSeparator}${location}`;
};

/**
 * Makes a new list of arguments. This also
 * gives us the safety to mutate it later without
 * interfering with the original lisp structure.
 * @returns {Array}
 */
const prepareArgs = (
  lisp = emptyArr,
  callback,
  path,
  prevCtor,
  onPathValue,
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
    const evaluated = callback(arg, path, i, prevCtor, onPathValue);

    args[i] = evaluated;
    i += 1;
  }

  return args;
};

const emptyProps = {};
Object.defineProperty(emptyProps, 'empty', {
  value: true,
});
Object.freeze(emptyProps);

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
 * @returns {Object} props object
 */
const parseProps = (
  value = [], argProcessor, path,
  prevKey, ctor, onPathValue,
) => {
  const props = getPropsFromArgs(value);

  /**
   * validate the original key since
   * we use a default one later on
   */
  validateKey(props.key);

  const { key = prevKey } = props;
  const refId = addToRefId(path, key);
  const skipValues = !props.empty ? 2 : 1;
  const args = prepareArgs(
    value, argProcessor, refId,
    ctor, onPathValue, skipValues,
  );
  const baseConfig = {
    props: {
      key,
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
 * @returns {Any} evaluated value
 */
const processLisp = (
  value, path, prevKey,
  prevCtor, onPathValue,
) => {
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
        const result = processLisp(
          v, path, defaultKey,
          prevCtor, onPathValue,
        );
        return result;
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
    value, argProcessor, path,
    prevKey, nextCtor, onPathValue,
  );
  const fInput = isDomComp ? config : config.props;
  const { props: { $$refId } } = config;

  /**
     * @important
     * this must be called before executing the
     * dispatcher, so the code inside the dispatcher
     * gets the right information.
     */
  setCurrentProps($$refId, fInput);
  setCurrentDispatcher($$refId, f);

  const nextValue = f(fInput);
  const finalValue = processLisp(
    nextValue,
    $$refId,
    nextPathKey,
    nextCtor,
    onPathValue,
  );

  onPathValue($$refId, finalValue);
  return finalValue;
};

const validateSeedPath = (seedPath) => {
  const isPreExistingPath = hasTreeValue(seedPath);

  if (isPreExistingPath) {
    return;
  }

  if (!vnodeKeyTypes[typeof seedPath]) {
    throw new Error(string([
      '[createElement] `seedPath` must be one of types: ',
      `[${Object.keys(vnodeKeyTypes)}]`,
    ]));
  }

  validateKey(seedPath, 'seedPath');
};

/**
 * @param {Array} value atomic ui component
 * @param {String | Number} seedPath id prefix
 * @returns vnode
 */
const createElement = (
  value,
  seedPath,
  onPathValue = identity,
) => {
  if (process.env.NODE_ENV === 'development') {
    validateSeedPath(seedPath);
  }

  if (isType(value, valueTypes.vnode)) {
    return value;
  }

  const vtree = processLisp(
    value,
    newPath,
    String(seedPath),
    undefined,
    onPathValue,
  );

  return vtree;
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

/*
 * TODO:
 * Add support for rendering a fragment
 * so we don't require a single parent vnode.
 */
const renderWith = (
  fromNode,
  component,
  seedPath,
  onPathValue = setTreeValue,
) => {
  const toNode = createElement(
    component, seedPath, onPathValue,
  );

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

export {
  defineElement,
  nativeElements,
  renderWith,
  createElement,
  CloneElement,
  valueTypes,
};

export {
  getCurrentProps,
  getCurrentDispatcher,
} from './render-context';

export { getDomNode } from './vnode';