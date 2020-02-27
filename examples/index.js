/* global document, performance, window */
import morphdom from 'morphdom';
import * as atomicState from 'atomic-state/lib';
import * as evs from '../src/index';
import {
  isEvsComponent,
  componentClassName,
  watchComponentsAdded,
} from '../src/internal/web-component';
import { isBrowser } from '../src/constants';
import { equal } from '../src/internal/equal';
import {
  Hello,
  renderToDomNode,
  nativeElements,
  createElement,
  isElement,
} from './prototype.ldom';

if (isBrowser) {
  watchComponentsAdded(document.body);
}

const html = (strings, ...exprs) => {
  let out = '';
  let i = 0;
  while (i < strings.length) {
    const e = exprs[i];
    out += strings[i] + (e !== undefined ? e : '');
    i += 1;
  }
  return out;
};

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

const globalState = atomicState.atom({
  todos: {},
  newTodo: setupNewTodo(),
  actionPerf: {
    count: 5,
  },
  tickCount: 0,
  logAction: false,
});

const stateReducers = {
  Init(state) {
    return state;
  },
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
        [id]: {
          ...todo,
          ...changes,
        },
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
  SetupMockTodos(state, { count = 1 }) {
    return {
      ...state,
      todos: Array(count).fill(0).reduce((result, _, index) => {
        const r = result;
        r[`item${index}`] = setupNewTodo({
          id: `item${index}`,
          text: 'initial item',
        });

        return r;
      }, {
      }),
    };
  },
  EnableLogAction(state, action) {
    const { enabled = true } = action;

    return {
      ...state,
      logAction: enabled,
    };
  },
};

const evScope = evs.createScope('EvsTest', {
  dataSource() {
    return globalState;
  },
});

const NullRender = '@NullRender';
function isNullRender(v) {
  return equal(v, NullRender);
}

function BoolAttr(attrName, isTrue) {
  return isTrue ? attrName : '';
}

const baseMorphdomOptions = {
  onBeforeElUpdated(fromEl, toEl) {
    if (isEvsComponent(fromEl)) {
      const renderAttr = `evs.${evs.customEvents.render}`;
      const fromRender = fromEl.getAttribute(renderAttr);
      const toRender = toEl.getAttribute(renderAttr);

      return !equal(fromRender, toRender);
    }

    if (fromEl.isEqualNode(toEl)) {
      return false;
    }

    return true;
  },
  onBeforeElChildrenUpdated(fromEl) {
    return !isEvsComponent(fromEl);
  },
};

function renderDom(domNode, htmlString) {
  const childrenOnly = isEvsComponent(domNode);

  morphdom(domNode, htmlString, {
    ...baseMorphdomOptions,
    childrenOnly,
  });
}

const noop = () =>
  ({
    type: '@noop',
  });

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

  return {
    $root,
  };
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
  return {
    results,
    average: results.reduce((a, b) =>
      a + b) / results.length,
  };
}
window.benchFn = benchFn;

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

const TestComponent = (props, ns) => {
  const {
    children = '',
    $root,
  } = props;
  const stateRef = evs.getDataSource(ns);
  const state = atomicState.read(stateRef);

  /**
   * Since we can watch with a key, its just overwrites
   * the previous watcher after each render. This allows
   * us to watch the state and rerender automatically
   * when it changes.
   */
  atomicState.addWatch(stateRef, $root, () => {
    evs.notify(
      evScope,
      TestComponent(props, ns),
    );
  });

  return {
    type: 'ComponentRender',
    rootNode: $root,
    attributes: {
      style: `
        border: 1px solid #000;
        padding: 1rem;
      `,
    },
    render: html`
      <h2>My Custom Component</h2>
      ${children}
    `,
  };
};

const NullComponent = ({ $root }) =>
  ({
    type: 'ComponentRender',
    rootNode: $root,
    render: NullRender,
  });

const ToggleLogAction = (enabled) =>
  ({
    type: 'EnableLogAction',
    enabled: !enabled,
  });

function DevUi({ logAction }) {
  return html`
    <div>
      <h2>Dev controls</h2>
      <label>
        <input
          type="checkbox"
          ${BoolAttr('checked', logAction)}
          evs.change="${evScope.call(
            ToggleLogAction, logAction,
          )}"
        />
        log actions
      </label>
    </div>
  `;
}

function renderApp(state) {
  const TodoItem = ([id, { text, done }]) => {
    const editText = evScope.call(
      TodoSetText,
      { id, text: evs.InputValue },
    );
    const toggleDone = evScope.call(
      TodoSetDone,
      { id, done: evs.InputChecked },
    );
    const SubComponent = done
      ? evScope.call(NullComponent, {
        $root: evs.EventTarget,
      })
      : evScope.call(TestComponent, {
        $root: evs.EventTarget,
        children: html`
          <div>First Child</div>

          <div evs._render="${evScope.call(
            TestComponent, {
              $root: evs.EventTarget,
            },
          )}"></div>

          <div>Next Child</div>`,
      });

    return html`
      <li>
        <input
          type="checkbox"
          ${BoolAttr('checked', done)}
          evs.change="${toggleDone}"
        />

        <input
          value="${text}"
          evs.input="${editText}"
        />

        <div evs._render="${SubComponent}"></div>
      </li>
    `;
  };

  const PerfUi = html`
    <form
      evs.submit="${evScope.call(
        RunActionPerf,
        null,
        { preventDefault: true },
      )}"
    >
      <div>
        benchmark count:
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

  const NewTodoForm = html`
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

  return html`
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

        ${DevUi({ logAction: state.logAction })}
        ${PerfUi}

        ${NewTodoForm}
        ${TodosList}
      </div>
    </div>
  `;
}

function wrapWithRoot(tagName, renderResult) {
  /**
   * Morphdom includes the root node
   * when diffing, so we need to
   * include it.
   */

  return html`
<${tagName}>${renderResult}</${tagName}>
  `;
}

const sideEffects = {
  RunActionPerf(state) {
    const { actionPerf } = state;
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
    const shouldDismount = isNullRender(render)
      && !rootNode.evsDismounted;

    if (shouldDismount) {
      rootNode.evsDismounted = true;
      rootNode.parentNode.removeChild(rootNode);
      return;
    }

    const isNoChange = equal(rootNode.evsPreviousRender, render);

    if (isNoChange) return;

    rootNode.evsPreviousRender = render;

    renderDom(
      rootNode,
      wrapWithRoot(tagName, render),
    );

    Object.keys(attributes).forEach((key) => {
      rootNode.setAttribute(
        key, attributes[key],
      );
    });
    rootNode.classList.add(componentClassName);
  },
};

function init() {
  const { $root } = setupDOM();

  evScope.subscribe((action) => {
    const state = atomicState.read(globalState);
    if (state.logAction) {
      console.group('evs data');
      console.log('[action]', action);
      console.log('[info]', evs.info());
      console.groupEnd();
    }
    const { type } = action;

    const effectFn = sideEffects[type] || noop;
    effectFn(state, action);

    const reducer = stateReducers[type];
    if (!reducer) {
      return;
    }

    const markerA = 'render marker';
    performance.mark(markerA);

    const nextState = atomicState
      .swap(globalState, reducer, action);
    renderDom(
      $root,
      renderApp(nextState),
    );

    performance.measure('render time', markerA);
    console.log(performance.getEntriesByType('measure')[0]);
    performance.clearMarks();
    performance.clearMeasures();
  });

  evs.notify(
    evScope,
    {
      type: 'Init',
    },
  );

  evs.notify(
    evScope,
    {
      type: 'SetupMockTodos',
      count: 2,
    },
  );
}

// init();

(() => {
  const rootDom = document.createElement('div');
  document.body.appendChild(rootDom);

  const { atom, swap } = atomicState;

  const scope = evs.createScope('@vdomTest');

  const BenchCreateElement = ({ size = 1000, numTests = 5 }) => {
    console.log(
      createElement(
        [Hello, { name: 'foo',
                  scope }],
      ),
    );
    const range = Array(size).fill(0);
    const test = () => {
      range.forEach(() => {
        createElement(
          [Hello, { name: 'foo',
                    scope }],
        );
      });
    };

    // const vNode = createElement(Hello, { name: 'foo', scope });
    // console.log(vNode);

    console.log(
      benchFn(test, null, numTests),
    );
  };

  const MeasureIteration = ({ size = 1000, numTests = 5 }) => {
    /*
     * Benchmarking different iteration algorithms just to see
     * the average cost of it and decide whether we need to
     * optimize or not.
     */
    const range = Array(size).fill(0);
    const items = Array(10).fill(0);
    console.log(
      benchFn(() => {
        range.forEach(() => {
          items.map((v) =>
            [v + 1, v + 2]);
        });
      }, null, numTests),
    );
  };

  const effects = {
    BenchCreateElement,
    MeasureIteration,
  };

  const onEvent = (action, context) => {
    const { render, dataSource, rootReducer } = context;
    console.log(`[${scope.namespace}]`, action);
    const nextState = swap(
      dataSource, rootReducer, action,
    );
    render(nextState);

    const { type } = action;
    if (effects[type]) {
      effects[type](action);
    }
  };

  const RunBench = (options) =>
    ({
      type: 'BenchCreateElement',
      ...options,
    });

  const RunMeasureIteration = () =>
    ({
      type: 'MeasureIteration',
    });

  const render = (data) => {
    const A = nativeElements;
    const Group = ({ children }) =>
      children.map((node) => {
        if (isElement(node)) {
          const { properties: props } = node;
          return { ...node,
                   properties: { ...props,
                                 class: `${props.class || ''} AGroup` } };
        }
        return node;
      });

    const PerfTests = () => {
      const runBench = scope.call(
        RunBench,
        { size: 200, numTests: 5 },
      );

      const measureIteration = scope.call(
        RunMeasureIteration,
      );

      return (
        [Group,
          [A.div,
            [A.h2, 'Perf testing'],
            [A.button,
              { onClick: runBench },
              'create vnodes',
            ],
            [A.button,
              { onClick: measureIteration,
                autofocus: true },
              'measure iteration',
            ],
          ],
        ]
      );
    };

    const View = () =>
      [A.div,
        [PerfTests],
        [Hello, { name: data.name,
                  scope }]];

    renderToDomNode(rootDom, [View]);
  };

  const rootReducer = (state, action) => {
    const { type } = action;

    switch (type) {
    case 'SetName': {
      const { name } = action;
      return { ...state, name };
    }

    case '@VdomTestInit':
      return state;

    default:
      return state;
    }
  };

  const dataSource = atom({
    name: 'Leland',
  });

  evs.subscribe(scope, onEvent,
    { render, rootReducer, dataSource });

  evs.notify(scope, {
    type: '@VdomTestInit',
  });
})();
