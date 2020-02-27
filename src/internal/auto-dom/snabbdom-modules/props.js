/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
Object.defineProperty(exports, '__esModule', { value: true });

const hookType = require('./hook-type');

const emptyObject = Object.freeze({});

function updateProps(hook, oldVnode, vnode) {
  let key; const { elm } = vnode;
  const { props: oldProps = emptyObject } = oldVnode;
  const { props } = vnode;
  const { handleProp } = vnode.data;
  const hookFn = props[hook];

  if (hookFn) {
    hookFn(vnode);
  }

  for (key in props) {
    const prev = oldProps[key];
    const cur = props[key];
    const customFn = handleProp[key];

    if (customFn) {
      customFn(prev, cur, vnode);
    } else {
      elm[key] = cur;
    }
  }
}

/*
 * TODO:
 * This needs fixing because its not reliable right
 * now. What we should probably do is check if it
 * has the appropriate event handler to allow for that
 * change and if it is missing it we throw the warning.
 */

/*
 * Forces the form input's dom property to always
 * reflect whatever the value of the props has. If it
 * is missing a change handler, that means it should
 * never change.
 */
// function forceFormInputImmutable() {
//   if (immutableFormInputInitialized) return;

//   document.addEventListener('input', (ev) => {
//     const { target } = ev;
//     const checkChanges = () => {
//       const inputType = target.getAttribute('type');

//       switch (inputType) {
//       case 'text': {
//         const attrValue = target.getAttribute('value');
//         const wasChangedExternally = !equal(
//           target.value,
//           attrValue,
//         );

//         if (wasChangedExternally) {
//           if (!hasEvsEvent(target)) {
//             console.warn(outdent`
//               [evs text input]
//               Did we forget to add an \`input\` handler?
//               Evs forces input controls to always be a
//               representation of the render. This is done
//               to make our code easier to reason about.`);
//           }
//           target.value = attrValue;
//         }
//         break;
//       }
//       case 'checkbox': {
//         const attrChecked = equal(
//           target.getAttribute('checked'),
//           '',
//         );
//         const wasChangedExternally = !equal(
//           target.checked,
//           attrChecked,
//         );

//         if (wasChangedExternally) {
//           if (!hasEvsEvent(target)) {
//             console.warn(outdent`
//               [evs checkbox]
//               Did we forget to add a \`change\` handler?
//               Evs forces input controls to always be a
//               representation of the render. This is done
//               to make our code easier to reason about.`);
//           }
//           target.checked = attrChecked;
//         }
//         break;
//       }
//       default:
//         break;
//       }
//     };
//   });
// }

exports.propsModule = {
  create: (oldVnode, vnode) => {
    updateProps(hookType.create, oldVnode, vnode);
  },
  update: (oldVnode, vnode) => {
    updateProps(hookType.update, oldVnode, vnode);
  },
};
exports.default = exports.propsModule;
