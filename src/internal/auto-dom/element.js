import isPlainObject from 'is-plain-object';
import { init as snabbdomInit } from 'snabbdom';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import { defineElement } from '../define-element';
import {
  createTextVnode,
  primitiveTypes,
  ignoredValues,
  validateVnodeValue,
  setTreeValue,
  getTreeValue,
  onVtreeCompleted,
  setIsRendering,
  getIsRendering,
  nullVnode,
  cleanTreePosition,
} from './vnode';
import { string } from '../string';
import {
  isArray,
  isFunc,
  isDef,
  stringifyValueForLogging,
  identity,
  alwaysTrue,
} from '../utils';
import {
  emptyArr,
  pathSeparator,
  noCurrentConfig,
  specialProps,
} from '../constants';
import * as valueTypes from './value-types';
import {
  getCurrentConfig,
  setCurrentConfig,
  getShouldUpdate,
} from './render-context';
import { setVtree } from './vtree-cache';
import {
  isFragmentRootNode,
  Fragment,
  getFragmentNodeFromFragment,
} from '../fragment';

const { isType } = valueTypes;

const vnodeKeyTypes = {
  string: true,
  number: true,
};

const newPath = Symbol('newPath');

const keyRegex = /^[a-zA-Z0-9-_/]*$/;

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

const nativeElements = Object.keys(elementTypes)
  .reduce((elementFactories, tagName) => {
    const e = elementFactories;

    e[tagName] = defineElement(tagName);

    return e;
  }, {});

// the `!` symbol is a comment in snabbdom
nativeElements.comment = defineElement('!');

let hooksQueue = [];

const consumeHooksQueue = () => {
  const hooks = hooksQueue;

  hooksQueue = [];
  return hooks;
};

const addHooks = (element, hooks) => {
  const hookNode = getFragmentNodeFromFragment(element);

  /**
   * @Mutation
   * Replace hooks with new ones each render
   */
  if (getIsRendering()) {
    hookNode.customHooks = hooks;
  /**
   * @Mutation
   * When asynchronously using a hook we insert it.
   */
  } else {
    hookNode.customHooks
      .push(...hooks);
  }

  return element;
};

const enqueueHook = (refId, callback, arg) => {
  // @Mutation
  hooksQueue.push([refId, callback, arg]);

  const isAsyncHookAdd = !getIsRendering();

  if (isAsyncHookAdd) {
    addHooks(
      getTreeValue(refId),
      consumeHooksQueue(),
    );
  }
};

const addToRefId = (currentPath, location) => {
  if (currentPath === newPath) {
    return location;
  }

  if (!isDef(location)) {
    return currentPath;
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
  const args = Array(argsLength);
  let i = 0;

  while (i < args.length) {
    const argIndex = i + skip;
    const arg = lisp[argIndex];
    const evaluated = callback(arg, path, i,
      prevCtor, onPathValue);

    args[i] = evaluated;
    i += 1;
  }

  return args;
};

const emptyProps = Object.freeze(
  Object.create({}, {
    $$empty: {
      value: true,
    },
  }),
);

/**
 * Mutates the source by applying transformations
 * and remapping as necessary
 */
const applyProps = (
  configProps, props,
) => {
  const keys = Object.keys(props);

  let i = 0;
  while (i < keys.length) {
    const k = keys[i];
    const v = props[k];

    if (!specialProps[k]) {
      // transfer props onto config props
      const p = configProps;
      p[k] = v;
    }

    i += 1;
  }

  return configProps;
};

const getPropsFromArgs = (value) => {
  const firstArg = value[1];
  const hasProps = isPlainObject(firstArg)
    && !isType(firstArg, valueTypes.vnode);

  return hasProps ? firstArg : emptyProps;
};

const refIdKey = Symbol('@refId');

const refIdDescriptor = {
  get() {
    return this[refIdKey];
  },
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
   * we default to `prevKey` after
   */
  validateKey(props.key);

  const { key = prevKey } = props;
  const refId = addToRefId(path, key);
  const skipValues = !props.$$empty ? 2 : 1;
  const args = prepareArgs(
    value, argProcessor, refId,
    ctor, onPathValue, skipValues,
  );
  const { shouldUpdate = alwaysTrue } = props;
  const updatePredicate = getShouldUpdate()
    || shouldUpdate;
  const config = {
    props: applyProps({
      [refIdKey]: refId,
      children: args,
    }, props),
    key: refId,
    originalShouldUpdate: shouldUpdate,
    ctor,
  };
  Object.defineProperty(
    config.props,
    specialProps.$$refId,
    refIdDescriptor,
  );
  const currentConfig = getCurrentConfig(refId);
  const hasConfig = currentConfig
    !== noCurrentConfig;
  const { props: oProps } = currentConfig;

  if (hasConfig
      && !updatePredicate(oProps, config.props, config)) {
    return currentConfig;
  }

  return config;
};

const getLispFunc = (lisp) =>
  lisp[0];

const toFragment = (value) => {
  const alreadyFragment = isArray(value)
    ? isFragmentRootNode(
      getFragmentNodeFromFragment(value),
    )
    : false;

  if (alreadyFragment) {
    return value;
  }

  return [Fragment, value];
};

const cleanupOnDestroy = (type, refId) => {
  if (type === 'destroy') {
    cleanTreePosition(refId);
  }
};

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
  const isList = isArray(value);
  /**
   * lisp structure is:
   * [function, ...args]
   */
  const isLispLike = isList
    && isFunc(value[0]);

  if (!isLispLike) {
    if (isList) {
      /**
       * @important
       * we add to the refId here to ensure that
       * collections are considered one level deeper
       */
      return value.map((v, defaultKey) => {
        /**
         * @important
         * We use the index as a default key so when
         * siblings are shuffled, form controls can
         * still maintain their focus.
         */
        const result = processLisp(
          v, addToRefId(path, '@item'), defaultKey,
          prevCtor, onPathValue,
        );
        return result;
      });
    }

    if (ignoredValues.has(value)) {
      return nullVnode;
    }

    const $type = typeof value;
    if (primitiveTypes.has($type)) {
      return createTextVnode(value);
    }

    validateVnodeValue(value);
    return value;
  }

  const f = getLispFunc(value);
  const isVnodeFn = isType(
    f, valueTypes.domComponent,
  );
  const nextCtor = !isVnodeFn
    ? f : (prevCtor || f);
  const argProcessor = isVnodeFn
    // only eagerly process vnode functions
    ? processLisp : identity;
  const nextKey = isDef(prevKey)
    ? `${prevKey}.${nextCtor.name}`
    : nextCtor.name;
  const config = parseProps(
    value, argProcessor, path,
    nextKey, nextCtor, onPathValue,
  );
  const fInput = isVnodeFn ? config : config.props;
  const {
    props: { [specialProps.$$refId]: $$refId },
  } = config;
  const currentConfig = getCurrentConfig($$refId);
  const isMemoized = currentConfig === config;
  const shouldCacheContext = f !== Fragment;

  if (isMemoized) {
    return getTreeValue($$refId);
  }

  if (shouldCacheContext) {
    setCurrentConfig($$refId, config);
  }

  const nextValue = f(fInput);

  // we know its a vnode, so no more processing is necessary
  if (isVnodeFn) {
    onPathValue($$refId, nextValue, config);
    return nextValue;
  }

  /**
   * consume hooks before continuing so we can apply them
   * to the resulting hook node at the end
   */
  const hooks = consumeHooksQueue();
  // continue recursive process
  const finalValue = processLisp(
    /**
     * IMPORTANT
     * By converting every function result to a fragment it
     * provides us with a consistent hook node between renders.
     * This is important because the function may return different
     * dom structures between renders which would then cause the
     * init/destroy hooks to be triggered due to the element switching,
     * ie: (`div` to `span`).
     */
    toFragment(nextValue),
    $$refId,
    undefined,
    nextCtor,
    onPathValue,
  );

  onPathValue($$refId, finalValue, config);
  enqueueHook($$refId, cleanupOnDestroy);
  addHooks(finalValue, hooks);
  return finalValue;
};

const validateSeedPath = (seedPath) => {
  if (!vnodeKeyTypes[typeof seedPath]) {
    throw new Error(string([
      '[createElement] `seedPath` must be one of types: ',
      `[${Object.keys(vnodeKeyTypes)}]`,
    ]));
  }

  validateKey(seedPath, 'seedPath');
  return seedPath;
};

const FROM_PATH = Symbol('@fromPath');

const seedPathFromPath = (path) =>
  ({ value: path,
     [FROM_PATH]: true });

const WrapChildren = ({ children }) =>
  children;

/**
 * @param {Array} value atomic ui element
 * @param {String | Number} seedPath id prefix
 * @returns vnode
 */
const createElement = (
  value,
  seedPath,
  onPathValue = setTreeValue,
) => {
  const isFromPath = seedPath
    && seedPath[FROM_PATH];
  const validatedPath = isFromPath
    ? seedPath.value
    : validateSeedPath(
      String(seedPath),
    );
  const isLispLike = isArray(value)
    && isFunc(value[0]);

  if (!isLispLike) {
    return createElement(
      [WrapChildren, value],
      seedPath,
      onPathValue,
    );
  }

  const vtree = processLisp(
    value,
    newPath,
    validatedPath,
    undefined,
    onPathValue,
  );
  onVtreeCompleted();

  return vtree;
};

/*
 * TODO:
 * Add support for rendering a fragment
 * so we don't require a single parent vnode.
 */
const renderWith = (
  fromNode, element, seedPath,
) => {
  setIsRendering(true);

  const toNode = createElement(
    element, seedPath, setTreeValue,
  );
  const vtree = patch(fromNode, toNode);

  setIsRendering(false);
  setVtree(seedPath,
    { vtree, element, rootPath: seedPath });
  return vtree;
};

export {
  defineElement,
  nativeElements,
  renderWith,
  createElement,
  valueTypes,
  enqueueHook,
  seedPathFromPath,
};

export {
  getCurrentConfig,
} from './render-context';

export { getDomNode } from './vnode';
