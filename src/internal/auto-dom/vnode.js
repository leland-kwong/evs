import { outdent } from 'outdent';
import { getSupportedEventTypes } from '../../get-event-types';
import { invalidComponentMsg } from './invalid-component-msg';
import { string } from '../string';
import { isArray, isFunc,
  setValue, stringifyValueForLogging, isDef } from '../utils';
import { emptyObj, emptyArr } from '../../constants';
import * as valueTypes from './value-types';

const { isType } = valueTypes;

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

  $$refId(oldId, newId, oldRef, newRef) {
    const domNode = getDomNode(newRef);
    domNode.setAttribute('data-ref-id', newId);
  },

  key(oldKey, newKey, oldRef, newRef) {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    if (!isDef(newKey)) {
      return;
    }

    getDomNode(newRef)
      .setAttribute('data-key', newKey);
  },

  style(oldStyle = {}, newStyleObj, oldRef, ref) {
    const domNode = getDomNode(ref);
    const isDifferentDomNode = oldRef
      ? oldRef.elm !== ref.elm
      : false;

    if (!newStyleObj) {
      setValue(domNode, 'style', null);
    }

    // remove old styles
    if (isDifferentDomNode) {
      const hasOwn = Object.prototype.hasOwnProperty;
      Object.keys(oldStyle).forEach((k) => {
        if (!hasOwn.call(newStyleObj, k)) {
          setValue(domNode.style, k, null);
        }
      });
    }

    Object.keys(newStyleObj).forEach((k) => {
      const nextValue = newStyleObj[k];

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
    && !isType(value, valueTypes.vnode);

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
    type: valueTypes.vnode,
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

  if (isType(value, valueTypes.vnode)) {
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
    children = emptyArr,
    key,
    // special snabbdom hooks
    $$hook: elementHooks = emptyObj,
  } = props;
  const childArray = !isArray(children) ? [children] : children;
  const hasNestedCollections = childArray.find(isArray);
  const flattendChildren = hasNestedCollections
    ? childArray.flat(Infinity)
    : childArray;
  const isComment = tagName === '!';

  return {
    sel: tagName,
    props,
    key,
    /*
     * TODO:
     * Check if `data` property is necessary for
     * snabbdom to work
     */
    data: {
      hook: elementHooks,
      handleProp,
    },
    text: isComment
      ? flattendChildren.join('')
      : undefined,
    children: isComment
      ? emptyArr
      : flattendChildren
        .reduce(coerceToVnode, []),
    type: valueTypes.vnode,
  };
};

export {
  createVnode, createTextVnode,
  ignoredValues, primitiveTypes,
  getDomNode,
};
