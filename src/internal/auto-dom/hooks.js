import { addWatch, removeWatch, atom } from 'atomic-state';
import {
  enqueueHook,
} from './vnode';
import {
  pathSeparator,
} from '../constants';
import {
  isFunc,
  withDefault,
} from '../utils';
import {
  renderWith,
} from './element';
import {
  setShouldUpdate,
  resetShouldUpdate,
} from './render-context';
import { getVtree } from './vtree-cache';

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

const cleanupOnDestroy = (
  type,
  refId,
  { key, shouldCleanup, watcherFn },
) => {
  const scopedModels = getScopedModels(refId);
  const model = scopedModels.get(key);

  switch (type) {
  case 'destroy': {
    console.log('[cleanupOnDestroy]', refId);
    const currentWatcher = model.watchersList
      .get(refId);
    const isWatcherReplaced = currentWatcher
      !== watcherFn;

    if (isWatcherReplaced) {
      return;
    }

    removeWatch(model, refId);

    if (shouldCleanup()) {
      scopedModels.delete(key);
    }

    break;
  }
  default:
    break;
  }
};

/**
 * @important
 * Any vnode that gets updated must also update
 * the original source value, otherwise the rerender
 * of the root will not have latest changes.
 */
const forceUpdate = (componentRefId) => {
  const { element, vtree, rootPath } = getVtree(componentRefId);
  const refsUpdated = {};
  const predicate = (_, newProps) => {
    const { $$refId } = newProps;
    const shouldUpdate = componentRefId.indexOf($$refId) === 0;
    const isCurrentComponent = componentRefId === $$refId;

    if (shouldUpdate) {
      refsUpdated[$$refId] = (refsUpdated[$$refId] || 0) + 1;
    }

    // restore shouldUpdate to default behavior
    if (isCurrentComponent) {
      resetShouldUpdate();
    }

    return shouldUpdate;
  };

  setShouldUpdate(predicate);
  renderWith(vtree, element, rootPath);
};

const initModel = (initialModel) =>
  atom(
    isFunc(initialModel)
      ? initialModel()
      : initialModel,
  );

const defaultOptions = {
  shouldCleanup: () =>
    true,
};

const useModel = (
  refId,
  key = refId,
  initialModel,
  options = defaultOptions,
) => {
  console.log('[useModel]', refId, key);

  const im = initialModel;
  const scopedModels = getScopedModels(refId);

  if (!scopedModels) {
    setupScopedModels(refId);
    return useModel(refId, key, im, options);
  }

  const model = scopedModels.get(key)
    || initModel(im);
  const {
    shouldCleanup = defaultOptions.shouldCleanup,
  } = options;
  const update = () =>
    forceUpdate(refId);

  scopedModels.set(key, model);
  addWatch(model, refId, update);
  enqueueHook(refId, cleanupOnDestroy,
    { key, shouldCleanup, watcherFn: update });

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
  forceUpdate,
};
