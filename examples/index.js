/* global document, performance */
import outdent from 'outdent';
import morphdom from 'morphdom';
import * as domEvent from '../src/index';

const makeUniqueElement = (id = 'some-id', tagType = 'div') => {
  const fromBefore = document.querySelector(id);

  if (fromBefore) {
    return fromBefore;
  }

  const elem = document.createElement(tagType);
  elem.setAttribute('id', id);
  return elem;
};

function setupDOM() {
  const $root = makeUniqueElement('app', 'div');
  document.body
    .appendChild($root);

  return { $root };
}

const queries = {
  inputValue(state, context, ev) {
    return ev.target.value;
  },
  inputChecked(state, context, ev) {
    return ev.target.checked;
  },
  newTodo(state) {
    return state.newTodo;
  },
};

function actionCreationPerf(
  numTests,
  subscription,
  runSoFar = 0,
  results = [],
) {
  const iterRange = new Array(500).fill(0);
  const bigString = new Array(10).fill(0).map(() =>
    Math.random().toString(16).slice(0, 6)).join('');
  // console.log(bigString.length);
  const ts = performance.now();
  iterRange.forEach(() => {
    domEvent.action(subscription, {
      type: 'setNewTodoText',
      text: '{inputValue}',
      listOfStrings: [bigString, bigString],
    });
  });
  results.push(performance.now() - ts);
  if (runSoFar < numTests) {
    return actionCreationPerf(
      numTests, subscription, runSoFar + 1, results,
    );
  }
  return results;
}

function render(rootNode, state, subscription) {
  const setNewTodoText = domEvent.action(subscription, {
    type: 'SetNewTodoText',
    text: '{inputValue}',
  });

  const addTodo = domEvent.action(subscription, {
    type: 'AddTodo',
    todoData: state.newTodo,
  });

  const TodoItem = ([id, { text, done }]) => {
    const editText = domEvent.action(subscription, {
      type: 'EditTodo',
      changes: {
        text: '{inputValue}',
      },
      id,
    });

    const toggleDone = domEvent.action(subscription, {
      type: 'EditTodo',
      changes: {
        done: '{inputChecked}',
      },
      id,
    });

    return /* html */`
      <li>
        <input
          type="checkbox"
          ${done ? 'checked' : ''}
          :change="${toggleDone}"
        />
        <input 
          data-foobar="'>'"
          value="${text}"
          :input="${editText}"
        />
      </li>
    `;
  };

  const RunActionPerf = domEvent.action(subscription, {
    type: 'RunActionPerf',
  });

  const SetActionPerfCount = domEvent.action(subscription, {
    type: 'SetActionPerfCount',
    count: '{inputValue}',
  });

  const PerfUi = /* html */`
    <form :submit="${RunActionPerf}">
      <button 
        type="button"
        :click="${RunActionPerf}"
      >
        action perf
      </button>
      <input 
        type="number"
        value="${state.actionPerf.count}"
        :input="${SetActionPerfCount}"
      />
    </form>
  `;

  const NewTodoForm = /* html */`
    <form :submit="${addTodo}">      
      <input
        :input="${setNewTodoText}"
        value="${state.newTodo.text}"
        placeholder="what needs to be done?"
      />
    </form>
  `;

  const TodosList = Object.entries(state.todos)
    .map(TodoItem)
    .join('');

  morphdom(rootNode, outdent/* html */`
    <div>
      <style>
        html,
        body {
          min-height: 100vh;
        }
      </style>

      <div class="app">
        ${PerfUi}        
        ${NewTodoForm}
        <ul>${TodosList}</ul>
      </div>
    </div>
  `);
}

const makeTodoId = () =>
  Math.random().toString(32).slice(2);

function setupNewTodo() {
  return {
    text: '',
    done: false,
    id: makeTodoId(),
  };
}

const initialState = {
  todos: {},
  newTodo: setupNewTodo(),
  actionPerf: {
    count: 5,
  },
};

const actionHandlers = {
  AddTodo(state, action) {
    const { todoData } = action;

    return {
      ...state,
      newTodo: setupNewTodo(),
      todos: {
        ...state.todos,
        [todoData.id]: todoData,
      },
    };
  },
  SetNewTodoText(state, action) {
    return {
      ...state,
      newTodo: {
        ...state.newTodo,
        text: action.text,
      },
    };
  },
  EditTodo(state, action) {
    const { id, changes } = action;
    const todo = state.todos[id];

    return {
      ...state,
      todos: {
        ...state.todos,
        [id]: { ...todo, ...changes },
      },
    };
  },
  SetActionPerfCount(state, action) {
    const { count } = action;

    return {
      ...state,
      actionPerf: {
        ...state.actionPerf,
        count,
      },
    };
  },
};

function init() {
  const { $root } = setupDOM();

  let state = initialState;

  const update = (nextState, subscription) => {
    state = nextState;
    render($root, state, subscription);
  };

  const ref = domEvent.subscribe((action, ev) => {
    const { type } = action;
    const handler = actionHandlers[type];

    if (ev.type === 'submit') {
      ev.preventDefault();
    }

    if (type === 'RunActionPerf') {
      const { actionPerf } = state;
      console.log(
        actionCreationPerf(
          actionPerf.count,
          ref,
        ),
      );
      return;
    }

    if (!handler) {
      return;
    }

    update(handler(state, action), ref);
  }, {
    dataSource(query, context, ev) {
      return queries[query](state, context, ev);
    },
  });

  update(state, ref);
}

init();
