/* global document */
import { getSupportedEventTypes } from './get-event-types';
import { nsDelim } from './constants';
import { uid } from './internal/uid';
import { encodeAction, decodeAction } from './action-encoder';

const IS_DEV = process
  && process.env
  && process.env.NODE_ENV === 'development';

const mapEventType = {
  focusin: 'focus',
  focusout: 'blur',
};

const nodeTypes = {
  document: 9,
  element: 1,
};

const subscriptions = new Map();

function dispose(ref) {
  subscriptions.delete(ref);
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

function handleDispatch(ref, refId) {
  const { options, onEvent } = ref;
  const {
    eventAttributePrefix,
  } = options;
  const { type, target } = this;
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
    this,
  );

  onEvent(parsed, this);
}

/* dispatches the dom event to subscribers */
function dispatch(ev) {
  subscriptions.forEach(handleDispatch, ev);
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

  if (IS_DEV && !eventsToIgnore.length) {
    return true;
  }

  const filterRe = new RegExp(eventsToIgnore.join('|'));
  return !filterRe.test(type);
}

function setupGlobalListeners() {
  const eventTypes = [
    ...getSupportedEventTypes(),
    'focusin',
    'focusout',
  ].filter(ignoreBuggyEvents);

  // remove any previously applied global listeners
  eventTypes.forEach((eventName) => {
    document.removeEventListener(
      eventName, dispatch,
    );
  });

  eventTypes.forEach((eventName) => {
    document.addEventListener(
      eventName, dispatch,
    );
  });
}

function validateNamespace(namespace) {
  if (namespace.includes(nsDelim)) {
    throw new Error([
      `[invalid namespace] cannot have \`${nsDelim}\`.`,
      `Received \`${namespace}\`.`,
    ].join(' '));
  }
}

function subscribe(scope, onEvent) {
  const { options, namespace } = scope;
  const ref = { onEvent, options };

  subscriptions.set(namespace, ref);
  return `${namespace}-subscription`;
}

/*
 * TODO:
 * Need a way to also handle scoped document,
 * html, and body element events. The reason this
 * is tricky is these elements are globally shared.
 * One way is to provide a custom callback options
 * such as `onDocumentEvent` and `onBodyEvent`.
 *
 * TODO:
 * Add option for validating the encoded data. We
 * can set a meaningful default that limits the
 * encoded size to X characters so that the
 * decoding and parsing can remain snappy.
 *
 * TODO:
 * Consider an option for a custom data decoder.
 */

const defaults = {
  eventAttributePrefix: 'evs.',
};

/** creates a unique namespace with a unique id appended */
function createScope(namespace = 'ns', options) {
  validateNamespace(namespace);

  const optionsWithDefaults = {
    ...defaults,
    ...options,
  };
  const uniqueNs = `${namespace}-${uid()}`;

  const scope = {
    namespace: uniqueNs,
    options: optionsWithDefaults,
  };

  return {
    scope,
    /*
     * TODO:
     * Expose a `useAction` and `subscribe` method that
     * has the scope automatically bound. This way we
     * don't have to do something like `evs.action(scope, MyAction, ...)`
     * and can just do `useAction(MyAction, ...)` which is
     * far more convenient
     */
    withAction: (actionFn, arg, opts) =>
      encodeAction(scope, actionFn, arg, opts),
    subscribe: (onEvent) => {
      const subscription = subscribe(scope, onEvent);

      return function unsubscribe() {
        dispose(subscription);
      };
    },
  };
}

setupGlobalListeners();

export {
  subscribe,
  encodeAction as action,
  dispose,
  dispatch,
  createScope,
};
