import * as htmlEscaper from 'html-escaper';
import {
  nsDelim,
  isBrowser,
  domNodeTypes as nodeTypes,
} from './constants';
import { equal } from './internal/equal';
import { string } from './internal/string';
import { isFunc } from './internal/is-func';

let encoderLengthWarned = false;
let domEventContext;

export const registeredFns = new Map();

const propHasEvsEvent = 'hasEvsEvent';

export function hasEvsEvent(domNode) {
  return domNode[propHasEvsEvent];
}

const mapEventType = {
  focusin: 'focus',
  focusout: 'blur',
};

const identity = (v) =>
  v;

function evsError(stringsList, sep) {
  return `[evs error]${string(stringsList, sep)}`;
}

function checkDuplicateFn(fnId, fn) {
  const fromBefore = registeredFns.has(fnId)
    ? registeredFns.get(fnId)
    : null;
  const isDuplicate = fromBefore
    && !equal(fn, fromBefore);

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

/*
 * TODO:
 * Add support for inline functions. This will
 * allow for developer convenience at the expense
 * of performance and less security.
 * /
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
   * - capture: boolean
   * */
  eventOpts = {},
  encoder = identity,
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

export function decodeAction(
  rawData,
  event,
) {
  domEventContext = event;

  const encodedAction = rawData.slice(
    rawData.indexOf(nsDelim) + nsDelim.length,
  );
  const rawAction = encodedAction.slice(
    0, encodedAction.indexOf(actionSplitter),
  );
  const rawContext = encodedAction.slice(
    encodedAction.indexOf(actionSplitter) + actionSplitter.length,
  );
  const { context, eventOpts } = JSON.parse(
    rawContext, contextReviver,
  );
  const actionFn = getRegisteredAction(rawAction);

  return [
    actionFn,
    context,
    eventOpts,
  ];
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
  syntheticEvent,
  eventAttributePrefix,
  initiatorNamespace,
) {
  const { type, currentTarget } = syntheticEvent;
  const normalizedType = mapEventType[type]
   || type;
  const actionAttr = getActionAttr(
    currentTarget,
    `${eventAttributePrefix}${normalizedType}`,
  );

  if (!actionAttr) {
    return null;
  }

  const t = syntheticEvent.currentTarget;
  t[propHasEvsEvent] = true;

  const domActionData = actionAttr
    // trim any extraneous white-space
    ? actionAttr.value.trim()
    : null;
  const currentNamespace = parseActionNamespace(
    domActionData,
  );
  const isNamespaceMatch = equal(
    currentNamespace, initiatorNamespace,
  );

  if (!isNamespaceMatch) {
    return null;
  }

  return decodeAction(
    domActionData,
    syntheticEvent,
    currentNamespace,
  );
}
