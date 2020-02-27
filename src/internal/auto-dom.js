import isPlainObject from 'is-plain-object';
import { outdent } from 'outdent';
import toDOM from 'hast-util-to-dom';
import morphdom from 'morphdom';
import { isFunc } from './is-func';
import { elementTypes } from './element-types';

/** automate list of supported events */
const eventTypes = {
  onInput: 'evs.input',
  onClick: 'evs.click',
};

const prepareProps = (obj, children) => {
  const newO = { children };
  const keys = Object.keys(obj);
  let i = 0;

  while (i < keys.length) {
    const k = keys[i];
    const remapped = eventTypes[k];
    const value = obj[k];

    if (remapped) {
      newO[remapped] = value;
    } else {
      newO[k] = value;
    }

    i += 1;
  }
  return newO;
};

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

  newChildren.push({ type: 'text', value });
  return newChildren;
}

const isElement = (node) =>
  (node
    ? node.type === 'element'
    : false);

// hast-compatible vnode
function VNode(tagName, props) {
  const { children } = props;
  const p = props;

  // prevent prop from surfacing in dom
  delete p.children;

  return {
    type: 'element',
    tagName,
    properties: getSpecialValue(props),
    children: children.reduce(
      transformToProperType,
      [],
    ),
    isVNode: true,
  };
}

const identity = (v) =>
  v;

// values should not be nested arrays
const invalidCollectionValue = (value) =>
  isArray(value);

const validateValue = (value) => {
  if (process.env.NODE_ENV !== 'development') {
    return value;
  }

  const isInvalidCollection = isArray(value)
    && value.find(invalidCollectionValue);

  if (isFunc(value)
    || isInvalidCollection
  ) {
    const stringified = (() => {
      const res = stringifyValueForLogging(value);
      if (res.length > 300) {
        return `${res.slice(0, 300)} ...`;
      }
      return res;
    })();

    console.warn(outdent`
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

const getVNodeProps = (args) => {
  const firstArg = args[0];
  const hasProps = isPlainObject(firstArg)
    && !firstArg.tagName;

  if (hasProps) {
    const props = args.shift();
    const children = args.flat();

    return prepareProps(props, children);
  }

  return {
    children: args.flat(),
  };
};

const getLispFunc = (lisp) =>
  lisp[0];

/**
 * lisp structure is:
 * [function, ...args]
 */
const isLispLike = (v) =>
  v && isFunc(v[0]);

const processLisp = (
  value,
) => {
  // console.log(value);
  if (!isLispLike(value)) {
    const isCollection = isArray(value);

    if (isCollection) {
      return value.map(processLisp);
    }

    return value;
  }

  const f = getLispFunc(value);
  // ignore first value since it
  // is the lisp function.
  const args = sliceList(value, processLisp, 1);
  const props = getVNodeProps(args);
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
const defineElement = (tagName) =>
  (props) =>
    VNode(tagName, props);

const createElement = processLisp;

const renderToDomNode = (domNode, component) => {
  const newDom = toDOM(processLisp(component));

  morphdom(domNode, newDom);
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
  toValue,
  isElement,
};
