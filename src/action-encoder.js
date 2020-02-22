import * as htmlEscaper from 'html-escaper';
import {
  nsDelim,
  expressionDelims,
  isBrowser,
} from './constants';

const identity = (v) =>
  v;

function validateAction(encodedAction) {
  const maxLength = 1000;
  if (encodedAction.length > maxLength) {
    console.warn([
      '[warning] encoded action length should not',
      `exceed ${maxLength} characters. To send larger`,
      'actions you should use the `dataSource` option.',
      `Received:\n\n${encodedAction.slice(0, 100)}...`,
    ].join(' '));
  }

  return encodedAction;
}

/**
 * Generates namespaced html data to be used
 * as a DOM attribute value.
 */
export function encodeAction(
  namespace,
  action,
  context = null,
  encoder = isBrowser
    ? htmlEscaper.escape
    : identity,
) {
  // encoded to make it html attribute friendly
  const data = validateAction(
    encoder(
      JSON.stringify([
        context,
        action,
      ], null, 2),
    ),
  );

  return `${namespace}${nsDelim}${data}`;
}

/*
 * TODO:
 * We might be able to memoize this function since multiple
 * subscriptions will trigger this. We want to
 * minimize the cost since it involves a bunch
 * of string decoding and parsing.
 */
export function decodeAction(
  rawData,
  decoder = identity,
  dataSource,
  event,
) {
  let contextParsed = false;
  let context;

  function reviver(key, value) {
    const isContextValue = !contextParsed
      && key === '0';
    if (isContextValue) {
      contextParsed = true;
      context = value;
      return value;
    }

    const [l, r] = expressionDelims;
    const isExpression = typeof value === 'string'
      && value[0] === l
      && value.slice(-1) === r;

    if (isExpression) {
      const expression = value
        .slice(l.length, -r.length);
      return dataSource(expression, context, event);
    }

    return value;
  }

  const encodedAction = rawData.slice(
    rawData.indexOf(nsDelim) + nsDelim.length,
  );
  const decodedAction = decoder(encodedAction);

  const [, action] = JSON.parse(
    decodedAction,
    reviver,
  );
  return action;
}
