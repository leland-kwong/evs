/* global */

import * as evs from '../src';
import { nativeElements as A } from '../src/internal/auto-dom';

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

const Lazy = ({ children }) =>
  children;

const PassThrough = (props) =>
  'pass through';

const LazyList = () =>
  [A.div, 1, 2, 3];

const Hello = ({ name, scope }) =>
  ([A.div, { class: 'HelloRoot' },
    [Lazy,
      [PassThrough,
        { cond: [
          [name.length > 4,
            LazyList],
        ] },
        [A.div, 1, 2, 3],
      ],
    ],
    [A.hr, { style: { height: '1px',
                      margin: '1rem 0',
                      background: '#000' } }],
    [Greeting, { name, scope }],
    [A.div,
      [Array(name.length)
        .fill(0)
        .map((_, i) =>
          i)]],
  ]);

export {
  Hello,
};

export * from '../src/internal/auto-dom';
