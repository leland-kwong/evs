export const pathSeparator = '.';

export const nsDelim = '::';

// matches {mySelector}
export const expressionDelims = ['{', '}'];

export const isBrowser = typeof window !== 'undefined'
  && process.env.NODE_ENV !== 'test'
  && process.env.NODE_ENV !== 'development';

export const domNodeTypes = {
  document: 9,
  comment: 8,
  element: 1,
};

export const nextPathKey = '_@';

export const emptyObj = Object.freeze({});

export const emptyArr = Object.freeze([]);

export const noCurrentProps = Symbol(
  '@noCurrentProps',
);

export const noCurrentDispatcher = Symbol(
  '@noCurrentDispatcher',
);
