import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { audioState, setMasterVolume } from '../../src/lib/stores/audio.svelte';

let originalWindow: any;
let originalLocalStorage: any;
let setItemCalls: [string, string][] = [];
let removeItemCalls: string[] = [];

describe('audio.svelte stores - setMasterVolume', () => {
  beforeEach(() => {
    originalWindow = (global as any).window;
    originalLocalStorage = (global as any).localStorage;

    setItemCalls = [];
    removeItemCalls = [];

    const mockLocalStorage = {
      getItem: () => null,
      setItem: (key: string, value: string) => {
        setItemCalls.push([key, value]);
      },
      removeItem: (key: string) => {
        removeItemCalls.push(key);
      }
    };

    (global as any).window = {
      localStorage: mockLocalStorage
    };
    (global as any).localStorage = mockLocalStorage;

    audioState.masterVolume = 1;
  });

  afterEach(() => {
    if (originalWindow !== undefined) {
      (global as any).window = originalWindow;
    } else {
      delete (global as any).window;
    }

    if (originalLocalStorage !== undefined) {
      (global as any).localStorage = originalLocalStorage;
    } else {
      delete (global as any).localStorage;
    }
  });

  test('updates audioState.masterVolume correctly', () => {
    setMasterVolume(0.5);
    assert.strictEqual(audioState.masterVolume, 0.5);
  });

  test('saves volume to localStorage with correct key', () => {
    setMasterVolume(0.8);
    assert.strictEqual(setItemCalls.length, 1);
    assert.strictEqual(setItemCalls[0][0], 'audio_master_volume');
    assert.strictEqual(setItemCalls[0][1], '0.8');
    assert.strictEqual(removeItemCalls.length, 0);
  });

  test('handles boundary value 0 correctly', () => {
    setMasterVolume(0);
    assert.strictEqual(audioState.masterVolume, 0);
    assert.strictEqual(setItemCalls.length, 1);
    assert.strictEqual(setItemCalls[0][0], 'audio_master_volume');
    assert.strictEqual(setItemCalls[0][1], '0'); // Should save "0" string
    assert.strictEqual(removeItemCalls.length, 0);
  });

  test('handles boundary value 1 correctly', () => {
    setMasterVolume(1);
    assert.strictEqual(audioState.masterVolume, 1);
    assert.strictEqual(setItemCalls.length, 1);
    assert.strictEqual(setItemCalls[0][1], '1');
  });

  test('does not throw and updates state when localStorage is unavailable', () => {
    delete (global as any).localStorage;
    (global as any).window = {};

    assert.doesNotThrow(() => {
      setMasterVolume(0.3);
    });

    assert.strictEqual(audioState.masterVolume, 0.3);
    assert.strictEqual(setItemCalls.length, 0);
  });

  test('does not throw and updates state when window is undefined', () => {
    delete (global as any).window;
    delete (global as any).localStorage;

    assert.doesNotThrow(() => {
      setMasterVolume(0.7);
    });

    assert.strictEqual(audioState.masterVolume, 0.7);
    assert.strictEqual(setItemCalls.length, 0);
  });
});
