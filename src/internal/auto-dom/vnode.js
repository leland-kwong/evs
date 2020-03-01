import { outdent } from 'outdent';
import { getSupportedEventTypes } from '../../get-event-types';
import { invalidComponentMsg } from './invalid-component-msg';
import { string } from '../string';
import { isArray, isFunc,
  setValue, stringifyValueForLogging } from '../utils';

const vnodeType = Symbol('@vnode');

const getDomNode = (vnode) =>
  vnode.elm;

// vnode utils
const isVnode = (node) =>
  (node
    ? node[vnodeType]
    : false);

const remappedEventTypes = {
  focusin: 'focus',
  focusout: 'blur',
};

const handleProp = Object.freeze({
  // do nothing here because we want to
  // exclude it from being applied to the dom
  children() {},

  style(oldStyle, newStyleObj, oldRef, ref) {
    const domNode = getDomNode(ref);
    const isDifferentDomNode = oldRef && oldRef.elm
      !== ref.elm;

    if (!newStyleObj) {
      setValue(domNode, 'style', null);
    }

    // remove old styles
    if (isDifferentDomNode) {
      const hasOwn = Object.prototype.hasOwnProperty;
      Object.keys(oldStyle || {}).forEach((k) => {
        if (!hasOwn.call(newStyleObj, k)) {
          setValue(domNode.style, k, null);
        }
      });
    }

    Object.keys(newStyleObj).forEach((k) => {
      const nextValue = newStyleObj[k];
      const isSameValue = oldStyle
        && oldStyle[k] === nextValue;

      if (isSameValue) return;
      setValue(
        domNode.style, k, nextValue,
      );
    });
  },

  class(oldValue, newValue, oldRef, ref) {
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
      oldValue, newValue, oldRef, ref,
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

  const isObjectChild = typeof value === 'object'
    && !isVnode(value);

  if (isObjectChild) {
    const stringified = stringifyValueForLogging(value);
    throw new Error(string([
      'Sorry, objects are not valid as a child. If ',
      'you meant to render a collection you should ',
      'use an array instead. Received:\n\n',
      stringified,
      '\n',
    ]));
  }

  // children should not be nested arrays
  const isNestedCollection = isArray(value);

  if (isNestedCollection) {
    throw new Error(
      invalidComponentMsg(value),
    );
  }

  return value;
};

function createTextVnode(value) {
  return {
    text: value,
    [vnodeType]: true,
  };
}

const ignoredValues = new Set([
  false,
  true,
  null,
  undefined,
]);

const primitiveTypes = new Set([
  'string',
  'number',
]);

function coerceToVnode(newChildren, value) {
  if (ignoredValues.has(value)) {
    return newChildren;
  }

  if (isVnode(value)) {
    newChildren.push(value);
    return newChildren;
  }

  const isPrimitive = primitiveTypes
    .has(typeof value);
  if (isPrimitive) {
    newChildren.push(
      createTextVnode(value),
    );
    return newChildren;
  }

  if (process.env.NODE_ENV === 'development') {
    validateValue(value);
  }

  return newChildren;
}

const createVnode = (tagName, props) => {
  const {
    children = [],
    // special snabbdom hooks
    $hook: elementHooks = {},
  } = props;
  const childArray = !isArray(children) ? [children] : children;
  const hasNestedCollections = childArray.find(isArray);
  const flattendChildren = hasNestedCollections
    ? childArray.flat()
    : childArray;

  return {
    sel: tagName,
    props,
    /*
     * TODO:
     * Check if `data` property is necessary for
     * snabbdom to work
     */
    data: {
      key: props.key,
      hook: elementHooks,
      handleProp,
    },
    children: flattendChildren
      .reduce(coerceToVnode, []),
    [vnodeType]: true,
  };
};

export {
  createVnode, createTextVnode, isVnode,
  vnodeType, ignoredValues, primitiveTypes,
  getDomNode,
};
