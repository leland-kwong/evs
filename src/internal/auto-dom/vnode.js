import { outdent } from 'outdent';
import createDebug from 'debug';
import { getSupportedEventTypes } from '../../get-event-types';
import { string } from '../string';
import { isArray, isFunc,
  setValue, stringifyValueForLogging, noop, exec } from '../utils';
import { emptyArr, specialProps } from '../constants';
import {
  clearRenderContext,
} from './render-context';
import * as valueTypes from './value-types';

const hookDebug = createDebug('vnode-hook');

let isRendering = false;
const treeValues = new Map();
const treePathsUsed = new Map();

const setIsRendering = (value) => {
  isRendering = value;
};

const getIsRendering = () =>
  isRendering;

const checkDuplicateTreePath = (
  refId, value, config,
) => {
  const inputs = { refId, value, config };

  if (treePathsUsed.has(refId)) {
    // eslint-disable-next-line no-console
    console.error(
      `duplicate refId \`${refId}\` used\n`,
      { old: treePathsUsed.get(refId),
        new: inputs },
    );
  }
  treePathsUsed.set(refId, inputs);
};

const getTreeValue = (refId) =>
  treeValues.get(refId);
const setTreeValue = (refId, value, config) => {
  if (process.env.NODE_ENV === 'development') {
    checkDuplicateTreePath(refId, value, config);
  }
  treeValues.set(refId, value);
};
const hasTreeValue = (refId) =>
  treeValues.has(refId);
const deleteTreeValue = (refId) => {
  treeValues.delete(refId);
};
const onVtreeCompleted = () => {
  console.log(treeValues);
  treePathsUsed.clear();
};

const cleanTreePosition = (refId) => {
  deleteTreeValue(refId);
  clearRenderContext(refId);
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

  key: noop,

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
  destroy: exec(
    (hookCallback) =>
      (vnode) => {
        hookDebug('[destroy]', vnode);
        const { customHooks } = vnode;

        customHooks.forEach(hookCallback);
        const { refId } = vnode;
        cleanTreePosition(refId);
      },
    ([refId, fn, arg]) => {
      fn('destroy', refId, arg);
      cleanTreePosition(refId);
    },
  ),
};

const nullVnode = null;

const normalizeChildren = (children) => {
  if (!isArray(children)) {
    return [children];
  }

  const hasNestedChildren = children.find(isArray);

  return hasNestedChildren
    ? children.flat(Infinity)
    : children;
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
    key,
  } = config;
  const {
    children = emptyArr,
    [specialProps.$$refId]: $$refId,
    text,
  } = props;
  const isComment = tagName === '!';
  const vnode = {
    sel: tagName,
    props,
    customHooks: [],
    key,
    refId: $$refId,
    data: {
      hook: builtinHooks,
      handleProp,
    },
    text: isComment
      ? text
      : undefined,
    children: normalizeChildren(children),
    type: valueTypes.vnode,
    ctor,
  };

  return vnode;
};

export {
  setIsRendering,
  getIsRendering,

  createVnode,
  createTextVnode,
  ignoredValues,
  primitiveTypes,
  nullVnode,

  getDomNode,
  validateVnodeValue,

  getTreeValue,
  hasTreeValue,
  setTreeValue,
  cleanTreePosition,
  onVtreeCompleted,
};
