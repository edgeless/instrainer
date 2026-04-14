// @ts-nocheck
import { mock } from "bun:test";
mock.module("$app/environment", () => ({ browser: false }));
mock.module("$lib/utils/songs", () => ({
  SONGS: { c_major: { name: 'Test', bpm: 80, notes: [] } }
}));
globalThis.$state = ((initialValue: any) => initialValue) as any;
globalThis.$derived = ((fn: any) => fn) as any;
globalThis.$effect = ((fn: any) => {}) as any;
