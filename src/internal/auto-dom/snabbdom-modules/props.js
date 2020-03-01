/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
Object.defineProperty(exports, '__esModule', { value: true });

/**
 * We can automatically apply an attribute if the
 * property name to set does not exist on the dom node.
 */

const hookType = require('./hook-type');
const { call, isFunc } = require('../../utils');

const emptyObject = Object.freeze({});
const hasOwn = Object.prototype.hasOwnProperty;

const execHook = (vnode, hookConfig) => {
  if (isFunc(hookConfig)) {
    hookConfig(vnode);
    return;
  }

  const [hookFn, hookArg] = hookConfig || [];
  call([hookFn, vnode, hookArg]);
};

function updateProps(hook, oldVnode, vnode) {
  const { elm } = vnode;
  const {
    props: oldProps = emptyObject,
  } = oldVnode;
  const { props = emptyObject } = vnode;
  const { handleProp } = vnode.data;

  execHook(vnode, props[hook]);

  for (const key in props) {
    const prev = oldProps[key];
    const cur = props[key];
    const customFn = handleProp[key]
      /*
       * Mostly for event handlers. We can
       * safely assume that case sensitive prop
       * names don't matter. It wouldn't make sense
       * to have both an `onClick` and an `onclick`
       * handler at the same time.
       */
      || handleProp[key.toLowerCase()];

    if (customFn) {
      customFn(prev, cur, oldVnode, vnode);
    } else {
      elm[key] = cur;
    }
  }

  const cleanupOldProps = elm !== oldVnode.elm;
  if (cleanupOldProps) {
    for (const key in oldProps) {
      const shouldRemove = !hasOwn
        .call(props, key);

      if (shouldRemove) {
        delete elm[key];
      }
    }
  }
}

function onDestroy(hook, oldVnode) {
  const { props = {} } = oldVnode;

  execHook(oldVnode, props[hook]);
}

exports.propsModule = {
  /*
   * TODO:
   * When creating an form input dom node, we should
   * validate that it at least has a value/checked
   * property to make sure the state of the control
   * is always a representation of the the render.
   */
  create: (oldVnode, vnode) => {
    updateProps(hookType.create, oldVnode, vnode);
  },
  update: (oldVnode, vnode) => {
    updateProps(hookType.update, oldVnode, vnode);
  },
  destroy: (oldVnode, vnode) => {
    onDestroy(hookType.destroy, oldVnode, vnode);
  },
};

exports.default = exports.propsModule;
