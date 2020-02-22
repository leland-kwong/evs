import * as htmlEscaper from 'html-escaper';
import {
  nsDelim,
  isBrowser,
} from './constants';
import { string } from './internal/string';

let encoderLengthWarned = false;

const registeredActionFns = new Map();

const identity = (v) =>
  v;

function registerActionFn(namespace, fn) {
  if (typeof fn !== 'function') {
    const errorMessage = string([
      'Actions must be be named functions.',
      `Receieved: ${fn}`,
    ], ' ');
    throw new Error(errorMessage);
  }

  const fnName = fn.name;

  if (fnName.length === 0) {
    throw new Error(string([
      'Anonymous functions may not be used',
      'as actions',
    ]));
  }

  const fnId = `${fn.name}--${namespace}`;
  registeredActionFns.set(fnId, fn);
  return fnId;
}

function getRegisteredAction(fnIdOrInlineAction) {
  return registeredActionFns
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

const actionSplitter = '__::evs.action::__';

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
   *
   * TODO:
   * Add support for special context functions to
   * handle common things like event values, mouse
   * coordinates etc... The way it can work is any
   * function identifiers that are found in the context
   * are called with the current event.
   *
   * We can do this by doing something like:
   * ```js
   * function InputValue(ev) {
   *  return ev.target.value
   * }
   *
   * function Action(inputText) {
   *  return {
   *    type: 'Action',
   *    text: inputText
   *  }
   * }
   *
   * evs.action(scope, Action, InputValue)
   * ```
   * */
) {
  const {
    namespace,
  } = scope;
  // encoded to make it html attribute friendly
  const rawAction = registerActionFn(namespace, actionFn);
  const rawContext = JSON.stringify(context);
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

export function decodeAction(
  rawData,
  decoder = identity,
  event,
) {
  const encodedAction = rawData.slice(
    rawData.indexOf(nsDelim) + nsDelim.length,
  );
  const [
    rawAction, rawContext,
  ] = decoder(encodedAction)
    .split(actionSplitter);
  const context = JSON.parse(rawContext);
  const actionFn = getRegisteredAction(rawAction)
    // eslint-disable-next-line no-new-func
    || Function(rawAction)();
  return actionFn(context, event);
}
