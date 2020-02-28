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

  if (hookFn) {
    hookFn(vnode);
  }

  for (key in props) {
    const prev = oldProps[key];
    const cur = props[key];
    const customFn = handleProp[key];

    if (customFn) {
      customFn(prev, cur, vnode);
    } else {
      elm[key] = cur;
    }
  }
}

exports.propsModule = {
  create: (oldVnode, vnode) => {
    updateProps(hookType.create, oldVnode, vnode);
  },
  update: (oldVnode, vnode) => {
    updateProps(hookType.update, oldVnode, vnode);
  },
};
exports.default = exports.propsModule;
