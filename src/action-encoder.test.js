import {
  encodeAction,
  decodeAction,
} from './action-encoder';

import {
  createScope,
} from './index';

const ns = createScope('@actionEncoder');

describe('action encoder', () => {
  test('encode with action function', () => {
    const context = {
      contextProp: 'foo',
    };
    function SomeAction(ctx) {
      return {
        type: 'SomeAction',
        propExpression: ctx.contextProp,
      };
    }
    const encoded = encodeAction(
      ns, SomeAction, context,
    );
    const [decoded] = decodeAction(
      encoded, undefined, null,
    );

    expect(decoded).toEqual({
      type: 'SomeAction',
      propExpression: context.contextProp,
    });
  });
});
