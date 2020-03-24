import {
  pathSeparator,
} from '../constants';

const vTreeCache = new Map();
const setVtree = (pathRoot, vtree) => {
  vTreeCache.set(pathRoot, vtree);
};
const getVtree = (refId) => {
  const pathRoot = refId.slice(0, refId.indexOf(pathSeparator));

  return vTreeCache.get(pathRoot);
};

export {
  setVtree,
  getVtree,
};
