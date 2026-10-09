import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCaptureBudget } from '../src/collect/capture-budget.js';

test('capture budget follows the lower physical memory or disk resource', () => {
  assert.equal(calculateCaptureBudget({ availableMemoryBytes: 1_000, availableDiskBytes: 10_000 }), 220);
  assert.equal(calculateCaptureBudget({ availableMemoryBytes: 10_000, availableDiskBytes: 1_000 }), 450);
});

test('large capture uses a larger adaptive budget but still reserves system headroom', () => {
  const regular = calculateCaptureBudget({ availableMemoryBytes: 10_000_000, availableDiskBytes: 20_000_000 });
  const large = calculateCaptureBudget({ availableMemoryBytes: 10_000_000, availableDiskBytes: 20_000_000, largeCapture: true });
  assert.ok(large > regular);
  assert.ok(large < 10_000_000);
});

test('unknown disk capacity falls back to memory and invalid memory fails closed', () => {
  assert.equal(calculateCaptureBudget({ availableMemoryBytes: 1_000 }), 220);
  assert.equal(calculateCaptureBudget({ availableMemoryBytes: 0, availableDiskBytes: 1_000 }), 0);
  assert.equal(calculateCaptureBudget({ availableMemoryBytes: 1_000, availableDiskBytes: 0 }), 0);
});
