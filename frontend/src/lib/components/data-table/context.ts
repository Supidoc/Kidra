import { createContext } from 'svelte';
import type { TableEditContext } from './edit-state.svelte.ts';

/** Gives editable cells the edit state of the table they are rendered in. */
export const [getTableEditContext, setTableEditContext] = createContext<TableEditContext>();
