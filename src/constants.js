export const nsDelim = '::';

// matches {mySelector}
export const expressionDelims = ['{', '}'];

export const isBrowser = typeof window !== 'undefined'
  && process.env.NODE_ENV !== 'test';
