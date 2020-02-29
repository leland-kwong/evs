export const noop = () => {};

export const identity = (v) =>
  v;

export const { isArray } = Array;

export const setValue = (obj, key, value) => {
  const o = obj;

  o[key] = value;
  return obj;
};

export const isFunc = (v) =>
  typeof v === 'function';

export const stringifyValueForLogging = (
  value,
) => {
  if (isFunc(value)) {
    return value.toString();
  }

  const isPlainObject = value
    && value.constructor === Object;

  if (!isPlainObject) {
    return value.toString();
  }

  return JSON.stringify(value, (key, v) => {
    if (isFunc(v)) {
      return v.toString();
    }

    return v;
  });
};

/**
 * executes a callable tuple where the
 * first argument is the function and
 * the rest are arguments
 */
export function call(tuple) {
  const [fn = noop, ...args] = tuple;
  return fn(...args);
}
