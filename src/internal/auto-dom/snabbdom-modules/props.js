/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
Object.defineProperty(exports, '__esModule', { value: true });

const hookType = require('./hook-type');

const emptyObject = Object.freeze({});

function updateProps(hook, oldVnode, vnode) {
  let key; const { elm } = vnode;
  const { props: oldProps = emptyObject } = oldVnode;
  const { props } = vnode;
  const { handleProp } = vnode.data;
  const hookFn = props[hook];

  // lifecycle hooks like onCreate, onUpdate, etc...
  if (hookFn) {
    hookFn(vnode);
  }

  for (key in props) {
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
      customFn(prev, cur, vnode);
    } else {
      elm[key] = cur;
    }
  }
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
};
exports.default = exports.propsModule;
