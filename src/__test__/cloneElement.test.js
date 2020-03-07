import {
  nativeElements as A,
  cloneElement,
  createElement,
} from '../internal/auto-dom';

const seedPath = 'abc';

describe('cloneElement', () => {
  test('clone with null value', () => {
    const baseComponent = () =>
      null;

    expect(
      createElement([
        cloneElement,
        [baseComponent],
      ], seedPath),
    ).toEqual(
      createElement(
        [baseComponent],
        seedPath,
      ),
    );
  });

  test('clone with primitive value', () => {
    const baseComponent = () =>
      1;

    expect(
      createElement([
        cloneElement,
        [baseComponent],
      ], seedPath),
    ).toEqual(
      createElement(
        [baseComponent],
        seedPath,
      ),
    );
  });

  test('clone with no new changes', () => {
    const baseComponent = () =>
      [A.div, 1, 2];

    expect(
      createElement([
        cloneElement,
        [baseComponent],
      ], seedPath),
    ).toEqual(
      createElement(
        [baseComponent],
        seedPath,
      ),
    );
  });

  test('clone extends original props', () => {
    const baseProps = { foo: 'foo' };
    const newProps = { bar: 'bar' };
    const baseComponent = (props) =>
      [A.div, props, 1, 2];

    expect(
      createElement(
        [cloneElement,
          [baseComponent, baseProps],
          newProps],
        seedPath,
      ),
    ).toEqual(
      createElement(
        [baseComponent,
          { ...baseProps, ...newProps }],
        seedPath,
      ),
    );
  });

  test('clone replaces children with new children', () => {
    const BaseComponent = ({ children }) =>
      [A.div, children];

    expect(
      createElement(
        [cloneElement,
          [BaseComponent, 1, 2],
          3].children,
        seedPath,
      ),
    ).toEqual(
      createElement(
        [BaseComponent, 3]
          .children,
        seedPath,
      ),
    );
  });
});
