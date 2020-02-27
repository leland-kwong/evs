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
    [A.input, { value: name,
                onInput: scope.call(
                  SetName,
                  evs.InputValue,
                ) }]];

const BoldNum = ({ numbers }) =>
  numbers.map((num) =>
    [A.strong, num]);

const numbers = [3, 4, 5];

const BoldNumbers = () =>
  [BoldNum, { numbers }];

const Greeting = ({ name }) =>
  [A.h1, 'Hello ', name];

const Hello = ({ name, scope }) =>
  [A.div, { class: 'Hello' },
    [NameInput, { name, scope }],
    [Greeting, { name }],
    [BoldNumbers],
    [BoldNumbers],
  ];

export {
  Hello,
};

export * from '../src/internal/auto-dom';
