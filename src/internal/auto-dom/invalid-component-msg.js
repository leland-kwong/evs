import outdent from 'outdent';
import { stringifyValueForLogging } from '../utils';

export const invalidComponentMsg = (value) => {
  const stringified = stringifyValueForLogging(value);

  return outdent`
    Sorry,

    ${stringified.length > 300
      ? `${stringified.slice(0, 300)} ...`
      : stringified}

    is not a valid component. This can happen when
    we either nested the arrays too deeply or forgot to
    wrap a component in an array.

    The supported formats are:

    \`\`\`javascript

    // basic component
    [Function, value1, value2, ...]

    // component with props
    [Function, Object, value1, value2, ...]

    // collection of nodes
    [value1, value2, ...]

    // nested collections also work
    [
      [value1, value2],
      value3,
      [value4, value5]
    ]

    \`\`\`
  `;
};
