/* global */

import * as evs from '../src';
import { nativeElements as A } from '../src/internal/auto-dom/element';

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

const numbers = Array(10).fill(0).map((_, i) =>
  i);

const Hello = ({ name, scope }) =>
  ([A.div,
    [A.hr, { style: { height: '1px',
                      margin: '1rem 0',
                      background: '#000' } }],
    [numbers.map((v) =>
      [A.span, v])],
    [Greeting, { name, scope }],
  ]);

export {
  Hello,
};

export * from '../src/internal/auto-dom/element';
