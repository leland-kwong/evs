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

const Recursive = ({ chars }) => {
  if (!chars.length) {
    return null;
  }

  const [, ...rest] = chars;
  return ([
    (chars.map((c) =>
      [A.div, c])),
    [Recursive, { chars: rest }],
  ]);
};

// console.log(
//   createElement([Fragment], '@fragment'),
// );

const Hello = ({ name, scope }) =>
  ([A.div,
    [A.hr, { style: { height: '1px',
                      margin: '1rem 0',
                      background: '#000' } }],
    [Greeting, { name, scope }],
    [Recursive, { chars: ['a', 'b', 'c'] }],
  ]);

export {
  Hello,
};

export * from '../src/internal/auto-dom';
