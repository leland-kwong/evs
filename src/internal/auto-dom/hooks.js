import { addWatch, removeWatch, atom } from 'atomic-state';
import {
  createVnode,
  getTreeValue,
  enqueueHook as useHook,
  getFullTree,
  setTreeValue,
} from './vnode';
import {
  pathSeparator,
} from '../constants';
import {
  isArray, identity, isFunc, withDefault,
} from '../utils';
import * as valueTypes from './value-types';
import {
  renderWith,
  createElement,
} from './element';
import {
  getCurrentProps,
  getCurrentDispatcher,
} from './render-context';

const getPathRoot = (path) => {
  const sepIndex = path.indexOf(pathSeparator);

  return sepIndex === -1
    ? path : path.slice(0, sepIndex);
};

const activeModels = new Map();

const getScopedModels = (path) =>
  activeModels.get(
    getPathRoot(path),
  );

const setupScopedModels = (path) =>
  activeModels.set(
    getPathRoot(path), new Map(),
  );

const findParentVnode = (currentPath) => {
  const pathArray = currentPath.split(pathSeparator);
  let pathIndex = pathArray.length;

  while (pathIndex > 0) {
    // walk up path tree until we find the nearest vnode
    const path = pathArray.slice(0, pathIndex)
      .join(pathSeparator);
    const value = getTreeValue(path);
    if (valueTypes.isType(
      value,
      valueTypes.vnode,
    )) {
      return value;
    }
    pathIndex -= 1;
  }

  return 'noParentVnodeFound';
};

const cleanupOnDestroy = (
  type,
  refId,
  { key, shouldDestroy, watcherFn },
) => {
  // console.log('[hook]', type, refId, key);
  const scopedModels = getScopedModels(refId);
  const model = scopedModels.get(key);

  switch (type) {
  case 'destroy': {
    const currentWatcher = model.watchersList
      .get(refId);
    const isWatcherReplaced = currentWatcher
      !== watcherFn;

    if (isWatcherReplaced) {
      return;
    }

    removeWatch(model, refId);
    if (shouldDestroy()) {
      scopedModels.delete(key);
    }
    break;
  }
  default:
    break;
  }
};

const forceUpdate = (
  refId, dispatcher, currentProps,
) => {
  const isRoot = refId.indexOf(pathSeparator) === -1;
  const currentValue = getTreeValue(refId);
  /**
   * We know its a fragment if the returned value
   * is a collection of vnodes
   */
  const isFragment = isArray(currentValue);

  if (!isFragment) {
    const onPathValue = isRoot ? setTreeValue : identity;
    const nextValue = renderWith(
      currentValue, [dispatcher, currentProps],
      refId, onPathValue,
    );
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
  const nextValue = createElement(
    [dispatcher, currentProps],
    refId,
  );
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

  const {
    $$refId: parentRefId,
  } = parentVnode.props;
  renderWith(
    parentVnode, nextParentVnode,
    parentRefId, identity,
  );
  Object.assign(parentVnode, nextParentVnode);
};

const useUpdate = (refId) => {
  const currentProps = getCurrentProps(refId);
  const dispatcher = getCurrentDispatcher(refId);

  return () => {
    forceUpdate(refId, dispatcher, currentProps);
  };
};

const initModel = (initialModel) =>
  atom(
    isFunc(initialModel)
      ? initialModel()
      : initialModel,
  );

const defaultMeta = {
  shouldDestroy: () =>
    true,
};

const useModel = (
  refId,
  key = refId,
  initialModel,
  meta = defaultMeta,
) => {
  const scopedModels = getScopedModels(refId);

  if (!scopedModels) {
    setupScopedModels(refId);
    return useModel(refId, key, initialModel, meta);
  }

  const model = scopedModels.get(key)
    || initModel(initialModel);
  const update = useUpdate(refId);
  const {
    shouldDestroy = defaultMeta.shouldDestroy,
  } = meta;

  scopedModels.set(key, model);
  addWatch(model, refId, update);
  useHook(refId, cleanupOnDestroy,
    { key, shouldDestroy, watcherFn: update });

  return model;
};

const emptyMap = new Map();

const hasModel = (refId, key) =>
  withDefault(
    getScopedModels(refId),
    emptyMap,
  ).has(key);

const getAllModels = (refId) =>
  getScopedModels(refId);

export {
  useModel,
  hasModel,
  getAllModels,
  useUpdate,
};
