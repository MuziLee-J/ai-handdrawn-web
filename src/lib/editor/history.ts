import type { EditorDoc } from './types';
import { cloneDoc } from './operations';

export interface HistoryState {
  past: EditorDoc[];
  present: EditorDoc;
  future: EditorDoc[];
}

export function createHistory(doc: EditorDoc): HistoryState {
  return { past: [], present: cloneDoc(doc), future: [] };
}

export function commit(
  history: HistoryState,
  next: EditorDoc,
  limit = 50,
): HistoryState {
  const past = [...history.past, cloneDoc(history.present)];
  while (past.length > limit) past.shift();
  return { past, present: cloneDoc(next), future: [] };
}

export function undo(history: HistoryState): HistoryState {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: cloneDoc(previous),
    future: [cloneDoc(history.present), ...history.future].slice(0, 50),
  };
}

export function redo(history: HistoryState): HistoryState {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, cloneDoc(history.present)].slice(-50),
    present: cloneDoc(next),
    future: history.future.slice(1),
  };
}

export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}

export function resetHistory(history: HistoryState, doc: EditorDoc): HistoryState {
  return { ...history, present: cloneDoc(doc) };
}
