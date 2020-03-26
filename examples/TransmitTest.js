import { read, swap } from 'atomic-state';
import {
  nativeElements as A,
  transmit,
  useReceiver,
  useModel,
} from '../src/internal/auto-dom';

const GREETING = 'GREETING';

const Transmitter = ({ $$refId }) =>
  ([A.button,
    { onClick: () => {
      transmit($$refId, GREETING);
    } },
    'transmit message']
  );

const getTime = () =>
  new Date().toLocaleTimeString();

export const TransmitTest = ({ $$refId }) => {
  const initialState = {
    message: 'No message',
    transmittedAt: getTime(),
  };
  const stateModel = useModel($$refId, $$refId, initialState);
  const state = read(stateModel);
  useReceiver($$refId, (message) => {
    console.log(message);
    swap(stateModel, () =>
      ({ message,
         transmittedAt: getTime() }));
  });

  return (
    [A.div,
      [A.h1, 'Transmit test'],
      [A.div,
        'message: ',
        [A.strong, state.message]],
      [A.div,
        'sent on: ',
        [A.strong, state.transmittedAt]],
      [Transmitter],
    ]
  );
};
