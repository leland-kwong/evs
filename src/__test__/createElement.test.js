import {
  nativeElements as A,
  createElement,
  valueTypes,
} from '../internal/auto-dom';
import { isArray } from '../internal/utils';
import { nextPathKey } from '../internal/constants';

const seedPath = 'seedPath';

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

  test('props', () => {
    const Component = ({ myProp }) =>
      [A.div, myProp];
    const element = createElement(
      [Component, { myProp: 'foo' }],
      seedPath,
    );

    expect(
      element.props.children[0],
    ).toEqual(
      createElement(
        [A.div, 'foo'],
        seedPath,
      ).children[0],
    );
  });

  describe('Functional component', () => {
    test('ref id', () => {
      const Component = ({ myProp }) =>
        [A.div, myProp];
      const element = createElement(
        [Component, { myProp: 'foo' }], seedPath,
      );

      expect(
        element.props.$$refId,
      ).toEqual([seedPath, nextPathKey].join('.'));
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
          [seedPath, nextPathKey, 0, 0].join('.'),
        );

        expect(
          elementDeep
            .children[0]
            .children[1].props.$$refId,
        ).toEqual(
          [seedPath, nextPathKey, 0, 1].join('.'),
        );
      });
    });

    describe('fragment', () => {
      test('fragment', () => {
        const Fragment = () =>
          ([
            [A.div],
            [A.div],
          ]);
        const value = createElement(
          [Fragment], seedPath,
        );

        expect(
          value.map((vnode) =>
            vnode.key),
        ).toEqual(
          [
            [seedPath, 0].join('.'),
            [seedPath, 1].join('.'),
          ],
        );
      });

      test('keyed fragment', () => {
        const parentKey = '@fragment';
        const Fragment = () =>
          ([
            [A.div],
            [A.div],
          ]);
        const value = createElement(
          [Fragment, { key: parentKey }],
          seedPath,
        );

        expect(
          value.map((vnode) =>
            vnode.key),
        ).toEqual(
          [
            [parentKey, 0].join('.'),
            [parentKey, 1].join('.'),
          ],
        );
      });

      test('multiple keyed fragments as siblings', () => {
        const Fragment = () =>
          ([
            [A.div],
            [A.div],
          ]);
        const MultiFragment = () =>
          ([
            [Fragment, { key: 'parent-1' }],
            [Fragment, { key: 'parent-2' }],
          ]);

        const value = createElement(
          [MultiFragment],
          seedPath,
        );

        expect(
          value.flat().map((vnode) =>
            vnode.key),
        ).toEqual(
          [
            [seedPath, 'parent-1', 0].join('.'),
            [seedPath, 'parent-1', 1].join('.'),

            [seedPath, 'parent-2', 0].join('.'),
            [seedPath, 'parent-2', 1].join('.'),
          ],
        );
      });
    });
  });

  describe('Functional component with key', () => {
    const key = 'bar-key';
    const Component = () =>
      [A.div, [A.div, 'foo']];
    const element = createElement(
      [Component, { key }], seedPath,
    );

    test('key transfers through to vnode', () => {
      expect(
        element.key,
      ).toBe([key, nextPathKey].join('.'));
    });
  });

  describe('Child component with key', () => {
    const key = 'bar-key';
    const Component = () =>
      [A.div, [A.div, { key }, 'foo']];
    const element = createElement(
      [Component], seedPath,
    );

    test('key replaces last part of refId', () => {
      expect(
        element.props.children[0].props.$$refId,
      ).toBe([seedPath, nextPathKey, key].join('.'));
    });
  });

  describe('List of components', () => {
    const Component = ({ value }) =>
      ([A.div, value]);

    test('simple list', () => {
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

    test('recursive list with keys', () => {
      const parentKey = '@recursive';
      const Recursive = ({ chars }) => {
        if (!chars.length) {
          return [];
        }

        const [, ...rest] = chars;
        return ([
          (chars.map((c) =>
            [A.div, c])),
          [Recursive, { chars: rest }],
        ]);
      };

      const value = createElement(
        [Recursive, { chars: ['a', 'b'], key: parentKey }],
        seedPath,
      );

      const toKeysTree = (v) =>
        v.reduce((tree, vnode) => {
          if (isArray(vnode)) {
            tree.push(toKeysTree(vnode));
          } else if (valueTypes.isType(vnode, valueTypes.vnode)) {
            tree.push(vnode.key);
          }
          return tree;
        }, []);

      expect(
        toKeysTree(value),
      ).toEqual([
        [
          [parentKey, 0].join('.'),
          [parentKey, 1].join('.'),
        ],
        [
          [
            [parentKey, 1, 0].join('.'),
          ],
          [],
        ],
      ]);
    });

    test('auto-expand nested lists', () => {
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
