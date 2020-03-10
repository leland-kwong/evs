import { css } from 'emotion';
import * as atomicState from 'atomic-state';
import { nativeElements as A,
  useHook,
  renderWith,
  getCurrentProps,
  getCurrentDispatcher,
  createElement,
  valueTypes } from '../src/internal/auto-dom';
import {
  createVnode,
  getTreeValue,
  setTreeValue,
} from '../src/internal/auto-dom/vnode';
import { isArray } from '../src/internal/utils';

const { atom, addWatch, swap, read } = atomicState;
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
  items: Array(2).fill(0)
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
  const completedField = (
    [A.input, { type: 'checkbox',
                checked: completed,
                onChange: toggleCompleted }]);
  const textField = (
    [A.input, { value: text,
                onInput: changeText }]);

  return (
    [A.li, { class: itemStyle },
      completedField, ' ', textField]);
};

const TodoList = ({ items = [] }) =>
  ([A.ul,
    { class: cl.list,
      key: '@TodoList' },

    items.map((props) =>
    // doing it this way adds the key to the props
      [TodoItem, props])]);

const NewTodo = ({ onNewTodoCreate, onNewTodoChange, newTodo }) => {
  const newTodoField = (
    [A.input, { placeholder: 'what needs to be done?',
                value: newTodo.text,
                onInput: (e) => {
                  onNewTodoChange({ text: inputValue(e) });
                } }]);
  const submitTodo = (e) => {
    e.preventDefault();
    const key = uid();
    onNewTodoCreate({ key });
  };

  return (
    [A.form, { onSubmit: submitTodo },
      newTodoField]);
};

const SortOptions = ({ onSortChange, sortBy }) => {
  const SortBtn = ({ direction }) => {
    const description = direction;
    const selected = direction === sortBy;

    return (
      [A.button,
        { type: 'button',
          class: css`
            background: ${selected ? '#3a88fd' : 'none'};
            color: ${selected ? 'white' : 'none'};
          `,
          onClick: () =>
            onSortChange({ direction }) },
        description]);
  };

  return (
    [A.div,
      [SortBtn, { direction: 'asc' }],
      [SortBtn, { direction: 'desc' }]]);
};

const useModel = (refId) => {
  const currentProps = getCurrentProps();
  const dispatcher = getCurrentDispatcher();
  // console.log('[TodoMain | currentProps]', currentProps);
  const model = modelsByRefId.get(refId) || todosModel();
  const reRender = () => {
    const currentValue = getTreeValue(refId);
    const isFragment = isArray(currentValue);
    const nextRenderedValue = createElement(
      [dispatcher, currentProps],
      refId,
    );

    if (!isFragment) {
      setTreeValue(refId, nextRenderedValue);
      renderWith(currentValue, nextRenderedValue);
      return;
    }

    /**
     * Rerender the fragment by rerendering the
     * parent vnode and updating its children
     * using the new fragment.
     */
    const pathArray = refId.split('.');
    let i = pathArray.length;
    let parentVnode;
    // console.log('[patharray]', pathArray);

    while (!parentVnode && i > 0) {
      const path = pathArray.slice(0, i).join('.');
      const value = getTreeValue(path);
      if (valueTypes.isType(value, valueTypes.vnode)) {
        parentVnode = value;
        // console.log('[parent vnode]', path, value);
      }
      i -= 1;
    }

    const { children: oChildren } = parentVnode.props;
    /**
     * Update the old fragment with the new value
     */
    const newChildren = oChildren.map((ch) => {
      const isCurrentFragment = ch === currentValue;
      if (isCurrentFragment) {
        return nextRenderedValue;
      }
      return ch;
    });
    /**
     * Replace the old children with the new children
     */
    const nextParentVnode = createVnode(parentVnode.sel, {
      ...parentVnode,
      props: {
        ...parentVnode.props,
        children: newChildren,
      },
    });
    setTreeValue(parentVnode.props.$$refId, nextParentVnode);
    renderWith(parentVnode, nextParentVnode);
  };
  modelsByRefId.set(refId, model);
  addWatch(model, 'reRender', reRender);

  /**
   * @TODO
   * Add hook that removes watcher on destroy
   */
  useHook(refId, (type) => {
    console.log('[hook]', type);

    switch (type) {
    case 'destroy':
      modelsByRefId.delete(refId);
      atomicState.removeWatch(model, 'reRender');
      break;
    default:
      break;
    }
  });

  return model;
};

const TodoMain = (props) => {
  const { $$refId } = props;
  const model = useModel($$refId);
  const { items = {}, newTodo, sortBy } = read(model);

  const onTodoChange = (payload) =>
    swap(model, updateTodo, payload);
  const onNewTodoCreate = (payload) =>
    swap(model, addTodo, payload);
  const onNewTodoChange = (payload) =>
    swap(model, updateNewTodo, payload);
  const onSortChange = (payload) =>
    swap(model, changeSorting, payload);

  return ([
    // A.div,
    [A.div,
      Math.random(),
      Title,
      [NewTodo, {
        onNewTodoCreate,
        onNewTodoChange,
        newTodo,
      }],
      [SortOptions, { onSortChange, sortBy }],
      [TodoList,
        { items: transformItems(items, sortBy)
          .map(([key, value]) =>
            ({ key, value, onTodoChange })) }],
    ],
    [A.div, 'sibling: ', props.name],
  ]);
};

export { TodoMain as TodoApp };
