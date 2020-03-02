import {
  nativeElements as A,
  cloneElement,
  createElement,
} from '../internal/auto-dom';

describe('cloneElement', () => {
  test('clone with null value', () => {
    const Null = () =>
      null;
    const element = createElement([Null], 'abc');

    expect(() => {
      cloneElement(element);
    }).toThrow();
  });

  test('clone with primitive value', () => {
    const Primitive = () =>
      1;
    const element = createElement([Primitive], 'abc');

    expect(() => {
      cloneElement(element);
    }).toThrow();
  });

  test('clone with no new changes', () => {
    const LazyComponent = [A.div, 1, 2];
    const element = createElement(LazyComponent, 'abc');

    expect(
      cloneElement(element),
    ).toEqual(
      createElement(LazyComponent, 'abc'),
    );
  });

  test('clone extends original props', () => {
    const baseProps = { foo: 'foo' };
    const newProps = { bar: 'bar' };
    const element = createElement(
      [A.div, baseProps, 1, 2], 'abc',
    );

    expect(
      cloneElement(element, newProps),
    ).toEqual(
      createElement(
        [A.div,
          { ...baseProps, ...newProps }, 1, 2],
        'abc',
      ),
    );
  });

  test('clone replaces children with new children', () => {
    const element = createElement(
      [A.div, 1, 2],
      'abc',
    );

    expect(
      cloneElement(element, null, 3),
    ).toEqual(
      createElement(
        [A.div, 3],
        'abc',
      ),
    );
  });
});
