/* global document, window */
import { getSupportedEventTypes } from './get-event-types';

const generateGlobalId = (() => {
  let id = 0;

  return function generateId(prefix) {
    id += 1;
    return `${prefix}${id}`;
  };
})();

const mapEventType = {
  focusin: 'focus',
  focusout: 'blur',
};

const nodeTypes = {
  document: 9,
  element: 1,
};

const nsDelim = '::';

const subscriptions = new Map();

function handleTrigger(cb) {
  cb(this);
}

function triggerListeners(ev) {
  subscriptions.forEach(handleTrigger, ev);
}

function dispose(ref) {
  subscriptions.delete(ref);
}

/**
 * Generates namespaced html data to be used
 * as a DOM attribute value.
 */
function encodeHtmlData(namespace, obj) {
  // encoded to make it html attribute friendly
  const data = window.btoa(JSON.stringify(obj));

  return `${namespace}${nsDelim}${data}`;
}

function decodeHtmlData(attrData) {
  return JSON.parse(window.atob(attrData));
}

function ignoreBuggyEvents(type) {
  const eventsToIgnore = [
    /**
     * FIXME:
     * Theres a bug with chrome inspector where
     * pointerrawupdate makes it impossible to
     * hover an element in the dom and inspect it.
     */
    'pointerrawupdate',
  ];

  if (!eventsToIgnore.length) {
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
      eventName, triggerListeners,
    );
  });

  eventTypes.forEach((eventName) => {
    document.addEventListener(
      eventName, triggerListeners,
    );
  });
}

/*
 * TODO:
 * We should memoize this function since multiple
 * subscriptions will trigger this. We want to
 * minimize the cost since it involves a bunch
 * of string decoding and parsing.
 */
function getEventData(ev, decodeData, eventAttributePrefix) {
  const { target, type } = ev;
  const normalizedType = mapEventType[type]
   || type;
  const isDOMElement = target
    ? target.nodeType === nodeTypes.element
    : false;
  const rawData = isDOMElement
    ? target.getAttribute(
      `${eventAttributePrefix}${normalizedType}`,
    )
    : null;

  if (rawData !== null) {
    return {
      namespace: rawData.slice(
        0, rawData.indexOf(nsDelim),
      ),
      data: decodeData(
        rawData.slice(
          rawData.indexOf(nsDelim) + nsDelim.length,
        ),
      ),
    };
  }

  return {
    namespace: '@no-namespace',
    data: null,
  };
}

function validateOptions(options) {
  const { namespacePrefix } = options;
  if (namespacePrefix.includes(nsDelim)) {
    throw new Error([
      `[invalid namespace] cannot have \`${nsDelim}\`.`,
      `Received \`${namespacePrefix}\`.`,
    ].join(' '));
  }
  return options;
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
  namespacePrefix: '@',
  eventAttributePrefix: '@',
};

/**
 * Only one subscriber is necessary per application.
 */
function subscribe(onEvent, options = {}) {
  const finalOptions = validateOptions(
    { ...defaults, ...options },
  );
  const {
    namespacePrefix,
    eventAttributePrefix,
  } = finalOptions;
  const id = generateGlobalId(namespacePrefix);

  function globalListener(ev) {
    const {
      namespace,
      data: parsed,
    } = getEventData(ev, decodeHtmlData, eventAttributePrefix);

    if (namespace !== id) {
      return;
    }

    onEvent(parsed, ev);
  }

  subscriptions.set(id, globalListener);
  return id;
}

setupGlobalListeners();

export {
  subscribe,
  encodeHtmlData as encodeData,
  dispose,
};
