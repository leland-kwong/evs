import { css } from 'emotion';
import * as atomicState from 'atomic-state';
import createDebug from 'debug';
import { nativeElements as A } from '../src/internal/auto-dom/element';
import {
  useModel,
  hasModel,
  shallowCompare,
} from '../src/internal/auto-dom';

const mainDebug = createDebug('TodoApp');
const { swap, read } = atomicState;
const cl = {
  list: css`
    margin: 0;
    padding: 0;
    list-style: none;`,
  itemStyle: (completed) =>
    css`
    ${cl.list}

    input {
      text-decoration: ${completed ? 'line-through' : null};
    }
    `,
  sortBtn: (selected) =>
    css`
      background: ${selected ? '#3a88fd' : 'none'};
      color: ${selected ? 'white' : 'none'};
    `,
};

const uid = () =>
  Math.random().toString(36).slice(2);

const inputValue = (e) =>
  e.target.value;

const initialItemCount = 50;

const initialModel = ({
  newTodo: {
    text: '',
    completed: false,
  },
  items: Array(initialItemCount).fill(0)
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
});

const todosModel = () =>
  initialModel;

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


const Title = (
  [A.h2, 'Todo App']);

const TodoItem = ({ id: key, value, model }) => {
  const onTodoChange = (payload) =>
    swap(model, updateTodo, payload);
  const { text, completed } = value;
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
    [A.li,
      { class: cl.itemStyle(completed) },
      completedField, ' ', textField]);
};

const rootPath = (refId) => {
  const rootFnName = 'TodoMain';
  const endIndex = refId.lastIndexOf(rootFnName)
    + rootFnName.length;

  return refId.slice(0, endIndex);
};

const useTodoModel = (refId) =>
  useModel(refId, rootPath(refId), todosModel);

const TodoList = ({ items = [], $$refId }) => {
  const rootModel = useTodoModel($$refId);

  return (
    [A.ul,
      { class: cl.list },
      items.map((props) =>
        ([TodoItem,
          { ...props,
            model: rootModel,
            shouldUpdate: shallowCompare }])),
    ]);
};

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
          class: cl.sortBtn(selected),
          onClick: () =>
            onSortChange({ direction }) },
        description]);
  };
  const btn = {
    sortAsc: [SortBtn, { direction: 'asc' }],
    sortDesc: [SortBtn, { direction: 'desc' }],
    sortToggle: (
      [SortBtn,
        { direction: sortBy === 'asc'
          ? 'desc' : 'asc' }]),
  };

  return (
    [A.div,
      btn.sortAsc,
      btn.sortDesc,
      btn.sortToggle]);
};


const FragmentNode = ({ children }) =>
  ([A.comment, { text: children }]);

const noAsyncData = 'noAsyncData';

const useAsync = (() => {
  const modelMeta = {
    shouldCleanup: () =>
      false,
  };

  return (refId, fetchData, fetchOptions) => {
    const { apiRoute = '' } = fetchOptions;
    const isNew = !hasModel(refId, apiRoute);
    const model = useModel(
      refId, apiRoute, noAsyncData, modelMeta,
    );
    const data = read(model);

    if (isNew) {
      console.log('[new fetch]', apiRoute);
      const asyncValue = fetchData(fetchOptions);
      asyncValue.then((v) => {
        swap(model, () =>
          v);
      });
    }

    return data;
  };
})();

const AsyncExample = ({ $$refId }) => {
  const asyncData = useAsync($$refId, () =>
    new Promise((resolve) => {
      setTimeout(resolve, 500, Math.random());
    }), {
    apiRoute: 'randomNum',
  });

  return ([
    [FragmentNode, 'async-fragment'],
    [A.div,
      'async data: ', [A.strong, asyncData]],
    [FragmentNode, '/async-fragment'],
  ]);
};

const TodoMain = ({ $$refId, name }) => {
  mainDebug('[Main render]', $$refId);

  const model = useTodoModel($$refId);
  const { items = {}, newTodo, sortBy } = read(model);

  const onNewTodoCreate = (payload) =>
    swap(model, addTodo, payload);
  const onNewTodoChange = (payload) =>
    swap(model, updateNewTodo, payload);
  const onSortChange = (payload) =>
    swap(model, changeSorting, payload);

  return ([
    [A.hr],
    [AsyncExample],
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
          ({ key, id: key, value })) }],
    [A.p, 'sibling: ', name],
  ]);
};

export { TodoMain as TodoApp };
