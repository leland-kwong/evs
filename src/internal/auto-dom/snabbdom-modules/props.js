/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
Object.defineProperty(exports, '__esModule', { value: true });

/**
 * We can automatically do setAttribute if the
 * property name to set does not exist on the dom node.
 */

const { domNodeTypes } = require('../../../constants');
const hookType = require('./hook-type');
const { emptyObj } = require('../../../constants');

const hasOwn = Object.prototype.hasOwnProperty;

function updateProps(hook, oldVnode, vnode) {
  const { elm } = vnode;
  const {
    props: oldProps = emptyObj,
  } = oldVnode;
  const { props = emptyObj } = vnode;
  const { handleProp } = vnode.data;

  if (domNodeTypes.comment === elm.nodeType) {
    return;
  }

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

  const { $$refId: id1 } = oldVnode;
  const { $$refId: id2 } = vnode;
  const isNewReference = id1 !== id2;

  /** TODO: naive implementation, needs testing */
  // cleanup old props
  if (isNewReference) {
    for (const key in oldProps) {
      if (!hasOwn(props[key])) {
        delete elm[key];
      }
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
  // init: (oldVnode, vnode) => {
  //   updateProps('onInit', oldVnode, vnode);
  // },
  create: (oldVnode, vnode) => {
    updateProps(hookType.create, oldVnode, vnode);
  },
  update: (oldVnode, vnode) => {
    updateProps(hookType.update, oldVnode, vnode);
  },
};

exports.default = exports.propsModule;
