import { css } from 'emotion';
import * as atomicState from 'atomic-state';
import { nativeElements as A,
  createElement,
  cloneElement,
  renderToDomNode,
  valueTypes } from '../src/internal/auto-dom';
import { ignoredValues } from '../src/internal/auto-dom/vnode';

const { atom, swap, read } = atomicState;
const cl = {
  list: css`
    margin: 0;
    padding: 0;
    list-style: none;`,
};

const uid = () =>
  Math.random().toString(36).slice(2);

const inputValue = (e) =>
  e.target.value;

const initialModel = {
  newTodo: {
    text: '',
    completed: false,
  },
  items: Array(6).fill(0)
    .reduce((itemsByKey, _, index) => {
      const i = itemsByKey;
      const key = uid();

      i[key] = {
        text: `item - ${index}`,
        completed: false,
      };

      return i;
    }, {}),
  sortBy: 'asc',
};

const todosModel = () =>
  atom(initialModel);

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

const updateNewTodo = (state, { text }) => {
  const { newTodo } = state;

  return {
    ...state,
    newTodo: {
      ...newTodo,
      text,
    },
  };
};

const addTodo = (state, { key }) => {
  const { items, newTodo } = state;

  return {
    ...state,
    newTodo: initialModel.newTodo,
    items: {
      ...items,
      [key]: newTodo,
    },
  };
};

const changeSorting = (state, { direction = 'asc' }) =>
  ({
    ...state,
    sortBy: direction,
  });

const transformItems = (items, sortBy) =>
  Object.entries(items)
    .sort(([, valA], [, valB]) => {
      const { text: a } = valA;
      const { text: b } = valB;
      const direction = sortBy === 'asc'
        ? 1 : -1;

      if (a < b) {
        return -1 * direction;
      }

      if (a > b) {
        return 1 * direction;
      }

      return 0;
    });

const modelsByRefId = new Map();

const smartComponentHooks = {
  onUpdate: (initialVnode, config) => {
    const { key, props: { $$refId } } = initialVnode;
    const { render, model, modelRefKey, props } = config;
    const component = (
      [render, { props,
                 key,
                 model }]);
    let oldVnode = initialVnode;

    const renderComponent = () => {
      oldVnode = renderToDomNode(
        oldVnode,
        component,
        $$refId,
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

const Title = (
  [A.h1, 'Todo App']);

const TodoItem = ({ key, value, onTodoChange }) => {
  const { text, completed } = value;
  const itemStyle = css`
    ${cl.list}

    input {
      text-decoration: ${completed ? 'line-through' : null};
    }
  `;
  const toggleCompleted = (e) => {
    const changes = { completed: e.target.checked };
    onTodoChange(
      { key, changes },
    );
  };
  const changeText = (e) => {
    const changes = { text: inputValue(e) };
    onTodoChange(
      { key, changes },
    );
  };
  const itemCompleted = (
    [A.input, { type: 'checkbox',
                checked: completed,
                onChange: toggleCompleted }]);
  const itemText = (
    [A.input, { value: text,
                onInput: changeText }]);

  return (
    [A.li, { class: itemStyle },
      itemCompleted,
      ' ',
      itemText]);
};

const TodoList = ({ items = [] }) =>
  ([A.ul, { class: cl.list },
    items.map((props) =>
      // doing it this way adds the key to the props
      [TodoItem, props])]);

const NewTodo = ({ onNewTodoCreate, onNewTodoChange, newTodo }) => {
  const newTodoText = (
    [A.input, { placeholder: 'what needs to be done?',
                value: newTodo.text,
                onInput: (e) => {
                  onNewTodoChange({ text: inputValue(e) });
                } }]);

  return (
    [A.form,
      { onSubmit: (e) => {
        e.preventDefault();
        const key = uid();
        onNewTodoCreate({ key });
      } },
      newTodoText]);
};

const SortOptions = ({ onSortChange }) => {
  const SortBtn = ({ direction }) => {
    const description = direction;

    return (
      [A.button,
        { type: 'button',
          onClick: () =>
            onSortChange({ direction }) },
        description]);
  };

  return (
    [A.div,
      [SortBtn, { direction: 'asc' }],
      [SortBtn, { direction: 'desc' }]]);
};

const Main = ({ model }) => {
  const onTodoChange = (payload) =>
    swap(model, updateTodo, payload);
  const onNewTodoCreate = (payload) =>
    swap(model, addTodo, payload);
  const onNewTodoChange = (payload) =>
    swap(model, updateNewTodo, payload);
  const onSortChange = (payload) =>
    swap(model, changeSorting, payload);
  const { items = {}, newTodo, sortBy } = read(model);

  return (
    [A.div,
      [Title],
      [NewTodo, {
        onNewTodoCreate,
        onNewTodoChange,
        newTodo,
      }],
      [SortOptions, { onSortChange }],
      [TodoList,
        { items: transformItems(items, sortBy)
          .map(([key, value]) =>
            ({ key, value, onTodoChange })) }],
    ]);
};

const TodoApp = () =>
  ([WithModel,
    { props: {},
      model: todosModel,
      render: Main }]);

export { TodoApp };
