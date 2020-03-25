/* global performance */

const noop = () => {};

export const inspectFn = (fn, onComplete = noop) => {
  if (process.env.NODE_ENV === 'development') {
    return (...args) => {
      const ts = performance.now();
      const result = fn(...args);
      const execTime = performance.now() - ts;
      onComplete({
        executionTimeMs: execTime,
        result,
      });
    };
  }

  return fn;
};
