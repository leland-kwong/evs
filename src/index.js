/* global document */
import { getSupportedEventTypes } from './get-event-types';
import { nsDelim, isBrowser } from './constants';
import { uid } from './internal/uid';
import {
  encodeAction,
  handleDispatch,
  registeredFns,
} from './action-encoder';
import { string } from './internal/string';

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

const domEventTypes = [
  ...getSupportedEventTypes(),
  'focusin',
  'focusout',
].filter(ignoreBuggyEvents);

function setupGlobalListeners(
  onDomEvent,
  eventTypes,
  method = 'addEventListener',
) {
  /**
   * Server-side rendering has no dom events
   * so we should skip this and still enable
   * the html event scoping to still work.
   */
  if (!isBrowser) {
    return;
  }

  eventTypes.forEach((eventName) => {
    document[method](
      eventName, onDomEvent,
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

function findThis(v) {
  return this === v;
}

function rootSubscriber(action, event, subscriptions) {
  subscriptions
    .forEach((fn) =>
      fn(action, event));
}

function dispatch(domEvent, scope, subscriptions) {
  const { type: eventType } = domEvent;
  const syntheticEvent = {
    type: eventType,
  };
  const { path } = domEvent;

  /**
   * Simulate bubbling by walking up the
   * dom event path.
   */
  let i = 0;
  while (i < path.length) {
    const node = path[i];
    syntheticEvent.target = node;

    const response = handleDispatch(
      syntheticEvent,
      domEvent,
      scope.options,
      scope.namespace,
    );
    const hasResponse = response !== null;

    if (hasResponse) {
      const [
        parsedAction,
        actionOpts,
      ] = response;

      rootSubscriber(
        parsedAction,
        domEvent,
        subscriptions,
      );

      const {
        stopPropagation,
        preventDefault,
      } = actionOpts;

      if (preventDefault) {
        domEvent.preventDefault();
      }

      // simulate event.stopPropagation()
      if (stopPropagation) {
        return;
      }
    }
    // continue to next node up the path
    i += 1;
  }
}

const defaults = {
  eventAttributePrefix: 'evs.',
  /**
   * Useful for isomorphic rendering where
   * you'd want the same namespace on both
   * the server and client.
   */
  useAbsoluteNamespace: false,
};

function createScope(namespace, options) {
  const optionsWithDefaults = {
    ...defaults,
    ...options,
  };
  const {
    useAbsoluteNamespace,
  } = optionsWithDefaults;
  const uniqueNs = useAbsoluteNamespace
    ? namespace
    // prevent namespace collisions
    : `${namespace}-${uid()}`;
  const subscriptions = [];
  const scope = {
    namespace: uniqueNs,
    options: optionsWithDefaults,
    _subscriptions: subscriptions,
  };

  setupGlobalListeners((domEvent) => {
    dispatch(domEvent, scope, subscriptions);
  }, domEventTypes);
  validateNamespace(namespace);

  return {
    ...scope,
    call: (actionFn, arg, opts) =>
      encodeAction(scope, actionFn, arg, opts),
    subscribe: (onEvent) => {
      subscriptions.push(onEvent);

      return function unsubscribe() {
        const index = subscriptions
          .findIndex(findThis, onEvent);
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
