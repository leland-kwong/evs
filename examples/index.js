/* global document, performance */
import * as atomicState from 'atomic-state';
import { css } from 'emotion';
import {
  Hello,
  renderWith,
  nativeElements,
  createElement,
  Fragment,
} from './prototype.ldom';
import * as styles from './styles';
import { TodoApp } from './todo-app';
import {
  useModel,
} from '../src/internal/auto-dom';

const propsToIgnoreForCheck = new Set([
  // children are diff'd separately
  'children',
  'shouldUpdate',
]);

const shouldUpdate = (oldProps, newProps) => {
  const { children: oldCh = [] } = oldProps;
  const { children = [] } = newProps;

  const hasNewChildren = children.length !== oldCh.length
    || (children.length > 0 && children.find((v, i) =>
      v !== oldCh[i]));
  let hasChanges = hasNewChildren;

  // eslint-disable-next-line no-restricted-syntax
  for (const key in newProps) {
    if (propsToIgnoreForCheck.has(key)) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (hasChanges) {
      break;
    }

    const hasChanged = oldProps[key]
      !== newProps[key];
    if (hasChanged) {
      hasChanges = true;
      break;
    }
  }

  // eslint-disable-next-line no-console
  // console.log('hasChanges', hasChanges, oldProps, newProps);

  return hasChanges;
};

// const TodoAppMemoized = (props) => {
//   const {
//     $$refId,
//     ...inputProps
//   } = props;

//   return (
//     [TodoApp,
//       { ...inputProps, shouldUpdate }]
//   );
// };

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
  const A = nativeElements;
  const { swap, read } = atomicState;

  const BenchCreateElement = ({ size = 1000, numTests = 5 }) => {
    const seedPath = Math.random().toString(32).slice(2);
    const range = Array(size).fill(0);
    const onNameChange = () => {};
    const test = () => {
      range.forEach(() => {
        createElement(
          [Hello, { name: 'foo',
                    onNameChange }],
          seedPath,
        );
      });
    };

    const vNode = createElement(
      [Hello, { name: 'foo', onNameChange }],
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
        range.forEach(() => {
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

  const useModalModel = (
    refId,
    modalName,
    initialState = { opened: true },
  ) =>
  // console.log('modal refId', refId);

    useModel(refId, modalName, initialState, {
      shouldCleanup: () =>
        false,
    });
  const setModalOpen = (refId, modalName, isOpened) => {
    const model = useModalModel(refId, modalName);
    swap(
      model,
      (state, opened = !state.opened) =>
        ({
          ...state,
          opened,
        }),
      isOpened,
    );
  };

  const Modal = ({ $$refId, name: modalName }) => {
    const modalModel = useModalModel($$refId, modalName);
    const data = read(modalModel);

    // console.log('[modal render]', getAllModels($$refId));

    if (!data.opened) {
      return null;
    }

    return (
      [A.div,
        [A.h2, modalName],
        [A.div, 'Modal body']]
    );
  };

  const ModalToggleBtn = ({
    $$refId: refId,
    modalName,
  }) =>
    ([A.button,
      { onClick() {
        setModalOpen(refId, modalName);
      } },
      'Toggle modal: ',
      [A.strong, modalName]]);

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

    const conditionalTodoApp = (
      data.name.length < 100
        ? [TodoApp, { shouldUpdate }]
        : [A.comment]
    );

    const ModalExamples = () =>
      ([A.div,
        [Modal, { name: 'DefaultModal' }],
        [Modal, { name: 'OtherModal' }],

        [ModalToggleBtn, { modalName: 'DefaultModal' }],
        [ModalToggleBtn, { modalName: 'OtherModal' }],
      ]);

    return (
      [A.div,
        { class: css`
            font-family: sans-serif;
            min-height: 100vh;
            padding: 1rem;
          ` },
        mainStyle,
        [ModalExamples],

        /**
         * FIXME
         * Need to figure out a way to make $$refId non-enumerable
         * so that it isn't included when doing a spread onto
         * another component. Currently `forceUpdate` passes in the refId
         * via props, which then gets copied over via `transformConfig`.
         * Instead, we need to update the seedPath functionality to use
         * that as the starting refId.
         */

        /**
         * FIXME
         * Fragments beyond the first must be values
         * returned from a function component otherwise
         * the refId will be incorrect. We should add a
         * check to auto-convert each nested children array
         * beyond the first into fragments.
         */
        [Fragment,
          conditionalTodoApp,
          [TodoApp,
            {
              // name: data.name,
              shouldUpdate }],
        ],
        [PerfTests],
        [Hello,
          { name: data.name,
            onNameChange(newName) {
              swap(model, rootReducer, {
                type: 'SetName',
                name: newName,
              });
            },
            key: 'HelloRoot' }],
      ]);
  };

  const bootstrap = (seedPath) => {
    const rootDom = document.createElement('div');
    document.body.appendChild(rootDom);
    renderWith(rootDom, [View], seedPath);
  };

  bootstrap('@Example-1');
})();
