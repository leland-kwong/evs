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

const Greeting = (props) => {
  const { name, children } = props;
  // console.log(props);

  return (
    [A.h1, 'Hello ', name, children]
  );
};

const Hello = ({ name, scope }) =>
  [A.div, { class: 'Hello' },
    [NameInput, { name, scope }],
    [Greeting, { name },
      [BoldNumbers],
    ],
    [BoldNumbers],
  ];

export {
  Hello,
};

export * from '../src/internal/auto-dom';
