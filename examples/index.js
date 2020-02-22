/* global document, performance */
import outdent from 'outdent';
import morphdom from 'morphdom';
import * as evs from '../src/index';

const evScope = evs.createScope('EvsTest');
const useAction = (actionFn, arg) =>
  evs.action(evScope, actionFn, arg);

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

function benchFn(
  fn, arg, numTests,
  runSoFar = 0, results = [],
) {
  if (runSoFar < numTests) {
    const ts = performance.now();
    fn(arg);
    results.push(performance.now() - ts);
    return benchFn(
      fn, arg, numTests,
      runSoFar + 1, results,
    );
  }
  return results;
}

const SetNewTodoText = (ctx, ev) =>
  ({
    type: 'SetNewTodoText',
    text: ev.target.value,
  });

const AddTodo = () =>
  ({
    type: 'AddTodo',
  });

const RunActionPerf = () =>
  ({
    type: 'RunActionPerf',
  });

const SetActionPerfCount = (ctx, ev) =>
  ({
    type: 'SetActionPerfCount',
    count: ev.target.value,
  });

const TodoSetText = (id, event) =>
  ({
    type: 'EditTodo',
    changes: {
      text: event.target.value,
    },
    id,
  });

const TodoSetDone = (id, event) =>
  ({
    type: 'EditTodo',
    changes: {
      done: event.target.checked,
    },
    id,
  });

function render(rootNode, state) {
  const TodoItem = ([id, { text, done }]) => {
    const editText = useAction(TodoSetText, id);
    const toggleDone = useAction(TodoSetDone, id);

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

  const PerfUi = /* html */`
    <form evs.submit="${useAction(RunActionPerf)}">
      <div>
        test count:
        <input 
          evs.input="${useAction(SetActionPerfCount)}"
          type="number"
          min="0"
          max="50"
          value="${state.actionPerf.count}"
        />
      </div>
      <button 
        evs.click="${useAction(RunActionPerf)}"
        type="button"
      >
        action perf
      </button>
    </form>
  `;

  const NewTodoForm = /* html */`
    <form evs.submit="${useAction(AddTodo)}">      
      <input
        evs.input="${useAction(SetNewTodoText)}"
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
        ${TodosList}
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
  AddTodo(state) {
    return {
      ...state,
      newTodo: setupNewTodo(),
      todos: {
        ...state.todos,
        [state.newTodo.id]:
          state.newTodo,
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
    const iterRange = new Array(100).fill(0);
    const listOfStrings = new Array(200).fill(0).map(() =>
      Math.random().toString(16).slice(0, 6));
    console.log(listOfStrings.join().length);
    const actionHandler = (ctx, ev) => {
      console.log(ctx);
      return {
        type: 'setNewTodoText',
        text: ev.target.value,
      };
    };
    // console.log(listOfStrings.join('').length);
    function actionCreationPerf(
      scope,
    ) {
      iterRange.forEach(() => {
        evs.action(
          scope,
          actionHandler,
          listOfStrings,
        );
      });
    }
    const { actionPerf } = state;
    const results = benchFn(
      actionCreationPerf,
      evs.createScope('testBench'),
      actionPerf.count,
    );
    console.log(results);
  },
};

function init() {
  let state = initialState;

  console.log(evScope);

  const { $root } = setupDOM();

  const update = (nextState) => {
    state = nextState;
    render($root, state);
  };

  evs.subscribe(evScope, (action, ev) => {
    console.log(action);
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
  });

  update(state);
}

init();
