import { last } from './utils';
import { defineElement } from './define-element';

const Comment = defineElement('!');

const fragmentRootNode = (
  [Comment,
    { text: 'FragmentRoot' },
  ]);

export const isFragmentRootNode = (value) =>
  value === fragmentRootNode;

export const getFragmentNodeFromFragment = (
  fragment,
) =>
  last(fragment);

export const Fragment = ({ children }) =>
  [
    children,
    /**
     * This is used as a stable *hook* node. We need this
     * because currently hooks for fragment components are
     * accumulated on the first vnode. This way, the fragment
     * children can change but will not trigger an init/destroy
     * hook event due to these changes.
     */
    fragmentRootNode,
  ];
