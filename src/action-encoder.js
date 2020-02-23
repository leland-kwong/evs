import * as htmlEscaper from 'html-escaper';
import {
  nsDelim,
  isBrowser,
} from './constants';
import { string } from './internal/string';

let encoderLengthWarned = false;
let domEventContext;

export const registeredFns = new Map();

const identity = (v) =>
  v;

const isFunc = (v) =>
  typeof v === 'function';

function evsError(stringsList) {
  return `[evs error]${string(stringsList)}`;
}

function checkDuplicateFn(fnId, fn) {
  const fromBefore = registeredFns.has(fnId)
    ? registeredFns.get(fnId)
    : null;
  const isDuplicate = fromBefore
    && fn !== fromBefore;

  if (isDuplicate) {
    throw new Error(evsError([
      '[Duplicate function name] Encountered two different',
      'functions with the same name. The functions are:\n',
      `${fromBefore}\n${fn}`,
    ], ' '));
  }
}

function registerFn(namespace, fn) {
  if (!isFunc(fn)) {
    const errorMessage = evsError([
      'Actions must be be named functions.',
      `Receieved: ${fn}`,
    ], ' ');
    throw new Error(errorMessage);
  }

  const fnName = fn.name;

  if (fnName.length === 0) {
    throw new Error(evsError([
      'Anonymous functions may not be used',
      'as actions',
    ]));
  }

  const fnId = `${fn.name}--${namespace}`;

  if (process.env.NODE_ENV === 'development') {
    checkDuplicateFn(
      fnId,
      fn,
    );
  }

  registeredFns.set(fnId, fn);
  return fnId;
}

function getRegisteredAction(fnIdOrInlineAction) {
  return registeredFns
    .get(fnIdOrInlineAction);
}

function validateAction(encodedAction, action) {
  if (process.env.NODE_ENV === 'development') {
    const maxLength = 2000;
    const isWarning = encodedAction.length > maxLength;
    if (isWarning && !encoderLengthWarned) {
      encoderLengthWarned = true;

      const receivedAction = JSON.stringify(action, null, 2)
        .slice(0, 100);

      console.warn([
        '[warning] for better performance you should',
        `keep the encoded action length below ${maxLength} characters.`,
        `Received action:\n\n${receivedAction}...`,
      ].join(' '));
    }
  }

  return encodedAction;
}

const actionSplitter = '__evs.action__';

function contextReplacer(key, value) {
  if (isFunc(value)) {
    return registerFn('evs.context', value);
  }

  return value;
}

/**
 * Generates namespaced html data to be used
 * as a DOM attribute value.
 */
export function encodeAction(
  scope,
  actionFn,
  context = null,
  encoder = isBrowser
    ? htmlEscaper.escape
    : identity,
  /*
   * TODO:
   * Add support for additional options such as:
   *
   * - preventDefault: boolean
   * - stopPropagation: boolean
   * - bubbles: boolean
   * - capture: boolean
   *
   * We can provide them like so:
   * ```js
   * const options = {
   *  preventDefault: true
   * }
   * evs.action(scope, Action, null, options)
   * ```
   * */
) {
  const {
    namespace,
  } = scope;
  // encoded to make it html attribute friendly
  const rawAction = registerFn(namespace, actionFn);
  const rawContext = JSON.stringify(
    context,
    contextReplacer,
    2,
  );
  const data = validateAction(
    encoder(
      string([
        rawAction,
        actionSplitter,
        rawContext,
      ]),
    ),
    rawAction,
  );

  return `${namespace}${nsDelim}${data}`;
}

function contextReviver(key, value) {
  const eventReducer = getRegisteredAction(value);

  if (eventReducer) {
    return eventReducer(domEventContext);
  }

  return value;
}

export function decodeAction(
  rawData,
  decoder = identity,
  event,
) {
  domEventContext = event;

  const encodedAction = rawData.slice(
    rawData.indexOf(nsDelim) + nsDelim.length,
  );
  const [
    rawAction, rawContext,
  ] = decoder(encodedAction)
    .split(actionSplitter);
  const context = JSON.parse(
    rawContext, contextReviver,
  );
  const actionFn = getRegisteredAction(rawAction);

  return actionFn(context, event);
}
