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
