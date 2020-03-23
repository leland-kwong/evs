import {
  noCurrentConfig,
  noCurrentDispatcher,
} from '../constants';

/**
 * A set of apis for introspection on the
 * render process.
 */

const currentContext = new Map();
const currentDispatcher = new Map();

/**
 * @returns {Object} current active props context
 * that is being rendered with.
 */
const getCurrentConfig = (refId) =>
  (currentContext.has(refId)
    ? currentContext.get(refId)
    : noCurrentConfig);

const setCurrentConfig = (refId, value) => {
  currentContext.set(refId, value);
};

/**
 * @returns {Function} current active component function
 * that is being rendered with.
 */
const getCurrentDispatcher = (refId) =>
  (currentDispatcher.has(refId)
    ? currentDispatcher.get(refId)
    : noCurrentDispatcher);

const dispatchErrorMsg = {
  noAnonymous: (fn) =>
    `
You may not use anonymous functions for components. Received:

${fn.toString()}
  `,
};

const setCurrentDispatcher = (refId, fn) => {
  if (process.env.NODE_ENV === 'development') {
    if (!fn.name) {
      throw new Error(
        dispatchErrorMsg.noAnonymous(fn),
      );
    }
  }

  currentDispatcher.set(refId, fn);
};

const clearRenderContext = (refId) => {
  currentContext.delete(refId);
  currentDispatcher.delete(refId);
};

export {
  getCurrentConfig,
  setCurrentConfig,
  getCurrentDispatcher,
  setCurrentDispatcher,
  clearRenderContext,
};
