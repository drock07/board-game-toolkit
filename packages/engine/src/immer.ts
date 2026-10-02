import { enablePatches, Immer } from "immer";

enablePatches();

/**
 * The engine's own immer instance. Auto-freeze is off: freezing every
 * committed state costs more than the transaction itself, and the engine
 * never mutates a state it has returned. Treat states as immutable.
 */
const immer = new Immer({ autoFreeze: false });

export const createDraft = immer.createDraft.bind(immer);
export const finishDraft = immer.finishDraft.bind(immer);
export const applyPatches = immer.applyPatches.bind(immer);
