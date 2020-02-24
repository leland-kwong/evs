/* global MutationObserver, CustomEvent */
import {
  domNodeTypes,
  isBrowser,
} from '../constants';
import { forEach } from './for-each';

const pInitialized = '@initialized';
const pRenderAttr = 'evs._render';

function isDomElement(node) {
  return node
    && node.nodeType === domNodeTypes.element;
}

export function isEvsComponent(node) {
  return isDomElement(node)
    && node.attributes[pRenderAttr]
      !== undefined;
}

const renderEvent = isBrowser
  ? new CustomEvent('_render', {
    bubbles: true,
  })
  : '@nonBrowserCustomEvent';

function renderComponent(domNode) {
  domNode.dispatchEvent(renderEvent);
}

const componentUpdateObserver = isBrowser
  ? new MutationObserver((mutations) => {
    forEach(mutations, ({ target }) => {
      renderComponent(target);
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
  domNode.dispatchEvent(renderEvent);
  componentUpdateObserver.observe(
    domNode, updateObserverConfig,
  );
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

export function watchForNewDomComponents(domNode) {
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
    // console.log(mutations);
    mutations.forEach(processMutation);
  };
  const observer = new MutationObserver(onChange);
  observer.observe(domNode, {
    childList: true,
    subtree: true,
  });
}
