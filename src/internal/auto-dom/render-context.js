import {
  noCurrentConfig,
} from '../constants';

/**
 * A set of apis for introspection on the
 * render process.
 */

let shouldUpdate = null;
const currentContext = new Map();
const currentDispatcher = new Map();

const setShouldUpdate = (fn) => {
  shouldUpdate = fn;
};

const getShouldUpdate = () =>
  shouldUpdate;

const resetShouldUpdate = () => {
  shouldUpdate = null;
};


/**
 * @returns {Object} current active props context
 * that is being rendered with.
 */
const getCurrentConfig = (refId) =>
  currentContext.get(refId)
    || noCurrentConfig;

const setCurrentConfig = (refId, value) => {
  currentContext.set(refId, value);
};

const clearRenderContext = (refId) => {
  currentContext.delete(refId);
  currentDispatcher.delete(refId);
};

export {
  setShouldUpdate,
  getShouldUpdate,
  resetShouldUpdate,

  getCurrentConfig,
  setCurrentConfig,
  clearRenderContext,
};
