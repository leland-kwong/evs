import {
  nativeElements as A,
  createElement,
} from '../internal/auto-dom';

describe('createElement', () => {
  describe('error when invalid seed path', () => {
    test('no seed path provided', () => {
      expect(() => {
        createElement(
          [A.div, 1],
        );
      }).toThrow();
    });

    test('invalid seed path format', () => {
      expect(() => {
        createElement(
          [A.div, 1],
          { foo: 'bar' },
        );
      }).toThrow();
    });
  });

  describe('Functional component', () => {
    const seedPath = 'withKey';

    test('ref id', () => {
      const Component = () =>
        [A.div, 'foo'];
      const element = createElement(
        [Component], seedPath,
      );

      expect(
        element.props.$$refId,
      ).toEqual(seedPath);
    });

    describe('deep ref id', () => {
      const Root = ({ children }) =>
        ([A.div, children]);

      const elementDeep = createElement(
        [Root,
          [A.div,
            [A.div],
            [A.div]]], seedPath,
      );

      test('each function call is a depth level', () => {
        expect(
          elementDeep
            .children[0]
            .children[0].props.$$refId,
        ).toEqual(
          [seedPath, 0, 0, 0].join('.'),
        );

        expect(
          elementDeep
            .children[0]
            .children[1].props.$$refId,
        ).toEqual(
          [seedPath, 0, 0, 1].join('.'),
        );
      });
    });
  });

  describe('Functional component with key', () => {
    const seedPath = 'withKey';
    const key = 'bar-key';
    const Component = () =>
      [A.div, [A.div, 'foo']];
    const element = createElement(
      [Component, { key }], seedPath,
    );

    test('key transfers through to vnode', () => {
      expect(
        element.key,
      ).toBe(key);
    });
  });

  describe('Child component with key', () => {
    const seedPath = 'withKey';
    const key = 'bar-key';
    const Component = () =>
      [A.div, [A.div, { key }, 'foo']];
    const element = createElement(
      [Component], seedPath,
    );

    test('key replaces last part of refId', () => {
      expect(
        element.props.children[0].props.$$refId,
      ).toBe([seedPath, key].join('.'));
    });
  });

  describe('List of components', () => {
    const Component = ({ value }) =>
      ([A.div, value]);

    test('simple list', () => {
      const seedPath = 'withKey';
      const list = createElement(
        [1, 2].map((value) =>
          [Component, { value }]),
        seedPath,
      );

      expect(list)
        .toEqual(
          createElement([
            [Component, { value: 1 }],
            [Component, { value: 2 }],
          ], seedPath),
        );
    });

    test('list with keys', () => {
      const seedPath = 'withKey';
      const list = createElement(
        [1, 2].map((value) =>
          [Component, { value, key: value }]),
        seedPath,
      );

      expect(list)
        .toEqual(
          createElement([
            [Component, { value: 1, key: 1 }],
            [Component, { value: 2, key: 2 }],
          ], seedPath),
        );

      const outOfOrderList = createElement(
        [2, 1, 3].map((value, i) =>
          [Component, { value, key: i }]),
        seedPath,
      );

      expect(outOfOrderList)
        .toEqual(
          createElement([
            [Component, { value: 2, key: 0 }],
            [Component, { value: 1, key: 1 }],
            [Component, { value: 3, key: 2 }],
          ], seedPath),
        );
    });

    test('auto-expand nested lists', () => {
      const seedPath = 'nestedList';
      const nestedList = createElement(
        [A.div, 1, [2, 3, [4]]],
        seedPath,
      );

      expect(
        nestedList
          .children,
      ).toEqual(
        createElement(
          [A.div, 1, 2, 3, 4],
          seedPath,
        ).children,
      );
    });
  });
});
