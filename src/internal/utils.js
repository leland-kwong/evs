export const noop = () => {};

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
) =>
  JSON.stringify(value, (key, v) => {
    if (isFunc(v)) {
      return v.toString();
    }
    return v;
  });
