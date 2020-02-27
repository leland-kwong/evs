/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
Object.defineProperty(exports, '__esModule', { value: true });

function updateProps(oldVnode, vnode) {
  let key; let cur; const { elm } = vnode; const
    { props } = vnode.data;

  for (key in props) {
    cur = props[key];
    elm[key] = cur;
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
function forceFormInputImmutable() {
  if (immutableFormInputInitialized) return;

  document.addEventListener('input', (ev) => {
    const { target } = ev;
    const checkChanges = () => {
      const inputType = target.getAttribute('type');

      switch (inputType) {
      case 'text': {
        const attrValue = target.getAttribute('value');
        const wasChangedExternally = !equal(
          target.value,
          attrValue,
        );

        if (wasChangedExternally) {
          if (!hasEvsEvent(target)) {
            console.warn(outdent`
              [evs text input]
              Did we forget to add an \`input\` handler?
              Evs forces input controls to always be a
              representation of the render. This is done
              to make our code easier to reason about.`);
          }
          target.value = attrValue;
        }
        break;
      }
      case 'checkbox': {
        const attrChecked = equal(
          target.getAttribute('checked'),
          '',
        );
        const wasChangedExternally = !equal(
          target.checked,
          attrChecked,
        );

        if (wasChangedExternally) {
          if (!hasEvsEvent(target)) {
            console.warn(outdent`
              [evs checkbox]
              Did we forget to add a \`change\` handler?
              Evs forces input controls to always be a
              representation of the render. This is done
              to make our code easier to reason about.`);
          }
          target.checked = attrChecked;
        }
        break;
      }
      default:
        break;
      }
    };
  });
}

exports.propsModule = { create: updateProps, update: updateProps };
exports.default = exports.propsModule;
