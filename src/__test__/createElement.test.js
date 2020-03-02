import {
  nativeElements as A,
  createElement,
} from '../internal/auto-dom';

describe('createElement', () => {
  describe('Functional component', () => {
    const rootId = 'withKey';
    const Component = () =>
      [A.div, 'foo'];
    const element = createElement(
      [Component], rootId,
    );

    test('ref id', () => {
      expect(
        element.props.$$refId,
      ).toBe([rootId].join('.'));
    });
  });

  describe('Functional component with key', () => {
    const rootId = 'withKey';
    const key = 'bar-key';
    const Component = () =>
      [A.div, [A.div, 'foo']];
    const element = createElement(
      [Component, { key }], rootId,
    );

    test('key replaces last part of refId', () => {
      expect(
        element.props.children[0].props.$$refId,
      ).toBe([key, 0].join('.'));
    });
  });

  describe('Child component with key', () => {
    const rootId = 'withKey';
    const key = 'bar-key';
    const Component = () =>
      [A.div, [A.div, { key }, 'foo']];
    const element = createElement(
      [Component], rootId,
    );

    test('key replaces last part of refId', () => {
      expect(
        element.props.children[0].props.$$refId,
      ).toBe([rootId, key].join('.'));
    });
  });
});
