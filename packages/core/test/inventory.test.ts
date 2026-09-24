import { describe, expect, it } from 'vitest';
import { addItem, countItem, emptyInventory, removeItem, swapSlots } from '../src';

describe('inventory', () => {
  it('stacks by item and quality', () => {
    const inv = emptyInventory();
    addItem(inv, 'crop.tomato', 5, 1);
    addItem(inv, 'crop.tomato', 3, 1);
    addItem(inv, 'crop.tomato', 2, 5);
    expect(inv.filter(Boolean).length).toBe(2);
    expect(countItem(inv, 'crop.tomato')).toBe(10);
    expect(countItem(inv, 'crop.tomato', 5)).toBe(2);
  });

  it('respects max stack and reports overflow', () => {
    const inv = emptyInventory();
    const left = addItem(inv, 'seed.radish', 99 * 30 + 7);
    expect(left).toBe(7);
  });

  it('removes across stacks and merges on swap', () => {
    const inv = emptyInventory();
    addItem(inv, 'crate', 99);
    addItem(inv, 'crate', 10);
    expect(removeItem(inv, 'crate', 100)).toBe(true);
    expect(countItem(inv, 'crate')).toBe(9);
    inv[5] = { id: 'crate', qty: 3 };
    const first = inv.findIndex((s) => s?.id === 'crate');
    swapSlots(inv, 5, first);
    expect(countItem(inv, 'crate')).toBe(12);
  });
});
