/* global document */
import { getSupportedEventTypes } from './get-event-types';
import { nsDelim } from './constants';
import { uid } from './internal/uid';
import {
  encodeAction,
  decodeAction,
  registeredFns,
} from './action-encoder';
import { string } from './internal/string';

const mapEventType = {
  focusin: 'focus',
  focusout: 'blur',
};

const nodeTypes = {
  document: 9,
  element: 1,
};

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

function handleDispatch(event, onEvent, options, refId) {
  const {
    eventAttributePrefix,
  } = options;
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
    undefined,
    event,
  );

  onEvent(parsed, event);
}

function ignoreBuggyEvents(type) {
  const eventsToIgnore = [
    /**
     * NOTE:
     * Theres a bug with chrome inspector where
     * pointerrawupdate makes it impossible to
     * hover an element in the dom and inspect it.
     */
    'pointerrawupdate',
  ];

  if (process.env.NODE_ENV === 'development'
      && !eventsToIgnore.length) {
    return true;
  }

  const filterRe = new RegExp(eventsToIgnore.join('|'));
  return !filterRe.test(type);
}

function setupGlobalListeners(
  dispatch,
  eventTypes,
  method = 'addEventListener',
) {
  eventTypes.forEach((eventName) => {
    document[method](
      eventName, dispatch,
    );
  });
}

function validateNamespace(namespace) {
  if (namespace.length === 0) {
    throw new Error(string([
      '[invalid namespace] namespace must',
      'be at least 1 character',
    ], ' '));
  }

  if (namespace.includes(nsDelim)) {
    throw new Error(string([
      `[invalid namespace] cannot have \`${nsDelim}\`.`,
      `Received \`${namespace}\`.`,
    ], ' '));
  }
}

/*
 * TODO:
 * Need a way to also handle scoped document,
 * html, and body element events. The reason this
 * is tricky is these elements are globally shared.
 * One way is to provide a custom callback options
 * such as `onDocumentEvent` and `onBodyEvent`.
 */

const defaults = {
  eventAttributePrefix: 'evs.',
};

/** creates a namespace with a unique id appended */
function createScope(namespace, options) {
  const optionsWithDefaults = {
    ...defaults,
    ...options,
  };
  const uniqueNs = `${namespace}-${uid()}`;
  const subscriptions = [];
  const scope = {
    namespace: uniqueNs,
    options: optionsWithDefaults,
    _subscriptions: subscriptions,
  };
  const domEventTypes = [
    ...getSupportedEventTypes(),
    'focusin',
    'focusout',
  ].filter(ignoreBuggyEvents);

  function rootSubscriber(a, b) {
    subscriptions
      .forEach((fn) =>
        fn(a, b));
  }

  function dispatch(DOMEvent) {
    handleDispatch(
      DOMEvent,
      rootSubscriber,
      optionsWithDefaults,
      uniqueNs,
    );
  }

  setupGlobalListeners(dispatch, domEventTypes);
  validateNamespace(namespace);

  return {
    ...scope,
    call: (actionFn, arg, opts) =>
      encodeAction(scope, actionFn, arg, opts),
    subscribe: (onEvent) => {
      subscriptions.push(onEvent);

      return function unsubscribe() {
        const index = subscriptions
          .findIndex(onEvent);

        subscriptions.splice(index, 1);
      };
    },
    destroy: () => {
      setupGlobalListeners(
        dispatch,
        domEventTypes,
        'removeEventListener',
      );
    },
  };
}

function info() {
  return {
    registeredFns,
  };
}

export {
  createScope,
  info,
};

export * from './internal/event-helpers';
