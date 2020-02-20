/* global window */

function isEvent(prop) {
  return prop.indexOf('on') === 0;
}

function getSupportedEventTypes() {
  return Object.keys(window)
    .filter(isEvent)
    .map((prop) =>
      prop.slice(2));
}

export { getSupportedEventTypes };
