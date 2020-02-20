/* global document */
import outdent from 'outdent';
import * as domEvent from '../src/index';

const { encodeData } = domEvent;

const makeUniqueElement = (id = 'some-id', tagType = 'div') => {
  const fromBefore = document.querySelector(id);

  if (fromBefore) {
    return fromBefore;
  }

  const elem = document.createElement(tagType);
  elem.setAttribute('id', id);
  return elem;
};

function setupDOM() {
  const $root = makeUniqueElement('app', 'div');
  document.body
    .appendChild($root);

  return { $root };
}

function init() {
  const { $root } = setupDOM();

  const ref = domEvent.subscribe((payload, ev) => {
    console.log(payload);
    if (!payload) {
      return;
    }

    if (payload.type === 'disposeEvent') {
      console.log('dispose');
      domEvent.dispose(ref);
    }

    if (payload.type === 'textInput') {
      console.log(ev.target.value, ev);
    }
  });

  const parentClickData = encodeData(ref, {
    type: 'parentClick',
  });

  const clickData = encodeData(ref, {
    type: 'buttonClick',
  });

  const disposeEventData = encodeData(ref, {
    type: 'disposeEvent',
  });

  $root.innerHTML = outdent/* html */`
    <style>
      html,
      body {
        min-height: 100vh;
      }
    </style>

    <div @click="${parentClickData}">
      <button @click="${clickData}">
        event test
      </button>
    </div>

    <button @click="${disposeEventData}">
      dispose
    </button>
    
    <input
      @input="${encodeData(ref, { type: 'textInput' })}"
      @focus="${encodeData(ref, { type: 'textFocus' })}"
      @blur="${encodeData(ref, { type: 'textBlur' })}"
      placeholder="type something"
    />
  `;
}

init();
