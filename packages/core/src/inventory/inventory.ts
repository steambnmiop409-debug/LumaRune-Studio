import { CAN_CAPACITY, getItem } from '../data/items';
import type { ItemStack } from '../state/types';

export const INVENTORY_SIZE = 30;
export const HOTBAR_SIZE = 10;

export function emptyInventory(): Array<ItemStack | null> {
  return Array.from({ length: INVENTORY_SIZE }, () => null);
}

export function sameStack(a: ItemStack, id: string, q?: number): boolean {
  return a.id === id && (a.q ?? 0) === (q ?? 0);
}

export function makeStack(id: string, qty: number, q?: number): ItemStack {
  const def = getItem(id);
  const s: ItemStack = { id, qty };
  if (q) s.q = q;
  if (def.tool === 'can') s.water = CAN_CAPACITY[def.tier ?? 1];
  return s;
}

/** Adds items, filling existing stacks first. Returns the quantity that did not fit. */
export function addItem(inv: Array<ItemStack | null>, id: string, qty: number, q?: number): number {
  const max = getItem(id).maxStack;
  let left = qty;
  for (const s of inv) {
    if (!left) break;
    if (s && sameStack(s, id, q) && s.qty < max) {
      const n = Math.min(left, max - s.qty);
      s.qty += n;
      left -= n;
    }
  }
  for (let i = 0; i < inv.length && left; i++) {
    if (!inv[i]) {
      const n = Math.min(left, max);
      inv[i] = makeStack(id, n, q);
      left -= n;
    }
  }
  return left;
}

/** How many of `qty` would fit without changing the inventory. */
export function canFit(inv: Array<ItemStack | null>, id: string, qty: number, q?: number): boolean {
  const max = getItem(id).maxStack;
  let room = 0;
  for (const s of inv) {
    if (!s) room += max;
    else if (sameStack(s, id, q)) room += max - s.qty;
    if (room >= qty) return true;
  }
  return room >= qty;
}

export function countItem(inv: Array<ItemStack | null>, id: string, q?: number): number {
  let n = 0;
  for (const s of inv) if (s && s.id === id && (q === undefined || (s.q ?? 0) === q)) n += s.qty;
  return n;
}

/** Removes `qty` from a specific slot. Returns false if not enough. */
export function takeFromSlot(inv: Array<ItemStack | null>, slot: number, qty: number): boolean {
  const s = inv[slot];
  if (!s || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty <= 0) inv[slot] = null;
  return true;
}

export function removeItem(inv: Array<ItemStack | null>, id: string, qty: number): boolean {
  if (countItem(inv, id) < qty) return false;
  let left = qty;
  for (let i = 0; i < inv.length && left; i++) {
    const s = inv[i];
    if (s && s.id === id) {
      const n = Math.min(left, s.qty);
      s.qty -= n;
      left -= n;
      if (s.qty <= 0) inv[i] = null;
    }
  }
  return true;
}

export function swapSlots(inv: Array<ItemStack | null>, a: number, b: number): void {
  if (a === b || a < 0 || b < 0 || a >= inv.length || b >= inv.length) return;
  const sa = inv[a];
  const sb = inv[b];
  // Merge identical stacks.
  if (sa && sb && sameStack(sb, sa.id, sa.q)) {
    const max = getItem(sa.id).maxStack;
    const n = Math.min(sa.qty, max - sb.qty);
    sb.qty += n;
    sa.qty -= n;
    if (sa.qty <= 0) inv[a] = null;
    return;
  }
  inv[a] = sb;
  inv[b] = sa;
}
