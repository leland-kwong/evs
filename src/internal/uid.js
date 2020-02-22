export const uid = (() => {
  let id = 0;

  return function generateId() {
    id += 1;
    return id;
  };
})();
