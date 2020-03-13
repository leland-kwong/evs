/* global document, performance */
import * as atomicState from 'atomic-state';
import { css } from 'emotion';
import * as evs from '../src/index';
import {
  Hello,
  renderWith,
  nativeElements,
  createElement,
} from './prototype.ldom';
import * as styles from './styles';
import { TodoApp } from './todo-app';
import { useModel } from '../src/internal/auto-dom';

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
  const { swap } = atomicState;

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
    console.log(
      benchFn(() => {
        range.forEach((i) => {
          Symbol(1);
        });
      }, null, numTests),
    );
  };

  const effects = {
    BenchCreateElement,
    MeasureIteration,
  };

  const defaultState = {
    name: 'Leland',
    logAction: false,
    benchOptions: {
      size: 200,
      numTests: 3,
    },
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

  const View = ({ $$refId }) => {
    const model = useModel($$refId, $$refId, defaultState);
    const data = atomicState.read(model);

    const PerfTests = () => {
      const runBench = () => {
        effects.BenchCreateElement(data.benchOptions);
      };

      const btnRunBench = (
        [A.button,
          { onClick: runBench },
          'create vnodes',
        ]);

      const BenchOptionCtrl = ({ fieldName, state }) =>
        (
          [A.label, { style: { display: 'block' } },
            fieldName,
            [A.input, { type: 'number',
                        value: state[fieldName],
                        onChange: (ev) => {
                          swap(model, rootReducer, {
                            type: 'SetBenchOptions',
                            options: {
                              [fieldName]: Math.max(1,
                                Number(ev.currentTarget.value)),
                            },
                          });
                        } }]]);

      const benchOptions = (
        [A.div, { class: styles.Section },
          [BenchOptionCtrl,
            { fieldName: 'size', state: data.benchOptions }],
          [BenchOptionCtrl,
            { fieldName: 'numTests', state: data.benchOptions }]]
      );

      return (
        [A.div,
          [A.h2, 'Perf testing'],
          btnRunBench,
          benchOptions,
        ]
      );
    };

    const mainStyle = (
      [A.style,
        /* css */`
          body,
          html {
            margin: 0;
            padding: 0;
          }

          * {
            box-sizing: border-box;
          }
        `,
      ]
    );

    return (
      [A.div,
        { class: css`
            font-family: sans-serif;
            min-height: 100vh;
            padding: 1rem;
          ` },
        mainStyle,
        data.name.length < 10
          ? [TodoApp,
            { key: 'TodoApp',
              name: data.name },
          ]
          : [A.comment],

        [TodoApp],
        [PerfTests],
        [Hello, { name: data.name,
                  onNameChange(newName) {
                    swap(model, rootReducer, {
                      type: 'SetName',
                      name: newName,
                    });
                  },
                  key: 'HelloRoot' }],
      ]);
  };

  renderWith(rootDom, [View], '@Example');
})();
