/* global document, performance */
import outdent from 'outdent';
import morphdom from 'morphdom';
import * as evs from '../src/index';

const namespace = evs.createNamespace();
const noop = () => {};

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
    evs.action(subscription, {
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
  const setNewTodoText = evs.action(subscription, {
    type: 'SetNewTodoText',
    text: '{inputValue}',
  });

  const addTodo = evs.action(subscription, {
    type: 'AddTodo',
    todoData: state.newTodo,
  });

  const TodoItem = ([id, { text, done }]) => {
    const editText = evs.action(subscription, {
      type: 'EditTodo',
      changes: {
        text: '{inputValue}',
      },
      id,
    });

    const toggleDone = evs.action(subscription, {
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
          evs.change="${toggleDone}"
        />
        <input 
          data-foobar="'>'"
          value="${text}"
          evs.input="${editText}"
        />
      </li>
    `;
  };

  const RunActionPerf = evs.action(subscription, {
    type: 'RunActionPerf',
  }, {
    foo: 'bar',
  });

  const SetActionPerfCount = evs.action(subscription, {
    type: 'SetActionPerfCount',
    count: '{inputValue}',
  });

  const PerfUi = /* html */`
    <form evs.submit="${RunActionPerf}">
      <button 
        evs.click="${RunActionPerf}"
        type="button"
      >
        action perf
      </button>
      <input 
        evs.input="${SetActionPerfCount}"
        type="number"
        value="${state.actionPerf.count}"
      />
    </form>
  `;

  const NewTodoForm = /* html */`
    <form evs.submit="${addTodo}">      
      <input
        evs.input="${setNewTodoText}"
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
          margin: 0;
          min-height: 100vh;
        }
        
        .app {
          padding: 1em;
          font-family: sans-serif;
        }
      </style>

      <div class="app">
        <h1>EVS</h1>
        <h2>data-driven events for the web</h2>
        
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

const stateReducers = {
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

const sideEffects = {
  RunActionPerf(state) {
    const { actionPerf } = state;
    const results = actionCreationPerf(
      actionPerf.count,
      namespace,
    );
    console.log(results);
  },
};

function init() {
  const { $root } = setupDOM();

  let state = initialState;

  const update = (nextState) => {
    state = nextState;
    render($root, state, namespace);
  };

  evs.subscribe((action, ev) => {
    console.log(action.type);
    const { type } = action;
    const handler = stateReducers[type];

    if (ev.type === 'submit') {
      ev.preventDefault();
    }

    const effectFn = sideEffects[type] || noop;
    effectFn(state, action);

    if (!handler) {
      return;
    }

    update(handler(state, action));
  }, namespace, {
    dataSource(query, context, event) {
      return queries[query](state, context, event);
    },
  });

  update(state);
}

init();
