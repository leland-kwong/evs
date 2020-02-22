import {
  encodeAction,
  decodeAction,
} from './action-encoder';

import {
  createNamespace,
} from './index';

const ns = createNamespace('@actionEncoder');

describe('action encoder', () => {
  test('encoder', () => {
    const context = {
      contextProp: 'foo',
    };
    const helpers = {
      myHelper(ctx) {
        return ctx.contextProp;
      },
    };
    const encoded = encodeAction(ns, {
      type: 'SomeAction',
      propExpression: '{myHelper}',
    }, context);
    const dataSource = (query, ctx) =>
      helpers[query](ctx);
    const decoded = decodeAction(encoded, undefined, dataSource);

    expect(decoded).toEqual({
      type: 'SomeAction',
      propExpression: context.contextProp,
    });
  });
});
