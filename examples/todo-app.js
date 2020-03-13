import { css } from 'emotion';
import * as atomicState from 'atomic-state';
import { nativeElements as A } from '../src/internal/auto-dom/element';
import { useModel, hasModel, getAllModels } from '../src/internal/auto-dom';

const { swap, read } = atomicState;
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


const FragmentNode = ({ children }) =>
  ([A.comment, { text: children }]);

const noAsyncData = 'noAsyncData';

const useAsync = (() => {
  const modelMeta = {
    shouldDestroy: () =>
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

const TodoMain = (props) => {
  const { $$refId } = props;
  const model = useModel(
    $$refId, `${$$refId}--todos`, todosModel,
  );
  const { items = {}, newTodo, sortBy } = read(model);
  const asyncData = useAsync($$refId, () =>
    new Promise((resolve) => {
      setTimeout(resolve, 1000, Math.random());
    }), {
    apiRoute: 'randomNum',
  });

  console.log(
    getAllModels($$refId),
  );

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
      'async data: ', [A.strong, asyncData]],
    [FragmentNode, 'fragment'],

    [A.div,
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
    [A.p, 'sibling: ', props.name],

    [FragmentNode, '/fragment'],
  ]);
};

export { TodoMain as TodoApp };
