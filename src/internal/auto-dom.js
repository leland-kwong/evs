import isPlainObject from 'is-plain-object';
import { outdent } from 'outdent';
import * as snabbdom from 'snabbdom';
import snabbdomAttributes from 'snabbdom/modules/attributes';
import snabbdomClass from 'snabbdom/modules/class';
import snabbdomProps from 'snabbdom/modules/props';
import snabbdomStyle from 'snabbdom/modules/style';
import { elementTypes } from './element-types';
import { isArray } from './utils';
import { isFunc } from './is-func';

const patch = snabbdom.init([
  snabbdomAttributes,
  snabbdomClass,
  snabbdomProps,
  snabbdomStyle,
]);

const isElement = (node) =>
  (node
    ? node.isVNode
    : false);

const set = (obj, key, value) => {
  const o = obj;

  o[key] = value;
  return obj;
};

const remapProp = {
  // do nothing here because we don't
  // want it reflected to the dom during
  // rendering
  children() {},

  class(value, props) {
    set(props, 'className', value);
  },

  onInput(value, props, attrs) {
    set(attrs, 'evs.input', value);
  },
  onClick(value, props, attrs) {
    set(attrs, 'evs.click', value);
  },
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

/*
 * TODO:
 * Build a custom inspector that maps the lisp structure
 * to the dom? This could be awesome if we can manage it.
 * Not sure about the complexity though.
 */

const prepareVNodeData = (oProps) => {
  const props = {};
  const attrs = {};
  const { style } = oProps;
  const keys = Object.keys(oProps);
  let i = 0;

  while (i < keys.length) {
    const k = keys[i];
    const remapper = remapProp[k];
    const value = oProps[k];

    if (remapper) {
      remapper(value, props, attrs);
    } else {
      props[k] = value;
    }

    i += 1;
  }
  return { props, attrs, style };
};

function coerceToVnode(newChildren, value) {
  if (isElement(value)) {
    newChildren.push(value);
    return newChildren;
  }

  const isFalsy = value === false
    || value === null;
  // ignore falsy values
  if (isFalsy) {
    return newChildren;
  }

  // everything else we consider text
  newChildren.push({
    text: value,
  });
  return newChildren;
}

function VNode(tagName, oProps) {
  const { children } = oProps;
  const { props, attrs, style } = prepareVNodeData(oProps, children);

  return {
    sel: tagName,
    // original props
    props: oProps,
    data: { attrs, props, style },
    children: children.reduce(
      coerceToVnode,
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
    && !isElement(firstArg);
  const props = hasProps
    // remove the first argument
    ? args.shift()
    : {};
  const children = args.flat();

  // don't mutate the original
  return { ...props, children };
};

const getLispFunc = (lisp) =>
  lisp[0];

/**
 * lisp structure is:
 * [function, ...args]
 */
const isLispLike = (v) =>
  isArray(v) && isFunc(v[0]);

const processLisp = (
  value,
) => {
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
const defineElement = (tagName) => {
  const elementFactory = (props) =>
    VNode(tagName, props);

  elementFactory.isVNodeFactory = true;

  return elementFactory;
};

const createElement = processLisp;

const renderToDomNode = (domNode, component) => {
  const d = domNode;
  const fromNode = d.oldVnode || domNode;
  const toNode = processLisp(component);

  patch(fromNode, toNode);
  d.oldVnode = toNode;
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
  isElement,
};
