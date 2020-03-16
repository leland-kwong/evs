export const isDef = (v) =>
  v !== undefined;

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

export const withDefault = (value, fallback) =>
  (isDef(value)
    ? value : fallback);

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

export const exec = (fn, arg) =>
  fn(arg);

export const alwaysTrue = () =>
  true;
