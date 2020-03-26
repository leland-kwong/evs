import { read, swap } from 'atomic-state';
import {
  useModel,
  enqueueHook,
  nativeElements as A,
} from '../src/internal/auto-dom';

const filterCall = (predicate, fn) =>
  (...args) => {
    if (predicate(...args)) {
      fn(...args);
    }
  };

const whenInit = (type) =>
  type === 'init';

const noAsyncData = 'noAsyncData';

const useAsync = (() => {
  const modelMeta = {
    shouldCleanup: () =>
      false,
  };
  const initialState = {
    value: noAsyncData,
    status: 'fetching',
    error: 'noError',
  };

  return (refId, fetchData, fetchOptions) => {
    const { apiRoute = '' } = fetchOptions;
    const model = useModel(
      refId, apiRoute, initialState, modelMeta,
    );
    const data = read(model);

    enqueueHook(refId, filterCall(whenInit, () => {
      const next = (value) => {
        swap(model, (state) =>
          ({
            ...state,
            status: 'fetchSuccess',
            value,
          }));
      };

      const onError = (err) => {
        swap(model, (state) =>
          ({
            ...state,
            value: 'error',
            status: 'error',
            error: err,
          }));
      };
      fetchData(next, onError, fetchOptions);
    }));

    return data;
  };
})();

const Info = ({ children: [
  description, value,
] }) =>
  ([A.div,
    [A.span, description], [A.strong, value]]);

export const AsyncTest = ({ $$refId }) => {
  const asyncData = useAsync($$refId, (next) => {
    setTimeout(next, 500, Math.random());
  }, {
    apiRoute: 'randomNum',
  });

  return ([
    [A.h1, 'Async test'],
    [Info, 'value: ', asyncData.value],
    [Info, 'status: ', asyncData.status],
  ]);
};
