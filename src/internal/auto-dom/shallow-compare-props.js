const propsToIgnoreForCheck = new Set([
  // children are diff'd separately
  'children',
]);

export const shallowCompare = (oldProps, newProps) => {
  const { children: oldCh = [] } = oldProps;
  const { children = [] } = newProps;

  const hasNewChildren = children.length !== oldCh.length
    || Boolean(
      children.length > 0
        && children.find((v, i) =>
          v !== oldCh[i]),
    );
  let hasChanges = hasNewChildren;

  // eslint-disable-next-line no-restricted-syntax
  for (const key in newProps) {
    if (propsToIgnoreForCheck.has(key)) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const hasChanged = oldProps[key]
      !== newProps[key];
    if (hasChanged) {
      hasChanges = true;
      break;
    }
  }

  return hasChanges;
};
