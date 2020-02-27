/* global document, MutationObserver, CustomEvent, requestAnimationFrame */
import outdent from 'outdent';
import {
  domNodeTypes,
  isBrowser,
} from '../constants';
import { equal } from './equal';
import { forEach } from './for-each';
import { hasEvsEvent } from '../action-encoder';

/**
 * Web component lifecycle:
 *
 * 1. render (when added to dom)
 * 2. render (when `evs._render` attribute value changes)
 * 3. destroy (when removed from dom)
 */

let globalStylesInitialized = false;
const immutableFormInputInitialized = false;

const pInitialized = '@initialized';
const pRenderAttr = 'evs._render';
export const componentClassName = 'evs-component';

function isDomElement(node) {
  return node
    && equal(
      node.nodeType,
      domNodeTypes.element,
    );
}

export function isEvsComponent(node) {
  return isDomElement(node)
    && !equal(
      node.attributes[pRenderAttr],
      undefined,
    );
}

const renderEvent = isBrowser
  ? new CustomEvent('_render', {
    bubbles: true,
  })
  : '@nonBrowserCustomEvent';

function dispatchRenderEvent(domNode) {
  domNode.dispatchEvent(renderEvent);
}

const componentUpdateObserver = isBrowser
  ? new MutationObserver((mutations) => {
    forEach(mutations, ({ target }) => {
      dispatchRenderEvent(target);
    });
  })
  : null;

const updateObserverConfig = {
  attributes: true,
  attributeFilter: [pRenderAttr],
};

function initializeIfComponent(domNode) {
  if (!isEvsComponent(domNode)) return;

  const n = domNode;
  n[pInitialized] = true;
  componentUpdateObserver.observe(
    domNode, updateObserverConfig,
  );
  dispatchRenderEvent(domNode);
}

// walks children first
function walkDomElements(domNode, argsList) {
  const [callback, filter] = argsList;
  if (!filter(domNode)) return;

  forEach(
    domNode.children,
    walkDomElements,
    argsList,
  );
  callback(domNode);
}

function onlyElements(domNode) {
  return isDomElement(domNode)
    && !domNode[pInitialized];
}

function initializeGlobalStyles() {
  if (globalStylesInitialized) return;
  globalStylesInitialized = true;

  const style = document.createElement('style');

  style.innerHTML = /* css */`
    /* base evs styles */
    .${componentClassName} {
      display: block;
    }
  `;

  document.head.insertBefore(
    style,
    document.head.firstElementChild.nextSibling,
  );
}

export function watchComponentsAdded(domNode) {
  function processAddedNode(node) {
    walkDomElements(
      node,
      [initializeIfComponent, onlyElements],
    );
  }

  function processMutation(change) {
    const { addedNodes } = change;
    addedNodes.forEach(processAddedNode);
  }

  const onChange = (mutations) => {
    mutations.forEach(processMutation);
  };
  const observer = new MutationObserver(onChange);
  observer.observe(domNode, {
    childList: true,
    subtree: true,
  });
  initializeGlobalStyles();
}
