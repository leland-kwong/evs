/* global document */
import { getSupportedEventTypes } from './get-event-types';
import { nsDelim, isBrowser } from './constants';
import { uid } from './internal/uid';
import {
  encodeAction,
  handleDispatch,
  registeredFns,
} from './action-encoder';
import { equal } from './internal/equal';
import { string } from './internal/string';
import { EvsSyntheticEvent } from './internal/synthetic-event';
import {
  watchComponentsAdded,
} from './internal/web-component';

if (isBrowser) {
  watchComponentsAdded(document.body);
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

export const customEvents = {
  render: '_render',
};

const domEventTypes = [
  ...getSupportedEventTypes(),
  'focusin',
  'focusout',
  ...Object.values(customEvents),
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

function notifySubscribers(action, event, subscriptions) {
  subscriptions
    .forEach((fn) =>
      fn(action, event));
}

let pooledSyntheticEvent = null;

function dispatch(domEvent, scope, subscriptions) {
  const { path } = domEvent;
  pooledSyntheticEvent = pooledSyntheticEvent
    || new EvsSyntheticEvent();
  pooledSyntheticEvent
    .setOriginalEvent(domEvent);

  /**
   * Simulate bubbling by walking up the
   * dom event path.
   */
  let i = 0;
  while (i < path.length) {
    const node = path[i];
    pooledSyntheticEvent
      .setCurrentTarget(node);

    const response = handleDispatch(
      pooledSyntheticEvent,
      scope.options,
      scope.namespace,
    );
    const hasResponse = !equal(response, null);

    if (hasResponse) {
      const [
        parsedAction,
        actionOpts,
      ] = response;

      notifySubscribers(
        parsedAction,
        pooledSyntheticEvent,
        subscriptions,
      );

      const {
        stopPropagation,
        preventDefault,
      } = actionOpts;

      if (preventDefault) {
        pooledSyntheticEvent.preventDefault();
      }

      // simulate event.stopPropagation()
      if (stopPropagation) {
        break;
      }
    }

    const noBubble = !pooledSyntheticEvent.bubbles
      || pooledSyntheticEvent.type === '_render';
    if (noBubble) {
      break;
    }

    // continue to next node up the path
    i += 1;
  }
  pooledSyntheticEvent.eventEnded();

  if (pooledSyntheticEvent.persisted) {
    pooledSyntheticEvent = null;
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
