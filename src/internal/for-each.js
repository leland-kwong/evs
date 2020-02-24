export function forEach(collection, callback, arg) {
  let i = 0;
  while (i < collection.length) {
    callback(collection[i], arg);
    i += 1;
  }
}
