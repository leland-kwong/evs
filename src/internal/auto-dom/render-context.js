import {
  noCurrentProps,
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
const getCurrentProps = (refId) =>
  (currentContext.has(refId)
    ? currentContext.get(refId)
    : noCurrentProps);

const setCurrentProps = (refId, value) => {
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

const setCurrentDispatcher = (refId, value) => {
  currentDispatcher.set(refId, value);
};

const clearRenderContext = (refId) => {
  currentContext.delete(refId);
  currentDispatcher.delete(refId);
};

export {
  getCurrentProps,
  setCurrentProps,
  getCurrentDispatcher,
  setCurrentDispatcher,
  clearRenderContext,
};
