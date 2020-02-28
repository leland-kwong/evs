/* global document, performance */
import * as atomicState from 'atomic-state/lib';
import * as evs from '../src/index';
import {
  Hello,
  renderToDomNode,
  nativeElements,
  createElement,
} from './prototype.ldom';

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

(() => {
  const rootDom = document.createElement('div');
  document.body.appendChild(rootDom);

  const A = nativeElements;
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

    // const vNode = createElement([Hello, { name: 'foo', scope }]);
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
    const { render, model, rootReducer } = context;
    const nextState = swap(
      model, rootReducer, action,
    );
    if (nextState.logAction) {
      console.log(`[${scope.namespace}]`, action, nextState);
    }
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

  const ToggleLogger = (enabled) =>
    ({
      type: 'ToggleLogAction',
      enabled,
    });

  const model = atom({
    name: 'Leland',
    logAction: false,
  });

  const DevDashboard = ({ logAction = false }) => {
    const toggler = (
      [A.input,
        { type: 'checkbox',
          class: 'dev-checkbox',
          checked: logAction,
          onChange: (event) =>
            evs.notify(
              scope,
              ToggleLogger(
                evs.InputChecked(event),
              ),
            ) }]
    );

    return (
      [A.form,
        [A.label,
          toggler, ' ', 'log action']]);
  };

  const render = (data) => {
    const PerfTests = () => {
      const runBench = () =>
        evs.notify(
          scope,
          RunBench({ size: 200, numTests: 5 }),
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
        [A.div,
          [A.h2, 'Perf testing'],
          btnRunBench,
          btnMeasureIteration,
        ]
      );
    };

    const View = () =>
      [A.div,
        { style: {
          fontFamily: 'sans-serif',
        } },
        [DevDashboard, data],
        [PerfTests],
        [Hello, { name: data.name,
                  scope }]];

    renderToDomNode(rootDom, [View]);
  };

  const rootReducer = (state, action) => {
    const { type } = action;

    switch (type) {
    case 'ToggleLogAction': {
      const { enabled } = action;
      return { ...state, logAction: enabled };
    }

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

  evs.subscribe(scope, onEvent,
    { render, rootReducer, model });

  evs.notify(scope, {
    type: '@VdomTestInit',
  });
})();
