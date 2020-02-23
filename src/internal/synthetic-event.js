/* global window */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import { isBrowser } from '../constants';
import { string } from './string';
import { isFunc } from './is-func';

/**
 * NOTE:
 * This is not a full re-implementation of a dom event.
 * There are still properties such as `CAPTURING_PHASE`
 * that have not been implemented yet. The current feature
 * set is to handle the most common cases, in particular
 * simulated bubbling events.
 */
export class EvsSyntheticEvent {
  constructor(originalEvent) {
    this.originalEvent = originalEvent;
    this.currentTarget = originalEvent
      ? originalEvent.target
      : null;
    this.active = true;
    this.persisted = false;
  }

  setOriginalEvent(domEvent) {
    this.active = true;
    this.originalEvent = domEvent;
  }

  setCurrentTarget(domNode) {
    this.currentTarget = domNode;
  }

  eventEnded() {
    this.active = false;
    this.currentTarget = null;
  }

  persist() {
    this.persisted = true;
  }
}

function defineEventFn(key, proto) {
  Object.defineProperty(proto, key, {
    value() {
      this.originalEvent[key]();
    },
  });
}

function defineEventGetter(key, proto) {
  Object.defineProperty(proto, key, {
    get() {
      const noOnAsyncAccess = !this.persisted
        && !this.active;

      if (noOnAsyncAccess) {
        throw new Error(string([
          '[evs event error]',
          'For performance reasons',
          'synthetic events are pooled.',
          'You may only access event properties',
          'synchronously. Alternatively, you may',
          'call `event.persist()` to prevent pooling',
          'of the event.',
        ], ' '));
      }

      return this.originalEvent[key];
    },
  });
}

if (isBrowser) {
  const baseEvent = new window.MouseEvent('click');

  for (const key in baseEvent) {
    const propValue = baseEvent[key];
    if (isFunc(propValue)) {
      defineEventFn(key, EvsSyntheticEvent.prototype);
    } else if (!/currentTarget/.test(key)) {
      defineEventGetter(key, EvsSyntheticEvent.prototype);
    }
  }
} else {
  console.info(string([
    'synthetic dom events may only be setup',
    'in browser environments',
  ]));
}
