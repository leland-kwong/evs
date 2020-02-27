/* global document, performance, window */
import * as atomicState from 'atomic-state/lib';
import * as evs from '../src/index';
import {
  watchComponentsAdded,
} from '../src/internal/web-component';
import { isBrowser } from '../src/constants';
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
};

// init();

(() => {
  const rootDom = document.createElement('div');
  document.body.appendChild(rootDom);

  const { atom, swap } = atomicState;

  const scope = evs.createScope('@vdomTest');

  const BenchCreateElement = ({ size = 1000, numTests = 5 }) => {
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
          const { props } = node;
          return { ...node,
                   props: { ...props,
                            class: `${props.class || ''} AGroup` } };
        }
        return node;
      });

    const PerfTests = () => {
      const runBench = scope.call(
        RunBench,
        { size: 200, numTests: 5 },
      );
      const btnRunBench = (
        [A.button,
          { onClick: runBench },
          'create vnodes',
        ]);

      const measureIteration = scope.call(
        RunMeasureIteration,
      );
      const btnMeasureIteration = (
        [A.button,
          { onClick: measureIteration },
          'measure iteration',
        ]);

      return (
        [Group,
          [A.div,
            [A.h2, 'Perf testing'],
            btnRunBench,
            btnMeasureIteration,
          ]]
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
