/* global document, performance */
import * as atomicState from 'atomic-state';
import { css } from 'emotion';
import {
  Hello,
  renderWith,
  nativeElements,
  createElement,
} from './prototype.ldom';
import * as styles from './styles';
import { TodoApp } from './todo-app';
import {
  useModel,
  shallowCompare as shouldUpdate,
} from '../src/internal/auto-dom';
import { enqueueHook } from '../src/internal/auto-dom/vnode';

const TodoAppMemoized = (props) =>
  ([TodoApp,
    { ...props, shouldUpdate }]
  );

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

    if (!data.opened) {
      return [null];
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
  }) => {
    const modalModel = useModalModel(refId, modalName);
    const { opened } = read(modalModel);

    return (
      [A.button,
        { style: { display: 'block' },
          onClick() {
            setModalOpen(refId, modalName);
          } },
        'Toggle modal: ',
        [A.strong, modalName],
        [A.span, { style: { display: 'block' } },
          'opened: ', [A.strong, String(opened)]]]);
  };

  const NullA = ({ $$refId }) => {
    enqueueHook($$refId, (type) => {
      console.log(type, $$refId);
    });

    return null;
  };

  const NullB = ({ $$refId }) => {
    enqueueHook($$refId, (type) => {
      console.log(type, $$refId);
    });

    return null;
  };

  const useRootModel = (refId) =>
    useModel(refId, 'rootModel', defaultState,
      { shouldCleanup: () =>
        false });

  const ModalExamples = ({ name }) =>
    ([
      name.toLowerCase() === 'leland'
        ? [Modal, { name: 'DefaultModal' }]
        : null,
      [Modal, { name: 'OtherModal' }],

      [ModalToggleBtn, { modalName: 'DefaultModal' }],
      [ModalToggleBtn, { modalName: 'OtherModal' }],
    ]);

  const ToggleField = ({ checked, onToggle }) =>
    ([A.label,
      [A.input,
        { type: 'checkbox',
          checked,
          onChange: (ev) => {
            onToggle(ev.target.checked);
          } }],
      'toggle field']);

  const MountDismountTest = ({ $$refId }) => {
    const model = useModel($$refId, $$refId, { toggleState: false });
    const state = read(model);

    return ([
      [state.toggleState ? NullA : NullB],

      'checked: ',
      String(state.toggleState),

      [ToggleField,
        { checked: state.toggleState,
          onToggle(checked) {
            swap(model, (s, toggleState) =>
              ({
                ...s,
                toggleState,
              }), checked);
          } }],
    ]);
  };

  const PerfTests = ({ $$refId }) => {
    const model = useRootModel($$refId);
    const data = atomicState.read(model);

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

  const View = ({ $$refId }) => {
    const model = useRootModel($$refId);
    const data = atomicState.read(model);

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
      data.name.length < 10
        ? [TodoAppMemoized]
        : [A.comment]
    );

    const MultipleTodoApps = () =>
      ([
        conditionalTodoApp,
        [TodoAppMemoized,
        // { name: data.name },
        ],
      ]);

    return (
      [A.div,
        { class: css`
            font-family: sans-serif;
            min-height: 100vh;
            padding: 1rem;
          ` },
        mainStyle,
        [ModalExamples, { name: data.name }],
        [MountDismountTest],

        [A.div, 'todo fragments'],
        [MultipleTodoApps],

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
    const RootNode = A[rootDom.tagName.toLowerCase()];

    document.body.appendChild(rootDom);
    renderWith(
      rootDom,
      [RootNode,
        [View],
        [PerfTests],
      ],
      seedPath,
    );
  };

  bootstrap('Example-1');
})();
