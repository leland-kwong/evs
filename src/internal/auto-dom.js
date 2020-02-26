import isPlainObject from 'is-plain-object';
import { outdent } from 'outdent';
import { isFunc } from './is-func';

const stringifyValueForLogging = (
  value,
) =>
  JSON.stringify(value, (key, v) => {
    if (isFunc(v)) {
      return v.toString();
    }
    return v;
  });

const toValue = Symbol('@toValue');

/*
 * TODO:
 * Build a custom inspector that maps the lisp structure
 * to the dom? This could be awesome if we can manage it.
 * Not sure about the complexity though.
 */

const { isArray } = Array;

const getSpecialValue = (v) => {
  const dataFn = v
    ? v[toValue]
    : null;

  if (dataFn) {
    return dataFn(v);
  }

  return v;
};

function transformToProperType(newChildren, value) {
  if (value && value.isVNode) {
    newChildren.push(value);
    return newChildren;
  }

  const isFalsy = value === false
    || value === null;
  // ignore falsy values
  if (isFalsy) {
    return newChildren;
  }

  // auto-expand nested list
  const isCollection = isArray(value);

  if (isCollection) {
    newChildren.push(
      ...value.reduce(
        transformToProperType,
        [],
      ),
    );
    return newChildren;
  }

  newChildren.push({ type: 'text', value });
  return newChildren;
}

// hast-compatible vnode
function VNode(tagName, props, children) {
  return {
    type: 'element',
    tagName,
    properties: getSpecialValue(props),
    // TODO: definitely not optimized right now
    children: children.reduce(
      transformToProperType,
      [],
    ),
    isVNode: true,
  };
}

const identity = (v) =>
  v;

const invalidCollectionValue = (value) =>
  isArray(value);

const validateValue = (value) => {
  const isInvalidCollection = isArray(value)
    && value.find(invalidCollectionValue);

  if (isFunc(value)
    || isInvalidCollection
  ) {
    const stringified = stringifyValueForLogging(value);

    console.warn(outdent`
      Sorry,

      ${stringified}

      is not a valid component. This commonly happens when
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

    return VNode(
      'div',
      { style: styles.container },
      [
        VNode(
          'div',
          { style: styles.helpText },
          ['invalid component detected:'],
        ),
        VNode(
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
  arrayLike,
  callback = identity,
  startFrom = 0,
  endAt = arrayLike.length,
) => {
  const { length } = arrayLike;
  let i = startFrom;
  // mutated in while loop
  const args = new Array(length - startFrom);

  while (i < endAt) {
    const arg = arrayLike[i];
    const value = validateValue(
      callback(arg),
    );
    const currentIndex = i - startFrom;

    args[currentIndex] = value;

    i += 1;
  }

  return args;
};

const emptyProps = Object.freeze({});

const getVNodeProps = (args) => {
  const firstArg = args[0];
  const hasPropArg = isPlainObject(firstArg)
    && !firstArg.tagName;

  if (hasPropArg) {
    const props = args.shift();
    const children = args;

    return { props, children };
  }

  return {
    props: emptyProps,
    children: args,
  };
};

/**
 * list component is:
 * [ArrayLike, projectFunction]
 */
const isListComponent = (value) => {
  if (!value) {
    return false;
  }

  const firstArg = value[0];
  const isListArg = isArray(firstArg);
  const hasProjectFn = typeof value[1] === 'function';

  return isListArg
    && hasProjectFn;
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
    if (isListComponent(value)) {
      const [items, project] = value;

      return items.map((v) =>
        processLisp(project(v)));
    }

    return value;
  }

  const f = getLispFunc(value);
  // ignore first value since it
  // is the lisp function.
  const args = sliceList(value, processLisp, 1);
  const { props, children } = getVNodeProps(args);
  const nextValue = f(props, children);

  return processLisp(nextValue);
};

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

function createElement(templateFn, arg) {
  return processLisp(
    templateFn(arg),
  );
}

export { createElement, toValue };
