import isPlainObject from 'is-plain-object';
import { init as snabbdomInit } from 'snabbdom';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import {
  createVnode, ignoredValues,
} from './vnode';
import { string } from '../string';
import { isArray, isFunc,
  isDef,
  stringifyValueForLogging,
  setValue,
  identity } from '../utils';
import { emptyObj, emptyArr } from '../../constants';
import * as valueTypes from './value-types';

const { isType } = valueTypes;

const vnodeKeyTypes = {
  string: true,
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
  // mutated in while loop
  const args = new Array(Math.max(0, length - skip));
  let i = 0;

  while (i < args.length) {
    const argIndex = i + skip;
    const arg = lisp[argIndex];
    const refId = addToRefId(path, i);
    const evaluated = callback(arg, refId);

    args[i] = evaluated;
    i += 1;
  }

  return args;
};

const propTransformer = {
  children(props, _, childrenFromArgs) {
    setValue(props, 'children',
      props.children
      || childrenFromArgs);
  },
  hookInit(props, key, value) {
    setValue(props.$$hook, 'init', value);
  },
  hookCreate(props, key, value) {
    setValue(props.$$hook, 'create', value);
  },
  hookUpdate(props, key, value) {
    setValue(props.$$hook, 'update', value);
  },
  hookDestroy(props, key, value) {
    setValue(props.$$hook, 'destroy', value);
  },
};

/**
 * Mutates the source by applying transformations
 * and remapping as necessary
 */
const transformProps = (
  source, config,
) => {
  const src = source;
  const keys = Object.keys(config);

  let i = 0;
  while (i < keys.length) {
    const k = keys[i];
    const v = config[k];
    const transformer = propTransformer[k];

    if (transformer) {
      transformer(src, k, v);
    } else {
      src[k] = v;
    }
    i += 1;
  }

  return src;
};

/**
 * @param {Array|arguments} value
 * @param {Function} argProcessor
 * @returns props object
 */
const parseProps = (value = [], argProcessor, path) => {
  const firstArg = value[1];
  const hasProps = isPlainObject(firstArg)
    && !isType(firstArg, valueTypes.vnode);
  const props = hasProps ? firstArg : emptyObj;
  const skipValues = hasProps ? 2 : 1;
  const args = prepareArgs(
    value, argProcessor, path, skipValues,
  );
  const childrenLength = args.length;
  const children = childrenLength > 0
    ? args
    : props.children;
  const hasDuplicateChildrenProps = childrenLength > 0
    && props.children;

  if (hasDuplicateChildrenProps) {
    throw new Error(
      'You may not have both a children prop and children arguments',
    );
  }

  const lastDotIndex = path.lastIndexOf('.');
  const refId = props.key
    /**
     * Replace last position of id with key so that
     * the id remains consistent when an element's
     * position changes amongst its siblings.
     */
    ? addToRefId(
      path.slice(0, lastDotIndex !== -1
        ? lastDotIndex : path.length),
      props.key,
    )
    : path;

  const baseProps = {
    children,
    $$hook: {},
    $$refId: refId,
  };

  return transformProps(baseProps, props);
};

const getLispFunc = (lisp) =>
  lisp[0];

/**
 * Recursively processes a tree of Arrays
 * as lisp data structures.
 */
const processLisp = (value, path) => {
  const isList = isArray(value);
  /**
   * lisp structure is:
   * [function, ...args]
   */
  const isLispLike = isList
    && isFunc(value[0]);

  if (!isLispLike) {
    if (isList) {
      return value.map((v, i) => {
        const refId = addToRefId(path, i);
        return processLisp(v, refId);
      });
    }

    return value;
  }

  const v = value;
  // add type annotation
  v.type = valueTypes.fnComponent;

  const f = getLispFunc(value);
  const argProcessor = isType(
    f, valueTypes.domComponent,
  ) // only eagerly process vnode functions
    ? processLisp : identity;
  const props = parseProps(
    value, argProcessor, path,
  );
  const nextValue = f(props, path);
  const key = validateKey(
    props.key || value.$$keyPassthrough,
  );

  if (isDef(key)
    && !ignoredValues.has(nextValue)
  ) {
    if (isType(nextValue, valueTypes.vnode)) {
      /**
       * Automatically transfer key to vnode in case it
       * wasn't passed through explicitly.
       */
      nextValue.key = key;
    } else {
      // pass key through to next function
      nextValue.$$keyPassthrough = key;
    }
  }

  return processLisp(nextValue, props.$$refId);
};

const validateSeedPath = (seedPath) => {
  if (!vnodeKeyTypes[typeof seedPath]) {
    throw new Error(string([
      '[createElement] `seedPath` must be a string',
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

const generateSeedPath = () =>
  Math.random()
    .toString(32)
    .slice(2, 6);

/*
 * TODO:
 * Add support for rendering an array of vnodes
 * so we don't require a single parent vnode.
 */
const renderToDomNode = (
  domNodeOrComponent,
  component,
  seedPath,
) => {
  const d = domNodeOrComponent;
  const oldVnode = isType(d, valueTypes.vnode)
    ? d : d.$$oldVnode;
  const fromNode = oldVnode || d;
  const path = oldVnode
    ? oldVnode.props.$$refId
    : seedPath || generateSeedPath();
  const toNode = createElement(component, path);

  patch(fromNode, toNode);
  /*
   * TODO:
   * Refactor so that we don't need to store vnode
   * reference on the dom node directly, and instead
   * store it in our own cache.
   */
  /**
   * Add vnode reference on dom node for convenience so
   * you can just render with the dom node as the fromNode
   * every time.
   */
  toNode.elm.$$oldVnode = toNode;

  return toNode;
};

/**
 * Extend an element, by assign new props.
 * New children will replace existing children.
 */
const cloneElement = (...args) => {
  const [element, config, children = []] = args;

  if (!isType(element, valueTypes.vnode)) {
    throw new Error(
      '[cloneElement] Element must be a vnode',
    );
  }

  const { sel } = element;
  const props = config
    ? transformProps(
      { ...element.props },
      config,
    )
    // keep original
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
  valueTypes,
};

export { getDomNode } from './vnode';
