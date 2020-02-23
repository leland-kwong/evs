/* global document, performance */
import outdent from 'outdent';
import morphdom from 'morphdom';
import * as evs from '../src/index';

const evScope = evs.createScope('EvsTest');

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

const SetNewTodoText = (text) =>
  ({
    type: 'SetNewTodoText',
    text,
  });

const AddTodo = () =>
  ({
    type: 'AddTodo',
  });

const RunActionPerf = () =>
  ({
    type: 'RunActionPerf',
  });

const SetActionPerfCount = (count) =>
  ({
    type: 'SetActionPerfCount',
    count,
  });

const TodoSetText = ({ id, text }) =>
  ({
    type: 'EditTodo',
    changes: {
      text,
    },
    id,
  });

const TodoSetDone = ({ id, done }) =>
  ({
    type: 'EditTodo',
    changes: {
      done,
    },
    id,
  });

const TestBubbling = () =>
  ({
    type: 'TestBubbling',
  });

function render(rootNode, state) {
  const TodoItem = ([id, { text, done }]) => {
    const editText = evScope.call(
      TodoSetText,
      { id, text: evs.InputValue },
    );
    const toggleDone = evScope.call(
      TodoSetDone,
      { id, done: evs.InputChecked },
    );

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
    <form 
      evs.submit="${evScope.call(
        RunActionPerf,
        null,
        { preventDefault: true },
      )}"
      evs.click="${evScope.call(
        TestBubbling,
        evs.InputValue,
      )}"
    >
      <div>
        test count:
        <input 
          evs.input="${evScope.call(
            SetActionPerfCount,
            evs.InputNumberValue,
          )}"
          type="number"
          min="1"
          max="50"
          value="${state.actionPerf.count}"
        />
      </div>
      <button type="submit">
        action perf
      </button>
    </form>
  `;

  const NewTodoForm = /* html */`
    <form 
      evs.submit="${evScope.call(
        AddTodo,
        null,
        { preventDefault: true },
      )}"
    >      
      <input
        evs.input="${evScope.call(
          SetNewTodoText,
          evs.InputValue,
        )}"
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
    const { text } = action;

    return {
      ...state,
      newTodo: {
        ...state.newTodo,
        text,
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
      Math.random().toString(16).slice(0, 10));
    // console.log(listOfStrings.join().length);
    const actionHandler = (text) =>
      ({
        type: 'setNewTodoText',
        text,
      });
    const scope = evs.createScope('testBench');
    // console.log(listOfStrings.join('').length);
    function actionCreationPerf(
    ) {
      iterRange.forEach(() => {
        scope.call(
          actionHandler,
          listOfStrings,
        );
      });
    }
    const { actionPerf } = state;
    const results = benchFn(
      actionCreationPerf,
      null,
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

  const unsubscribe = evScope.subscribe((action) => {
    console.log(action);
    const { type } = action;

    const effectFn = sideEffects[type] || noop;
    effectFn(state, action);

    const reducer = stateReducers[type];
    if (!reducer) {
      return;
    }

    update(reducer(state, action));
  });

  // unsubscribe();

  update(state);
}

init();
