import { nativeElements as A } from '../src/internal/auto-dom/element';

const NameInput = ({ name, onNameChange }) =>
  [A.label,
    'Name: ',
    [A.input,
      { value: name,
        onInput: (event) => {
          onNameChange(event.target.value);
        } }]];

const Greeting = (props) => {
  const { name, children, onNameChange } = props;

  return (
    [
      [NameInput, { name, onNameChange }],
      [A.h1,
        'Hello ', name,
        children]]
  );
};

const numbers = Array(10).fill(0).map((_, i) =>
  i);

const Divider = (
  [A.hr, { style: { height: '1px',
                    margin: '1rem 0',
                    background: '#000' } }]
);

const Hello = ({ name, onNameChange }) =>
  ([A.div,
    Divider,
    [numbers.map((v) =>
      [A.span, v])],
    Divider,
    [Greeting, { name, onNameChange }],
  ]);

export {
  Hello,
};

export * from '../src/internal/auto-dom/element';
