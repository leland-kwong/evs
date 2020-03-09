/* global document, performance */
import * as atomicState from 'atomic-state/lib';
import * as evs from '../src/index';
import {
  Hello,
  renderWith,
  nativeElements,
  createElement,
  Fragment,
} from './prototype.ldom';
import * as styles from './styles';
import { TodoApp } from './todo-app';
import { useHook } from '../src/internal/auto-dom';

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
    const seedPath = Math.random().toString(32);
    const range = Array(size).fill(0);
    const test = () => {
      range.forEach(() => {
        createElement(
          [Hello, { name: 'foo',
                    scope }],
          seedPath,
        );
      });
    };

    const vNode = createElement(
      [Hello, { name: 'foo', scope }],
      seedPath,
    );
    console.log(vNode);

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

  const SetBenchOptions = (options) =>
    ({
      type: 'SetBenchOptions',
      options,
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
    benchOptions: {
      size: 200,
      numTests: 3,
    },
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

  let previousRender1 = rootDom;
  let frag1State = [
    'a',
    'b',
  ];

  const render = () => {
    const Frag1 = (props) => {
      console.log(props);
      return (
        [Fragment, { key: 'fragA' },
          [A.div, {
            onClick() {
              frag1State = [
                Math.random(),
                ...frag1State,
              ];

              // renderWith(
              //   previousRender1,
              //   {
              //     ...previousRender1,
              //   }
              // )
            },
          }, frag1State[0]],
          [A.div, 'b'],
        ]
      );
    };

    const Frag2 = () =>
      ([Fragment,
        [A.div, 'c'],
        [A.div, 'd'],
      ]);

    const RootView = () =>
      (
        [A.div,
          [Frag1],
          [Frag2]]
      );

    previousRender1 = renderWith(
      previousRender1, [RootView], '@View1',
    );

    console.log(previousRender1);

    // const View2 = () =>
    //   [
    //     [A.h3, 'fragment 2'],
    //     [Fragment2, { key: 'd' }],
    //   ];

    // previousRender1 = renderWith(
    //   previousRender1, [View2], '@View2',
    // );
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

    case 'SetBenchOptions': {
      const { options } = action;
      return { ...state,
               benchOptions: { ...state.benchOptions,
                               ...options } };
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
