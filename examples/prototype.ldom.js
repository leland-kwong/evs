import * as atomicState from 'atomic-state';
import * as evs from '../src';
import * as styles from './styles';
import { nativeElements as A,
  getDomNode,
  createElement,
  cloneElement,
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

  return (
    [A.h1,
      'Hello ', name,
      children]
  );
};

const smartComponentHooks = {
  onUpdate: (ref, { render, model, props }) => {
    // console.log('onCreate');
    const renderComponent = () => {
      // console.log(props);
      renderToDomNode(
        ref,
        [render,
          { props,
            model }],
      );
    };

    const watchKey = getDomNode(ref);
    atomicState.addWatch(
      model, watchKey, renderComponent,
    );
  },

  onDestroy: (ref, { model }) => {
    const watchKey = getDomNode(ref);
    atomicState
      .removeWatch(model, watchKey);
  },
};

const WithModel = (config) => {
  const { render, props, model } = config;
  const { onUpdate,
          onDestroy } = smartComponentHooks;
  const vnode = createElement([render, { props, model }]);
  const newProps = {
    onCreate: [onUpdate, config],
    onUpdate: [onUpdate, config],
    onDestroy: [onDestroy, config],
  };

  return cloneElement(
    vnode, newProps, vnode.children,
  );
};

const SmartComponentRenderer = (innerProps) => {
  const { props, model } = innerProps;

  const increment = () => {
    atomicState.swap(model, ({ count }) =>
      ({ count: count + 1 }));
  };

  const { text = '' } = props;
  const { count } = atomicState.read(model);

  const Title = ({ children }) =>
    ([A.h3, { class: styles.capitalize },
      children]);

  const Section = ({ children }) =>
    ([A.div, { class: styles.Section },
      children]);

  const textFromProps = (
    [Section,
      [Title, 'from props'],
      [A.strong, text]]);

  const counterFromModel = (
    [Section,
      [Title, 'from model'],
      [A.div,
        'count: ', [A.strong, count]],
      [A.button,
        { onClick: increment },
        'increment']]);

  return (
    [A.div,
      textFromProps,
      counterFromModel,
    ]);
};

const model = atomicState.atom({ count: 0 });

const SmartComponentExample = (props) =>
  ([WithModel,
    { props,
      model,
      render: SmartComponentRenderer }]);

const Hello = ({ name, scope }) =>
  ([A.div, { class: 'HelloRoot' },
    [SmartComponentExample,
      { text: `Smart one: ${name}` }],
    [NameInput, { name, scope }],
    [Greeting, { name },
      // [Greeting, { name: 'static name' }],
    ],
    // [BoldNumbers],
  ]);

export {
  Hello,
};

export * from '../src/internal/auto-dom';
