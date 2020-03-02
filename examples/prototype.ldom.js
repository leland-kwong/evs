/* global */

import * as atomicState from 'atomic-state';
import { css } from 'emotion';
import * as evs from '../src';
import * as styles from './styles';
import { nativeElements as A,
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

const BoldNum = ({ num }) =>
  [A.strong, num];

const BoldNumbers = ({ numbers }) =>
  numbers.map((num) =>
    [BoldNum, { num }]);

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

const modelsByRefId = new Map();

const smartComponentHooks = {
  onUpdate: (renderVnode, config) => {
    const { key } = renderVnode;
    const { render, model, modelRefKey, props } = config;
    const renderComponent = () => {
      // console.log(renderVnode);
      renderToDomNode(
        renderVnode,
        [render, { props,
                   key,
                   model }],
      );
    };

    atomicState.addWatch(
      model, modelRefKey, renderComponent,
    );
  },

  onDestroy: (renderVnode, config) => {
    const { model, modelRefKey } = config;

    atomicState
      .removeWatch(model, renderVnode);
    modelsByRefId.delete(modelRefKey);
  },
};

const WithModel = (config) => {
  const { $$refPath, $$refId } = config;
  const modelRefKey = $$refId;
  const { render, props, model } = config;
  const modelRef = modelsByRefId.get(modelRefKey) || model();
  const renderConfig = {
    render, props, model: modelRef, modelRefKey,
  };
  const vnode = createElement([render, renderConfig], $$refPath);
  const { onUpdate,
          onDestroy } = smartComponentHooks;
  const rootConfig = {
    onCreate: [onUpdate, renderConfig],
    onUpdate: [onUpdate, renderConfig],
    onDestroy: [onDestroy, renderConfig],
  };

  modelsByRefId.set(modelRefKey, modelRef);

  return cloneElement(
    vnode, rootConfig,
  );
};

const SmartComponentRenderer = (innerProps) => {
  const { props, model } = innerProps;

  const increment = () => {
    atomicState.swap(model, ({ count }) =>
      ({ count: count + 1 }));
  };

  const { text = '', class: inStyle } = props;
  const { count } = atomicState.read(model);

  const Title = ({ children }) =>
    ([A.h3, { class: styles.capitalize },
      children]);

  const Section = ({ children, class: inClass }) =>
    ([A.div, { class: css(styles.Section, inClass) },
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

  const rootStyle = css`display: flex;`;

  return (
    [A.div, { class: css(inStyle, rootStyle) },
      textFromProps,
      counterFromModel,
    ]);
};

const initModel = () =>
  atomicState.atom({ count: 0 });

const SmartComponentExample = (props) =>
  ([WithModel,
    { props,
      model: initModel,
      render: SmartComponentRenderer }]);

const ConditionalComp = ({
  text = '',
  shouldShow = () =>
    true,
}) =>
  (shouldShow()
    ? [SmartComponentExample,
      { text }]
    : null);

const Hello = ({ name, scope }) =>
  ([A.div, { class: 'HelloRoot' },
    [ConditionalComp, {
      text: `Smart one: ${name}`,
      shouldShow: () =>
        name.length % 2 === 0,
      key: 'c-1',
    }],
    [ConditionalComp, {
      text: 'persist',
      key: 'c-2',
    }],
    [Greeting, { name, scope }],
    [A.div, [BoldNumbers, {
      numbers: Array(name.length).fill(0).map((_, i) =>
        i),
    }]],
  ]);

export {
  Hello,
};

export * from '../src/internal/auto-dom';
