/* global document */
import * as htmlEscaper from 'html-escaper';
import { getSupportedEventTypes } from './get-event-types';

const IS_DEV = process
  && process.env
  && process.env.NODE_ENV === 'development';

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

// matches {mySelector}
const expressionDelims = ['{', '}'];

const subscriptions = new Map();

function dispose(ref) {
  subscriptions.delete(ref);
}

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
function encodeAction(
  namespace,
  action,
  context = null,
  encoder = htmlEscaper.escape,
) {
  // encoded to make it html attribute friendly
  const data = validateAction(
    encoder(
      JSON.stringify({
        action,
        context,
      }),
    ),
  );

  return `${namespace}${nsDelim}${data}`;
}

function decodeAction(
  event,
  encodedAction,
  dataSource,
  decoder = (v) =>
    v,
) {
  const expressions = [];

  function reviver(key, value) {
    const [l, r] = expressionDelims;
    const isExpression = typeof value === 'string'
      && value[0] === l
      && value.slice(-1) === r;

    if (isExpression) {
      expressions.push({
        root: this,
        key,
        // expression without the delimiters
        expr: value.slice(l.length, -r.length),
      });
    }

    return value;
  }

  const decodedAction = decoder(encodedAction);
  const { action, context } = JSON.parse(
    decodedAction,
    reviver,
  );

  if (expressions.length) {
    const transformExpression = ({ root, key, expr }) => {
      const r = root;
      r[key] = dataSource(expr, context, event);
    };

    expressions.forEach(transformExpression);
  }

  return action;
}

/*
 * TODO:
 * We should memoize this function since multiple
 * subscriptions will trigger this. We want to
 * minimize the cost since it involves a bunch
 * of string decoding and parsing.
 */
function getEventData(
  ev,
  eventAttributePrefix,
  dataSource,
) {
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
      data: decodeAction(
        ev,
        rawData.slice(
          rawData.indexOf(nsDelim) + nsDelim.length,
        ),
        dataSource,
      ),
    };
  }

  return {
    namespace: '@no-namespace',
    data: null,
  };
}

function handleDispatch(ref, refId) {
  const { options, onEvent } = ref;
  const {
    eventAttributePrefix,
    dataSource,
  } = options;
  const {
    namespace,
    data: parsed,
  } = getEventData(this, eventAttributePrefix, dataSource);

  if (namespace !== refId) {
    return;
  }

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
  eventAttributePrefix: ':',
  dataSource: () =>
    '@noDataSource',
};

function subscribe(onEvent, options = {}) {
  const finalOptions = validateOptions(
    { ...defaults, ...options },
  );
  const {
    namespacePrefix,
  } = finalOptions;
  const id = generateGlobalId(namespacePrefix);
  const ref = { onEvent, options: finalOptions };

  subscriptions.set(id, ref);
  return id;
}

setupGlobalListeners();

export {
  subscribe,
  encodeAction as action,
  dispose,
  dispatch,
};
