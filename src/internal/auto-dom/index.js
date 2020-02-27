import isPlainObject from 'is-plain-object';
import { outdent } from 'outdent';
import * as snabbdom from 'snabbdom';
import snabbdomAttributes from 'snabbdom/modules/attributes';
import snabbdomClass from 'snabbdom/modules/class';
import snabbdomStyle from 'snabbdom/modules/style';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import { isArray, isFunc,
  setValue, stringifyValueForLogging } from '../utils';

const vnodeType = Symbol('@vnode');

const patch = snabbdom.init([
  snabbdomAttributes,
  snabbdomClass,
  snabbdomProps,
  /*
   * TODO:
   * We should do all modifications via just
   * a single props object like react so
   * we don't have to create 3 different objects
   * to separate things out. This dramatically
   * simplifies the api and our code because we
   * don't have to do conditional checks for
   * things like if it is a vnode, then don't
   * include the children, etc...
   *
   * TODO:
   * Style module seems to be way over-optimized
   * for our use case. Its not reapplying styles
   * when they don't change for some reason. We
   * should just move all the styling logic to
   * the props object.
   */
  snabbdomStyle,
]);

const isVnode = (node) =>
  (node
    ? node[vnodeType]
    : false);

const remapProp = {
  // do nothing here because we don't
  // want it reflected to the dom during
  // rendering
  children() {},

  class(value, props) {
    setValue(props, 'className', value);
  },

  onChange(value, props, attrs) {
    setValue(attrs, 'evs.change', value);
  },
  onInput(value, props, attrs) {
    setValue(attrs, 'evs.input', value);
  },
  onClick(value, props, attrs) {
    setValue(attrs, 'evs.click', value);
  },
};

const prepareVnodeData = (oProps) => {
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
  if (isVnode(value)) {
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
  newChildren.push({ text: value });
  return newChildren;
}

function Vnode(tagName, oProps) {
  const { children } = oProps;
  const { props, attrs, style } = prepareVnodeData(oProps, children);

  return {
    sel: tagName,
    // original props
    props: oProps,
    data: { attrs, props, style },
    children: children.reduce(
      coerceToVnode, [],
    ),
    [vnodeType]: true,
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

    return Vnode(
      'div',
      { style: styles.container },
      [
        Vnode(
          'div',
          { style: styles.helpText },
          ['invalid component detected:'],
        ),
        Vnode(
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
  lisp = [],
  callback = identity,
  startFrom = 0,
  endAt = lisp.length,
) => {
  const { length } = lisp;
  let hasArrayValue = false;
  let i = startFrom;
  // mutated in while loop
  const args = new Array(length - startFrom);

  while (i < endAt) {
    const arg = lisp[i];
    const value = validateValue(
      callback(arg),
    );
    const currentIndex = i - startFrom;

    hasArrayValue = hasArrayValue || isArray(value);
    args[currentIndex] = value;
    i += 1;
  }

  return [args, hasArrayValue];
};

const getVnodeProps = (args, hasArrayValue) => {
  const firstArg = args[0];
  const hasProps = isPlainObject(firstArg)
    && !isVnode(firstArg);
  const props = hasProps
    // remove the first argument
    ? args.shift()
    : {};
  // auto-expand children
  const children = hasArrayValue
    ? args.flat() : args;

  // don't mutate the original
  return { ...props, children };
};

const getLispFunc = (lisp) =>
  lisp[0];

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
  // everything after the first value
  const [args, hasArrayValue] = sliceList(value, processLisp, 1);
  const props = getVnodeProps(args, hasArrayValue);
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
    Vnode(tagName, props);

  elementFactory.isVnodeFactory = true;

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
  isVnode,
};
