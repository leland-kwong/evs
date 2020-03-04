/* global */

import * as evs from '../src';
import { nativeElements as A, createElement } from '../src/internal/auto-dom';

function SetName(name) {
  return {
    type: 'SetName',
    name,
  };
}

const NameInput = ({ name, scope }) =>
  [A.label,
    'Name: ',
    [A.input,
      { value: name,
        onInput: (event) => {
          const newName = evs.InputValue(event);
          evs.notify(scope,
            SetName(newName));
        } }]];

const Greeting = (props) => {
  const { name, children, scope } = props;

  return (
    [
      [NameInput, { name, scope }],
      [A.h1,
        'Hello ', name,
        children]]
  );
};

const Fragment = () =>
  ([A.div,
    [A.div, 'a'],
    1,
    [A.div, 'b'],
  ]);

console.log(
  createElement([Fragment], '@fragment'),
);

const Hello = ({ name, scope }) =>
  ([A.div, { class: 'HelloRoot' },
    [A.hr, { style: { height: '1px',
                      margin: '1rem 0',
                      background: '#000' } }],
    [Greeting, { name, scope }],
  ]);

export {
  Hello,
};

export * from '../src/internal/auto-dom';
