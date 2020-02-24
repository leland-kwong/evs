/* global document, performance, window */
import outdent from 'outdent';
import morphdom from 'morphdom';
import * as evs from '../src/index';
import { isEvsComponent } from '../src/internal/web-component';

function renderDom(domNode, htmlString) {
  const childrenOnly = isEvsComponent(domNode);

  morphdom(domNode, htmlString, {
    onBeforeElChildrenUpdated(fromEl) {
      if (isEvsComponent(fromEl)) {
        return false;
      }
      return true;
    },
    childrenOnly,
  });
}

const evScope = evs.createScope('EvsTest');

const noop = () =>
  ({ type: '@noop' });

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

const CheckboxComponent = ({
  $root,
}) =>
  ({
    type: 'ComponentRender',
    rootNode: $root,
    render: /* html */`
      <div>
        <strong>custom checkbox</strong>
      </div>
      <input type="checkbox" checked />
    `,
  });

const TestComponent = ({
  children,
  $root,
}) =>
  ({
    type: 'ComponentRender',
    rootNode: $root,
    attributes: {
      style: `
        border: 1px solid #000;
        padding: 1rem;
      `,
    },
    render: /* html */`\
      <h2>My Custom Component</h2>
      ${children}

      <evs-checkbox evs._render="${evScope.call(
        CheckboxComponent, {
          $root: evs.EventTarget,
        },
      )}"></evs-checkbox>
    `,
  });

function renderApp(rootNode, state) {
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
          value="${text}"
          evs.input="${editText}"
        />

        <div evs._render="${evScope.call(
          TestComponent, {
            props: {
              count: state.tickCount,
            },
            $root: evs.EventTarget,
            children: /* html */`
              <div>First Child ${state.tickCount}</div>

              <div evs._render="${evScope.call(
                TestComponent, {
                  $root: evs.EventTarget,
                  children: /* html */`
                    <div>I am recursive</div>
                  `,
                },
              )}"></div>

              <div>Next Child</div>
            `,
          },
        )}"></div>
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
      <button
        type="submit"
        evs.click="${evScope.call(
          noop,
          evs.InputValue,
        )}"
      >
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

  renderDom(rootNode, outdent/* html */`
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

function setupNewTodo(props = {}) {
  const {
    id = makeTodoId(),
    text = '',
    done = false,
  } = props;

  return { text, done, id };
}

const initialState = {
  todos: {
    item1: setupNewTodo({
      id: 'item1',
      text: 'initial item',
    }),
  },
  newTodo: setupNewTodo(),
  actionPerf: {
    count: 5,
  },
  tickCount: 0,
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
  Tick(state) {
    return {
      ...state,
      tickCount: state.tickCount + 1,
    };
  },
};

function wrapWithRoot(tagName, renderResult) {
  /**
   * Morphdom includes the root node
   * when diffing, so we need to
   * include it.
   */

  return /* html */`
<${tagName}>${renderResult}</${tagName}>
  `.trim();
}

const sideEffects = {
  RunActionPerf(state) {
    const iterRange = new Array(400).fill(0);
    const listOfStrings = new Array(50).fill(0).map(() =>
      Math.random().toString(16).slice(0, 10)).join('');
    // console.log(listOfStrings.length);
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

  ComponentRender(state, action) {
    const {
      rootNode,
      /* attributes to reflect to host */
      attributes = {},
      /* html string */
      render = '',
    } = action;
    const { tagName } = rootNode;

    renderDom(
      rootNode,
      wrapWithRoot(tagName, render),
    );

    Object.keys(attributes).forEach((key) => {
      rootNode.setAttribute(
        key, attributes[key],
      );
    });
  },
};

function init() {
  let state = initialState;

  console.log(evScope);

  const { $root } = setupDOM();

  const update = (nextState) => {
    state = nextState;
    renderApp($root, state);
  };

  evScope.subscribe((action) => {
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

  window.tick = () => {
    update(stateReducers.Tick(state));
  };

  update(state);
}

init();
