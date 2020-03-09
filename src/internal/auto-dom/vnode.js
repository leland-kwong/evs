import { outdent } from 'outdent';
import { getSupportedEventTypes } from '../../get-event-types';
import { invalidComponentMsg } from './invalid-component-msg';
import { string } from '../string';
import { isArray, isFunc,
  setValue, stringifyValueForLogging, isDef } from '../utils';
import { emptyArr } from '../../constants';
import * as valueTypes from './value-types';

const hooksByRefId = new Map();

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
  init(vnode) {
    const { $$refId } = vnode.props;
    const customHooks = hooksByRefId.get($$refId) || emptyArr;
    customHooks.forEach(([fn]) =>
      fn('init', null, vnode));
    // hooksByRefId.delete($$refId);
  },
  update(oldVnode, vnode) {
    /**
     * This check helps differentiate if it was
     * a true update or that it was a component switch.
     */
    const isComponentSwitch = oldVnode.ctor !== vnode.ctor
      /**
       * snabbdom provides an empty vnode on the first
       * `patch` call. We know how the vnode was created
       * by checking the `type` property because it is
       * added by our own api.
       */
      && isType(oldVnode, valueTypes.vnode);
    if (isComponentSwitch) {
      /**
       * @TODO
       * This is where we should trigger a `destroy` hook for
       * the old vnode, and an `init` hook for the new vnode.
       */
      // console.log(
      //   '[update -> new_component]',
      //   '\n\n',
      //   oldVnode.ctor,
      //   '\n\n',
      //   vnode.ctor,
      // );

      // return;
    }

    const { $$refId } = vnode.props;
    const customHooks = hooksByRefId.get($$refId) || emptyArr;
    const updateType = isComponentSwitch
      ? '[update -> new_component]' : '[update]';
    customHooks.forEach(([fn]) =>
      fn(updateType, oldVnode, vnode));
    // hooksByRefId.delete($$refId);
  },
  destroy(vnode) {
    const { $$refId } = vnode.props;
    const customHooks = hooksByRefId.get($$refId)
      || emptyArr;
    customHooks.forEach(([fn]) =>
      fn('destroy', vnode));
    hooksByRefId.delete($$refId);
  },
};

const createVnode = (tagName, config, customHooks) => {
  const { props = {} } = config;
  const {
    ctor,
  } = config;
  const {
    children = emptyArr,
    $$refId,
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
    /**
     * @important
     * The refId is generated by concatenating the
     * node path and the `key` prop. This gives us
     * a more specific key that also enables keyed
     * fragment functionality.
     */
    key: $$refId,
    data: {
      customHooks,
      hook: builtinHooks,
      handleProp,
    },
    text: isComment
      ? flattenedChildren.join('')
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
  createVnode, createTextVnode,
  ignoredValues, primitiveTypes,
  getDomNode, validateVnodeValue,
  hooksByRefId,
};
