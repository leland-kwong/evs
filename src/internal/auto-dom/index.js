import isPlainObject from 'is-plain-object';
import { outdent } from 'outdent';
import * as snabbdom from 'snabbdom';
import snabbdomProps from './snabbdom-modules/props';
import { elementTypes } from '../element-types';
import { getSupportedEventTypes } from '../../get-event-types';
import { invalidComponentMsg } from './invalid-component-msg';
import { isArray, isFunc,
  setValue, stringifyValueForLogging } from '../utils';

const vnodeType = Symbol('@vnode');

const patch = snabbdom.init([
  snabbdomProps,
]);

// vnode utils
const isVnode = (node) =>
  (node
    ? node[vnodeType]
    : false);

const getDomNode = (vnode) =>
  vnode.elm;

const remappedEventTypes = {
  focusin: 'focus',
  focusout: 'blur',
};

const handleProp = Object.freeze({
  // do nothing here because we want to
  // exclude it from being applied to the dom
  children() {},

  style(oldStyle = {}, newStyleObj, ref) {
    const domNode = getDomNode(ref);
    Object.keys(newStyleObj).forEach((k) => {
      const nextValue = newStyleObj[k];
      const isSameValue = oldStyle[k] === nextValue;

      if (isSameValue) return;
      setValue(
        domNode.style, k, nextValue,
      );
    });
  },

  class(oldValue, newValue, ref) {
    setValue(
      getDomNode(ref), 'className', newValue,
    );
  },

  /*
   * TODO:
   * We should probably setup the synthetic event system
   * so we can do more advance event handling that the
   * traditional system can't do for us.
   */
  // setup builtin dom event types
  ...[
    ...getSupportedEventTypes(),
    'focusin',
    'focusout',
  ].reduce((handlerCallbacks, eventName) => {
    const h = handlerCallbacks;
    const remappedName = remappedEventTypes[eventName];
    const domEventPropName = `on${remappedName || eventName}`;

    h[domEventPropName] = (
      oldValue, newValue, ref,
    ) => {
      getDomNode(ref)[
        domEventPropName] = newValue;
    };

    return handlerCallbacks;
  }, {}),
});

const validateValue = (value) => {
  const isFuncChild = isFunc(value);

  if (isFuncChild) {
    const stringified = stringifyValueForLogging(value);
    throw new Error(outdent`
      Sorry, functions are not valid as a child.

      Received:
      ${stringified}

    `);
  }

  const isObjectChild = value !== null
    && !isVnode(value)
    && isPlainObject(value);

  if (isObjectChild) {
    const stringified = stringifyValueForLogging(value);
    throw new Error(outdent`
      Sorry, objects are not valid as a child.

      Received:
      ${stringified}

    `);
  }

  // children should not be nested arrays
  const isInvalidCollection = isArray(value);

  if (isInvalidCollection
      && process.env.NODE_ENV === 'development'
  ) {
    throw new Error(
      invalidComponentMsg(value),
    );
  }

  return value;
};

function textVnode(text) {
  return {
    text,
    [vnodeType]: true,
  };
}

const falsyValues = new Set([
  false,
  null,
  undefined,
]);

function coerceToVnode(newChildren, value) {
  // ignore falsy values
  if (falsyValues.has(value)) {
    return newChildren;
  }

  if (isVnode(value)) {
    newChildren.push(value);
    return newChildren;
  }

  // everything else we consider text
  newChildren.push(
    textVnode(value),
  );
  return newChildren;
}

/* rename this to createVnode or something more idiomatic */
const Vnode = (tagName, props) => {
  const { children = [] } = props;

  return {
    sel: tagName,
    props,
    /*
     * TODO:
     * Check if `data` property is necessary for
     * snabbdom to work
     */
    data: {
      handleProp,
    },
    children: children.reduce(
      coerceToVnode, [],
    ),
    [vnodeType]: true,
  };
};

/**
 * Clone and return a new vnode. New children will
 * replace existing children.
 */
const cloneElement = (vnode, props, children) => {
  const { sel } = vnode;
  /*
   * TODO:
   * Need to figure out an idiomatic way to also
   * combine the hooks
   */
  const newProps = { ...vnode.props,
                     ...props,
                     children };

  return Vnode(sel, newProps);
};

const identity = (v) =>
  v;

const prepareArgs = (
  lisp = [],
  callback = identity,
) => {
  // console.log(lisp);
  const startFrom = 1;
  const endAt = lisp.length;
  const { length } = lisp;
  let hasArrayValue = false;
  let i = startFrom;
  // mutated in while loop
  const args = new Array(length - startFrom);

  while (i < endAt) {
    const arg = lisp[i];
    const value = callback(arg);
    const currentIndex = i - startFrom;

    hasArrayValue = hasArrayValue || isArray(value);
    args[currentIndex] = value;
    i += 1;
  }

  return [args, hasArrayValue];
};

const parseProps = (args, hasArrayValue) => {
  const firstArg = args[0];
  const hasProps = isPlainObject(firstArg)
    && !isVnode(firstArg);
  const props = hasProps
    // remove the first argument
    ? args.shift() : {};
  const { children: childrenFromProps } = props;
  const children = hasArrayValue
    // auto-expand children
    ? args.flat() : args;
  const combinedChildren = childrenFromProps
    ? [...childrenFromProps, ...children]
    : children;

  if (process.env.NODE_ENV === 'development') {
    combinedChildren
      .forEach(validateValue);
  }

  /**
   * we can validate/sanitize the props
   */
  // don't mutate the original
  return { ...props,
           children: combinedChildren };
};

const getLispFunc = (lisp) =>
  lisp[0];

/**
 * Recursively processes a tree of Arrays
 * as lisp data structures.
 */
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
  const [args, hasArrayValue] = prepareArgs(value, processLisp);
  const props = parseProps(args, hasArrayValue);
  const nextValue = f(props);

  return processLisp(nextValue);
};

const createElement = processLisp;

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
  function elementFactory(props) {
    return Vnode(tagName, props);
  }

  const defineProps = Object.defineProperties;
  return defineProps(elementFactory, {
    name: {
      value: tagName,
    },
    isVnodeFactory: {
      value: true,
    },
  });
};

/*
 * TODO:
 * Add support for rendering an array of vnodes
 * so we don't require a single parent vnode.
 */
const renderToDomNode = (domNode, component) => {
  const d = domNode;
  const fromNode = d.oldVnode || domNode;
  const toNode = createElement(component);

  d.oldVnode = toNode;
  patch(fromNode, toNode);
};

const nativeElements = Object.keys(elementTypes)
  .reduce((elementFactories, tagName) => {
    const e = elementFactories;

    e[tagName] = defineElement(tagName);

    return e;
  }, {});

// this is how you create a comment in snabbdom
nativeElements.comment = defineElement('!');

export {
  defineElement,
  nativeElements,
  renderToDomNode,
  getDomNode,
  createElement,
  cloneElement,
};
