/* global document, performance */
import * as atomicState from 'atomic-state';
import { css } from 'emotion';
import {
  Hello,
  renderWith,
  nativeElements as A,
  createElement,
} from './prototype.ldom';
import * as styles from './styles';
import { TodoApp } from './todo-app';
import {
  useModel,
  shallowCompare as shouldUpdate,
  seedPathFromPath,
  useReceiver,
} from '../src/internal/auto-dom';
import { TransmitTest } from './TransmitTest';

const { swap, read } = atomicState;

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

const benchSeedPath = Math.random().toString(32).slice(2);

const BenchCreateElement = ({ size = 1000, numTests = 5 }) => {
  const range = Array(size).fill(0);
  const onNameChange = () => {};
  const test = () => {
    range.forEach(() => {
      createElement(
        [Hello, { name: 'foo',
                  onNameChange }],
        benchSeedPath,
      );
    });
  };

  const vNode = createElement(
    [Hello, { name: 'foo', onNameChange }],
    benchSeedPath,
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
      [A.span,
        { style: { display: 'block' } },
        'opened: ', [A.strong, String(opened)]]]
  );
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

const Protected = (props) => {
  const { $$refId, children } = props;

  try {
    return createElement(
      children,
      seedPathFromPath($$refId),
    );
  } catch (err) {
    const errorStyle = {
      color: 'white',
      padding: '1em',
      background: 'rgb(206, 62, 62)',
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
    };

    return (
      [A.pre,
        { style: errorStyle },
        [A.code,
          err.stack]]
    );
  }
};

const ErrorMaker = ({ children }) => {
  const rand = Math.random() * 10;

  if (rand > 5) {
    throw new Error('foobar');
  }

  return [A.div, 'safe: ', children];
};

const ProtectedExample = ({ name }) =>
  ([Protected,
    [ErrorMaker, name]]);

const Cond = (props) => {
  const { children: conditions, ...rest } = props;

  return conditions
    .filter(([predicate]) =>
      predicate(rest))
    .map(([, ComponentFn]) =>
      [ComponentFn, rest]);
};

const View = ({ $$refId }) => {
  const model = useRootModel($$refId);
  const data = atomicState.read(model);
  useReceiver($$refId, (message) => {
    console.log(message);
  });

  const conditionalTodoApp = (
    [Cond,
      { name: data.name },
      [({ name }) =>
        name.length < 10, TodoAppMemoized],
    ]
  );

  const MultipleTodoApps = () =>
    ([
      conditionalTodoApp,
      [TodoAppMemoized],
    ]);

  return ([
    [ModalExamples, { name: data.name }],
    [MultipleTodoApps],
    [ProtectedExample, data],
    [Hello,
      { name: data.name,
        onNameChange(newName) {
          swap(model, rootReducer, {
            type: 'SetName',
            name: newName,
          });
        } }],
  ]);
};

const cl = {
  root: css`
    font-family: sans-serif;
    min-height: 100vh;
    padding: 1rem;
  `,
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

const bootstrap = (seedPath) => {
  const rootDom = document.createElement('div');
  const RootNode = A[rootDom.tagName.toLowerCase()];

  document.body.appendChild(rootDom);
  renderWith(
    rootDom,
    [RootNode,
      { class: cl.root },
      mainStyle,
      [View],
      [PerfTests],
      [TransmitTest],
    ],
    seedPath,
  );
};

bootstrap('Example-1');
