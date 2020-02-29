import {
  nativeElements as A,
  cloneElement,
  createElement,
} from '../internal/auto-dom';

describe('cloneElement', () => {
  test('clone with null value', () => {
    const Null = () =>
      null;
    const element = [Null];

    expect(
      cloneElement(element),
    ).toEqual(null);
  });

  test('clone with primitive value', () => {
    const Primitive = () =>
      1;
    const element = [Primitive];

    expect(
      cloneElement(element),
    ).toEqual(1);
  });

  test('clone with no new changes', () => {
    const element = [A.div, 1, 2];

    expect(
      cloneElement(element),
    ).toEqual(
      createElement(element),
    );
  });

  test('clone extends original props', () => {
    const baseProps = { foo: 'foo' };
    const newProps = { bar: 'bar' };
    const Component = ({ foo, children }) =>
      [A.div, foo, children];

    expect(
      cloneElement([Component, baseProps, 1, 2], newProps)
        .children,
    ).toEqual(
      createElement(
        [Component,
          { ...baseProps,
            ...newProps },
          1, 2],
      ).children,
    );
  });

  test('clone replaces children new children', () => {
    const baseProps = { foo: 'foo' };
    const Component = ({ foo, children }) =>
      [A.div, foo, children];
    const result = cloneElement([Component, baseProps, 1, 2], null, 3)
      .children;
    const expected = createElement(
      [A.div, 3],
    ).children;

    expect(
      result,
    ).toEqual(
      expected,
    );
  });
});
