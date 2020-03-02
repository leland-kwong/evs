/*
* NOTE:
* The css function is slow, so we should not call
* it in the render functions of our components.
*/
import { css } from 'emotion';

export const capitalize = css`text-transform: capitalize;`;

export const bold = css`font-weight: bold;`;

export const Section = css`
  margin: 1rem 0;
  margin-right: 1rem;
`;
