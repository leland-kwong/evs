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

const registeredScopes = new Map();

export function getScope(namespace) {
  return registeredScopes.get(namespace);
}

export function getDataSource(namespace) {
  return getScope(namespace)
    .options
    .dataSource();
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

function notifySubscribers(scope, action) {
  scope.$subscriptions
    .forEach((fn) =>
      fn(action));
}

let pooledSyntheticEvent = null;

function dispatchDomEvent(domEvent, scope) {
  const { path } = domEvent;
  const {
    namespace: initiatorNamespace,
  } = scope;
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
      scope.options.eventAttributePrefix,
      initiatorNamespace,
    );
    const hasResponse = !equal(response, null);

    if (hasResponse) {
      const [
        actionFn,
        context,
        actionOpts,
      ] = response;
      const actionResponse = actionFn(
        context,
        initiatorNamespace,
      );

      notifySubscribers(
        scope,
        actionResponse,
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
  dataSource() {
    return 'no data source specified';
  },
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
  const scopeInfo = {
    namespace: uniqueNs,
    options: optionsWithDefaults,
    $subscriptions: subscriptions,
  };

  const scopeRef = {
    ...scopeInfo,
    call: (actionFn, arg, opts) =>
      encodeAction(scopeRef, actionFn, arg, opts),
    subscribe: (onEvent) => {
      subscriptions.push(onEvent);

      return function unsubscribe() {
        const index = subscriptions
          .findIndex(findThis, onEvent);
        subscriptions.splice(index, 1);
      };
    },
    destroy: () => {
      registeredScopes.delete(uniqueNs);
      setupGlobalListeners(
        dispatchDomEvent,
        domEventTypes,
        'removeEventListener',
      );
    },
  };
  registeredScopes.set(uniqueNs, scopeRef);
  setupGlobalListeners((domEvent) => {
    dispatchDomEvent(domEvent, scopeRef);
  }, domEventTypes);
  validateNamespace(namespace);

  return scopeRef;
}

function info() {
  return {
    registeredFns,
    registeredScopes,
  };
}

export {
  createScope,
  notifySubscribers,
  info,
};

export * from './internal/event-helpers';
