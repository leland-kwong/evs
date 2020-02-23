import * as htmlEscaper from 'html-escaper';
import {
  nsDelim,
  isBrowser,
} from './constants';
import { string } from './internal/string';

let encoderLengthWarned = false;
let domEventContext;

export const registeredFns = new Map();

const mapEventType = {
  focusin: 'focus',
  focusout: 'blur',
};

const nodeTypes = {
  document: 9,
  element: 1,
};

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
  /*
   * TODO:
   * Add support for additional options:
   *
   * - bubbles: boolean
   * - capture: boolean
   * */
  eventOpts = {},
  encoder = isBrowser
    ? htmlEscaper.escape
    : identity,
) {
  const {
    namespace,
  } = scope;
  // encoded to make it html attribute friendly
  const rawAction = registerFn(namespace, actionFn);
  const rawContext = JSON.stringify(
    { context, eventOpts },
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

function triggerEventOptions(opts, event) {
  const {
    preventDefault, stopPropagation,
  } = opts;

  if (preventDefault) {
    event.preventDefault();
  }

  if (stopPropagation) {
    event.stopPropagation();
  }
}

export function decodeAction(
  rawData,
  event,
) {
  domEventContext = event;

  const encodedAction = rawData.slice(
    rawData.indexOf(nsDelim) + nsDelim.length,
  );
  const [
    rawAction,
    rawContext,
  ] = encodedAction.split(actionSplitter);
  const { context, eventOpts } = JSON.parse(
    rawContext, contextReviver,
  );
  const actionFn = getRegisteredAction(rawAction);

  triggerEventOptions(eventOpts, event);
  // TODO: simulate event bubbling by walking up the path

  return actionFn(context);
}

function parseActionNamespace(rawData) {
  return rawData
    ? rawData.slice(
      0, rawData.indexOf(nsDelim),
    )
    : '';
}

function getActionAttr(DOMTarget, attrName) {
  const isDOMElement = DOMTarget
    ? DOMTarget.nodeType === nodeTypes.element
    : false;

  if (!isDOMElement) {
    return null;
  }

  const { attributes } = DOMTarget;
  return attributes[attrName];
}

export function handleDispatch(
  event, onEvent, scopeOptions, refId,
) {
  const {
    eventAttributePrefix,
  } = scopeOptions;
  const { type, target } = event;
  const normalizedType = mapEventType[type]
   || type;
  const actionAttr = getActionAttr(
    target,
    `${eventAttributePrefix}${normalizedType}`,
  );

  if (!actionAttr) {
    return;
  }

  const domActionData = actionAttr
    // trim any extraneous white-space
    ? actionAttr.value.trim()
    : null;
  const namespace = parseActionNamespace(
    domActionData,
  );
  const isNamespaceMatch = namespace === refId;

  if (!isNamespaceMatch) {
    return;
  }

  const parsed = decodeAction(
    domActionData,
    event,
    scopeOptions,
    onEvent,
    refId,
  );

  onEvent(parsed, event);
}
