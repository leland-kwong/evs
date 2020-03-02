/* global */

import * as atomicState from 'atomic-state';
import { css } from 'emotion';
import * as evs from '../src';
import * as styles from './styles';
import { nativeElements as A,
  createElement,
  cloneElement,
  renderToDomNode,
  isElement } from '../src/internal/auto-dom';
import { ignoredValues } from '../src/internal/auto-dom/vnode';

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
  const { onUpdate,
          onDestroy } = smartComponentHooks;
  const rootConfig = {
    $hook: {
      init(ref) {
        console.log('[init]', ref);
        onUpdate(ref, renderConfig);
      },
    },
    onUpdate: [onUpdate, renderConfig],
    onDestroy: [onDestroy, renderConfig],
  };
  const renderValue = createElement(
    [render, renderConfig], $$refPath,
  );

  modelsByRefId.set(modelRefKey, modelRef);

  /*
     * TODO:
     * Since we're going to be using a hooks style
     * module system, we need to move this logic
     * over to the lisp processor. We also only need
     * to do this when hooks are being used because
     * there needs to be at least a comment/span node
     * for snabbdom to trigger it.
     */

  // null, false, true, undefined
  if (ignoredValues.has(renderValue)) {
    return [A.comment, rootConfig, $$refId];
  }

  // primitive values
  if (!isElement(renderValue)) {
    return [A.span, rootConfig, renderValue];
  }

  return cloneElement(
    renderValue, rootConfig,
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

  if (text.length > 15) {
    return null;
  }

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
