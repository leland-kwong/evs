import * as atomicState from 'atomic-state';
import * as evs from '../src';
import { nativeElements as A,
  getDomNode,
  renderToDomNode } from '../src/internal/auto-dom';

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

const WithModel = ({
  model,
  // mapData = (v) =>
  //   v,
  render,
  props,
}) => {
  const onUpdate = (ref) => {
    const renderComponent = () => {
      renderToDomNode(
        getDomNode(ref),
        [render,
          { props,
            model,
            render }],
      );
    };

    atomicState.addWatch(model, ref, renderComponent);
    renderComponent();
  };

  return (
    // TODO: add support for rendering a comment node to start with
    [A.div,
      { onCreate: onUpdate,
        onUpdate }]
  );
};

const SmartComponentRenderer = (innerProps) => {
  const { props, model } = innerProps;

  const increment = () => {
    atomicState.swap(model, ({ count }) =>
      ({ count: count + 1 }));
  };

  const { text } = props;
  const { count } = atomicState.read(model);

  const Title = ({ children }) =>
    [A.h3,
      { style: { textTransform: 'capitalize' } },
      children];

  const textFromProps = (
    [A.div,
      [Title, 'from props'],
      [A.strong, text]]);

  const counterFromModel = (
    [A.div,
      [Title, 'from model'],
      [A.div,
        'count: ', [A.strong, count]],
      [A.button,
        { onClick: increment },
        'increment']]);

  return (
    [A.div, innerProps,
      textFromProps,
      counterFromModel]);
};

const model = atomicState.atom({ count: 0 });

const SmartComponentExample = (props) =>
  ([WithModel,
    { props,
      model,
      render: SmartComponentRenderer }]);

const Hello = ({ name, scope }) =>
  [A.div,
    [SmartComponentExample,
      { text: `Smart one ${name}` }],
    [NameInput, { name, scope }],
    [Greeting, { name }],
    [BoldNumbers],
  ];

export {
  Hello,
};

export * from '../src/internal/auto-dom';
