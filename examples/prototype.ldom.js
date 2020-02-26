import classnames from 'classnames';
import * as evs from '../src';

const {
  autoDom,
  createElement,
} = require('../src/internal/auto-dom');

const AddTodo = (data) =>
  ({
    type: 'AddTodo',
    data,
  });

const TodosList = ({ items }) =>
  [ul, items.map((text) =>
    [li, text])];

const TodoForm = () =>
  [form,
    [input, {
      type: 'text',
      placeholder: 'my todo',
    }],
    [button, { onClick: AddTodo, type: 'button' },
      'add todo']];

const TodoApp = ({ todos }) =>
  [div,
    [h1, 'Todos'],
    [TodoForm],
    [TodosList, { items: todos }]];

function SetName(name) {
  return {
    type: 'SetName',
    name,
  };
}

const NameInput = ({ name, scope }) =>
  [label,
    'Name: ',
    [input, {
      value: name,
      class: classnames(['foo', 'bar']),
      onInput: scope.call(
        SetName,
        evs.InputValue,
      ),
    }]];

const map = (
  items,
  project = (v) =>
    v,
) =>
  [items, project];

const numbers = [3, 4, 5];
const BoldNum = (num) =>
  [strong, { style: 'background: green;' }, num];

const BoldNumbers = () =>
  map(numbers, BoldNum);

const Greeting = ({ name }, children) =>
  [h1, 'Hello ', name, children];

const Hello = ({ name, scope }) =>
  [div,
    [NameInput, { name, scope }],
    [Greeting, { name }],
    [BoldNumbers],
    [BoldNumbers]];

export {
  TodoApp,
  Hello,
  createElement,
  autoDom,
};
