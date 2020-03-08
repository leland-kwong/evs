/**
 * A set of apis for introspection on the
 * render process.
 */

let currentContext;
let currentDispatcher;

/**
 * @returns {Object} current active props context
 * that is being rendered with.
 */
const getCurrentProps = () =>
  currentContext;

const setCurrentProps = (value) => {
  currentContext = value;
};

/**
 * @returns {Function} current active component function
 * that is being rendered with.
 */
const getCurrentDispatcher = () =>
  currentDispatcher;

const setCurrentDispatcher = (value) => {
  currentDispatcher = value;
};

export {
  getCurrentProps,
  setCurrentProps,
  getCurrentDispatcher,
  setCurrentDispatcher,
};
