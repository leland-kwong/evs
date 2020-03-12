import { addWatch, removeWatch } from 'atomic-state';
import {
  createVnode,
  getTreeValue,
  enqueueHook as useHook,
} from './vnode';
import { isArray, identity } from '../utils';
import * as valueTypes from './value-types';
import { renderWith,
  createElement } from './element';

import {
  getCurrentProps,
  getCurrentDispatcher,
} from './render-context';

const modelsByRefId = new Map();

const findParentVnode = (currentPath) => {
  const pathArray = currentPath.split('.');
  let i = pathArray.length;

  while (i > 0) {
    const path = pathArray.slice(0, i).join('.');
    const value = getTreeValue(path);
    if (valueTypes.isType(value, valueTypes.vnode)) {
      return value;
    }
    i -= 1;
  }

  return 'noParentVnodeFound';
};

const cleanupOnDestroy = (type, refId) => {
  // console.log('[hook]', type);
  const model = modelsByRefId.get(refId);

  switch (type) {
  case 'destroy':
    modelsByRefId.delete(refId);
    removeWatch(model, 'reRender');
    break;
  default:
    break;
  }
};

const useModel = (refId, initModel) => {
  const currentProps = getCurrentProps();
  const dispatcher = getCurrentDispatcher();
  // console.log('[TodoMain | currentProps]', currentProps);
  const model = modelsByRefId.get(refId) || initModel();
  const reRender = () => {
    const currentValue = getTreeValue(refId);
    /**
     * We know its a fragment if the returned value
     * is a collection of vnodes
     */
    const isFragment = isArray(currentValue);
    const nextValue = createElement(
      [dispatcher, currentProps],
      refId,
    );

    if (!isFragment) {
      renderWith(currentValue, nextValue, refId, identity);
      /**
       * mutate original with tne new values since the
       * source vtree will need the updates when we do
       * a rerender of the full vtree.
       */
      Object.assign(currentValue, nextValue);
      return;
    }

    /**
     * Rerender the fragment by rerendering the
     * parent vnode and updating its children
     * using the new fragment.
     */
    const parentVnode = findParentVnode(refId);
    const { children: oChildren } = parentVnode.props;
    /**
     * Update the old fragment with the new value
     */
    const newChildren = oChildren.map((ch) => {
      const isCurrentFragment = isArray(ch)
        && ch[0].refId === currentValue[0].refId;

      if (isCurrentFragment) {
        return nextValue;
      }

      return ch;
    });
    /**
     * Create the new parent vnode by copying it and
     * updating the original children props with the
     * new children props.
     */
    const nextParentVnode = createVnode({
      ...parentVnode,
      props: {
        ...parentVnode.props,
        /**
         * @important
         * We must update the props in order to retain
         * a proper historical copy of changes. Otherwise,
         * if we modify the vnode's children directly, then
         * the next render will not be accessing the latest
         * children from the props. In other words, each
         * update should have a new vnode where the props
         * should be the representation of the change and
         * `createVnode` will generate a new vnode based
         * on the props.
         */
        children: newChildren,
      },
    });

    const { $$refId: parentRefId } = parentVnode.props;
    renderWith(parentVnode, nextParentVnode, parentRefId, identity);
    Object.assign(parentVnode, nextParentVnode);
  };

  modelsByRefId.set(refId, model);
  addWatch(model, 'reRender', reRender);
  useHook(refId, cleanupOnDestroy);

  return model;
};

export { useModel };
