import isPlainObject from 'is-plain-object';
import outdent from 'outdent';
import { isFunc } from './is-func';

const toValue = Symbol('@toValue');

/**
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

const identity = (v) =>
  v;

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
    const val = callback(arg);

    args[i - startFrom] = val;
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
    // pop off first item for props
    const props = args.shift();
    // use whats left in the array as the children
    const children = args;

    return { props, children };
  }

  const isNodeList = isArray(firstArg);

  if (isNodeList) {
    return { children: firstArg };
  }

  return { props: emptyProps, children: args };
};

const listComponentFormat = outdent`
  \`\`\`js
  const items = [1, 2, 3];
  const mapFunction = (num) => [li, num]
  const ListComponent = (
    [ul,
      [items, // <- array must be first value
        mapFunction]] // <- function must be second value
  )
  \`\`\`
`;

const validateListComponent = (
  isListArg, hasProjectFn,
) => {
  const isMissingProjectFn = isListArg
    && !hasProjectFn;

  if (isMissingProjectFn) {
    throw new Error(outdent`
      List component is missing a map function.
      For example, we should do:

      ${listComponentFormat}
    `);
  }

  return isListArg && hasProjectFn;
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

  return validateListComponent(
    isListArg,
    hasProjectFn,
  );
};

const validateVNodeResult = (value) => {
  if (isArray(value)) {
    throw new Error(outdent`
      We found \`${value.toString().slice(0, 20)}\` as a vdom value.
      Did you mean for this to be a list component?
      We can make a list component by doing:

      ${listComponentFormat}
    `);
  }

  return value;
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

    return validateVNodeResult(value);
  }

  const f = getLispFunc(value);
  // ignore first value since it
  // is the lisp function.
  const args = sliceList(value, processLisp, 1);
  const { props, children } = getVNodeProps(args);
  const nextValue = f(props, children);

  return processLisp(nextValue);
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

  newChildren.push({ type: 'text', value });
  return newChildren;
}

// hast-compatible vnode
function VNode(tagName, props, children) {
  return {
    type: 'element',
    tagName,
    properties: getSpecialValue(props),
    // TODO: as an optimization, we can update in place
    children: children.reduce(
      transformToProperType,
      [],
    ),
    isVNode: true,
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

function createElement(templateFn, arg) {
  return processLisp(
    templateFn(arg),
  );
}

export { createElement, toValue };
