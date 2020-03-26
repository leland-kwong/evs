/**
 * TODO
 * Add dispatcher module that dispatches actions from child up to the parent
 * by travelling up the node path. At each depth of the path we will look for
 * an effect handler that matches that position and then trigger it.
 */

import { addWatch, removeWatch, atom } from 'atomic-state';
import createDebug from 'debug';
import {
  pathSeparator,
} from '../constants';
import {
  isFunc,
  withDefault,
  select,
} from '../utils';
import {
  renderWith,
  enqueueHook,
} from './element';
import {
  setShouldUpdate,
  resetShouldUpdate,
} from './render-context';
import { getVtree } from './vtree-cache';
import { inspectFn } from '../inspection/inspect-fn';

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
    if (!model) {
      console.error('[could not find model to cleanup]', { refId, key });
      return;
    }
    const { watchersList } = model;
    const w = watchersList.get(refId);
    const isWatcherReplaced = w !== watcherFn;

    if (isWatcherReplaced) {
      return;
    }

    removeWatch(model, refId);

    if (shouldCleanup()
      && watchersList.size === 0
    ) {
      scopedModels.delete(key);
    }

    break;
  }
  default:
    break;
  }
};

const forceUpdate = inspectFn((componentRefId) => {
  const { element, vtree, rootPath } = getVtree(componentRefId);
  let foundCurrentRef = false;
  const predicate = (oldProps, newProps, newConfig) => {
    const { $$refId } = newProps;
    const isDescendant = foundCurrentRef
      && $$refId.indexOf(componentRefId) === 0;

    if (isDescendant) {
      const {
        originalShouldUpdate: comparator,
      } = newConfig;
      return comparator(oldProps, newProps);
    }

    const isCurrentRef = componentRefId === $$refId;
    if (isCurrentRef) {
      foundCurrentRef = true;
    }

    const isWithinPath = componentRefId
      .indexOf($$refId) === 0;

    return isWithinPath;
  };

  setShouldUpdate(predicate);
  renderWith(vtree, element, rootPath);
  resetShouldUpdate();
},
select(
  createDebug('forceUpdate [perf]'),
  ({ executionTimeMs }) =>
    executionTimeMs,
));

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
};
