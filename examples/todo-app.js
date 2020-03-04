import * as atomicState from 'atomic-state';
import { nativeElements as A,
  createElement,
  cloneElement,
  renderToDomNode,
  valueTypes } from '../src/internal/auto-dom';
import { ignoredValues } from '../src/internal/auto-dom/vnode';

const { atom, swap, read } = atomicState;

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
  const { $$refId } = config;
  const modelRefKey = $$refId;
  const { render, props, model } = config;
  const modelRef = modelsByRefId.get(modelRefKey) || model();
  const renderConfig = {
    render, props, model: modelRef, modelRefKey,
  };
  const { onUpdate,
          onDestroy } = smartComponentHooks;
  const rootConfig = {
    hookInit: (vnode) =>
      onUpdate(vnode, renderConfig),
    hookUpdate: (vnode) =>
      onUpdate(vnode, renderConfig),
    hookDestroy: (vnode) =>
      onDestroy(vnode, renderConfig),
  };
  const renderValue = createElement(
    [render, renderConfig], $$refId,
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
  const isVnode = valueTypes
    .isType(renderValue, valueTypes.vnode);
  if (!isVnode) {
    return [A.span, rootConfig, renderValue];
  }

  return cloneElement(
    renderValue, rootConfig,
  );
};

const todosModel = () =>
  atom({
    items: Array(4).fill(0)
      .reduce((itemsByKey, _, key) => {
        const i = itemsByKey;

        i[`item-${key}`] = {
          text: `foo${key}`,
          completed: false,
        };

        return i;
      }, {}),
  });

const Title = (
  [A.h1, 'Todo App']);

const TodoList = ({ items = [] }) => {
  const root = A.ul;
  const itemList = items.map(({ key, value, onTodoChange }) => {
    const { text, completed } = value;
    const itemStyle = {
      textDecoration: completed ? 'line-through' : 'none',
    };
    const toggleCompleted = (e) => {
      const changes = { completed: e.target.checked };
      onTodoChange(
        { key, changes },
      );
    };
    const changeText = (e) => {
      const changes = { text: e.target.value };
      onTodoChange(
        { key, changes },
      );
    };

    return (
      [A.li, { key, style: itemStyle },
        '{- item/completed -}',
        [A.input, { type: 'checkbox',
                    checked: completed,
                    onChange: toggleCompleted }],
        ' ',
        '{- item/text -}',
        [A.input, { value: text,
                    onChange: changeText }]]);
  });

  return (
    [root,
      itemList]);
};

const updateTodo = (state, { key, changes }) => {
  const { items } = state;
  const curItem = items[key];

  return {
    ...state,
    items: {
      ...items,
      [key]: { ...curItem,
               ...changes },
    },
  };
};

const Main = ({ model }) => {
  const onTodoChange = (payload) =>
    swap(model, updateTodo, payload);

  const { items = {} } = read(model);

  console.log(items);

  const itemsArray = Object.entries(items)
    .map(([key, value]) =>
      ({ key, value, onTodoChange }));

  return (
    [A.div,
      [Title],
      [TodoList,
        { items: itemsArray }]]);
};

const TodoApp = () =>
  ([WithModel,
    { props: {},
      model: todosModel,
      render: Main }]);

export { TodoApp };
