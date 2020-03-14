import { outdent } from 'outdent';
import createDebug from 'debug';
import { getSupportedEventTypes } from '../../get-event-types';
import { invalidComponentMsg } from './invalid-component-msg';
import { string } from '../string';
import { isArray, isFunc,
  setValue, stringifyValueForLogging, isDef, exec } from '../utils';
import { emptyArr } from '../constants';
import {
  clearRenderContext,
} from './render-context';
import * as valueTypes from './value-types';

const hookDebug = createDebug('vnode-hook');

let hooksQueue = [];
const enqueueHook = (refId, callback, arg) => {
  hooksQueue.push([refId, callback, arg]);
};
const consumeHooksQueue = () => {
  const hooks = hooksQueue;

  hooksQueue = [];
  return hooks;
};

const treeValues = new Map();
const getTreeValue = (refId) =>
  treeValues.get(refId);
const setTreeValue = (refId, value) => {
  treeValues.set(refId, value);
};
const hasTreeValue = (refId) =>
  treeValues.has(refId);
const deleteTreeValue = (refId) => {
  treeValues.delete(refId);
};

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
      .setAttribute('data-key', newRef.key);
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

const validateVnodeValue = (value) => {
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
    && !isType(value, valueTypes.vnode)
    && !isType(value, valueTypes.vnodeText);

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
    type: valueTypes.vnodeText,
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

const builtinHooks = {
  init: exec(
    (initCallback) =>
      (vnode) => {
        hookDebug('[init]', vnode);

        const { customHooks } = vnode;
        customHooks.forEach(initCallback);
      },
    ([refId, fn, arg]) => {
      fn('init', refId, arg);
    },
  ),
  prepatch(oldVnode, vnode) {
    hookDebug('[prepatch]', oldVnode, vnode);
  },
  update: exec(
    (updateCallback) =>
      (oldVnode, vnode) => {
        /**
         * This check helps differentiate if it was
         * a true update or that it was a component switch.
         */
        const isComponentSwitch = oldVnode.ctor
          !== vnode.ctor
          /**
           * snabbdom provides an empty vnode on the first
           * `patch` call. We know how the vnode was created
           * by checking the `type` property because it is
           * added by our own api.
           */
          && isType(oldVnode, valueTypes.vnode);
        const updateType = isComponentSwitch
          ? '[update -> new_component]' : '[update]';
        hookDebug(updateType, oldVnode, vnode);
        const { customHooks } = vnode;
        customHooks.forEach(updateCallback, updateType);
      },
    function updateCallback([refId, fn, arg]) {
      fn(this, refId, arg);
    },
  ),
  postpatch(oldVnode, vnode) {
    hookDebug('[postpatch]', oldVnode, vnode);
  },
  destroy: exec(
    (hookCallback) =>
      (vnode) => {
        hookDebug('[destroy]', vnode);
        const { customHooks } = vnode;
        const { $$refId: vnodeId } = vnode.props;

        customHooks.forEach(hookCallback);
        deleteTreeValue(vnodeId);
        clearRenderContext(vnodeId);
      },
    ([refId, fn, arg]) => {
      fn('destroy', refId, arg);
    },
  ),
};

const createVnode = (tagNameOrVnode, config) => {
  const isVnode = valueTypes.isType(
    tagNameOrVnode,
    valueTypes.vnode,
  );

  if (isVnode) {
    return createVnode(
      tagNameOrVnode.sel,
      tagNameOrVnode,
    );
  }

  const tagName = tagNameOrVnode;
  const { props } = config;
  const {
    ctor,
  } = config;
  const {
    children = emptyArr,
    $$refId,
    text,
  } = props;
  const childArray = !isArray(children) ? [children] : children;
  const hasNestedCollections = childArray.find(isArray);
  const flattenedChildren = hasNestedCollections
    ? childArray.flat(Infinity)
    : childArray;
  const isComment = tagName === '!';

  const vnode = {
    sel: tagName,
    props,
    customHooks: consumeHooksQueue(),
    /**
     * @important
     * The refId is generated by concatenating the
     * node path and the `key` prop. Therefore, the
     * `key` prop is used as a developer-friendly way
     * of describing a unique identifier for a given
     * vnode relative to its siblings.
     *
     * For example, the key 'foobar' can be used amongst
     * two different vnodes as long as they exist in
     * two different fragments:
     *
     * ```js
     * const Fragment = () => ([
     *  [A.div, { key: 'foobar' } 'some text']
     * ])
     * const View = () => ([
     *  // the key for each div is scoped to the fragment
     *  [Fragment],
     *  [Fragment],
     * ])
     * ```
     */
    key: $$refId,
    refId: $$refId,
    data: {
      hook: builtinHooks,
      handleProp,
    },
    text: isComment
      ? text
      : undefined,
    children: isComment
      ? emptyArr
      : flattenedChildren,
    type: valueTypes.vnode,
    ctor,
  };

  return vnode;
};

export {
  createVnode,
  createTextVnode,
  ignoredValues,
  primitiveTypes,

  getDomNode,
  validateVnodeValue,

  enqueueHook,

  getTreeValue,
  hasTreeValue,
  setTreeValue,
};
