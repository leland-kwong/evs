import isPlainObject from 'is-plain-object';
import { isFunc } from './is-func';

/**
 * Build a custom inspector that maps the lisp structure
 * to the dom? This could be awesome if we can manage it.
 * Not sure about the complexity though.
 */

const { isArray } = Array;

const getSpecialValue = (v) => {
  const dataFn = v
    ? v.$specialValue
    : null;
  if (dataFn) {
    return dataFn(v);
  }

  return v;
};

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

const emptyProps = Object.freeze({});

const isEmptyProps = (v) =>
  v === emptyProps;

const getVNodeProps = (args) => {
  const firstArg = args[0];
  if (isPlainObject(firstArg)
    && !firstArg.tagName) {
    return firstArg;
  }
  return emptyProps;
};

const getVNodeChildren = (
  args, props, processAsLisp,
) => {
  const firstArg = args[0];
  const isNodeList = isArray(firstArg);

  if (isNodeList) {
    return firstArg.map(processAsLisp);
  }

  const hasProps = !isEmptyProps(props);
  if (hasProps) {
    return sliceList(args, identity, 1);
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
  const props = getVNodeProps(args);
  const children = getVNodeChildren(args, props, processLisp);
  const nextValue = f(props, children);

  return processLisp(nextValue);
};

function coerceToProperType(node) {
  if (typeof node === 'string'
    || typeof node === 'number') {
    return { type: 'text', value: node };
  }
  return node;
}

// hast-compatible vnode
function VNode(tagName, props, children) {
  return {
    type: 'element',
    tagName,
    properties: getSpecialValue(props),
    // TODO: as an optimization, we can update in place
    children: children.map(
      coerceToProperType,
    ),
  };
}

const tagCache = new Map();

export const autoDom = new Proxy({}, {
  /**
   * auto-generates a element vnode function
   * based on the tag name.
   */
  get(source, tagName) {
    const fromCache = tagCache.get(tagName);

    if (fromCache) return fromCache;

    /**
     * Supports the following formats
     *
     * [tagFn, nodeList]
     * [tagFn, props, nodeList]
     * [tagFn, props, node1, node2, ...]
     * [tagFn, node1, node2, ...]
     */
    const newElement = (props, children) =>
      VNode(tagName, props, children);

    tagCache.set(tagName, newElement);

    return newElement;
  },
});

export function createElement(templateFn, arg) {
  return processLisp(
    templateFn(arg),
  );
}
