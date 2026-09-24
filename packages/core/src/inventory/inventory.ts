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

const KIND_ORDER = ['tool', 'seed', 'fertilizer', 'tonic', 'placeable', 'crate', 'material', 'produce', 'forage', 'artisan', 'gem', 'upgrade'];

/** Tidies the backpack (the hotbar stays as the player arranged it): merges stacks, then orders by kind, name and quality. */
/** Moves `qty` of the stack in `from` into `to` (an empty slot or the same item), e.g. splitting a stack in half. */
export function splitStack(inv: Array<ItemStack | null>, from: number, to: number, qty: number): void {
  if (from === to || from < 0 || to < 0 || from >= inv.length || to >= inv.length) return;
  const src = inv[from];
  if (!src || !Number.isInteger(qty) || qty < 1) return;
  const dst = inv[to];
  if (dst && !sameStack(dst, src.id, src.q)) return;
  const max = getItem(src.id).maxStack;
  const n = Math.min(qty, src.qty, max - (dst?.qty ?? 0));
  if (n <= 0) return;
  if (dst) dst.qty += n;
  else inv[to] = { ...src, qty: n };
  src.qty -= n;
  if (src.qty <= 0) inv[from] = null;
}

export function sortBackpack(inv: Array<ItemStack | null>): void {
  const items = inv.slice(HOTBAR_SIZE).filter((s): s is ItemStack => !!s);
  for (let i = HOTBAR_SIZE; i < inv.length; i++) inv[i] = null;
  const merged: ItemStack[] = [];
  for (const s of items) {
    const max = getItem(s.id).maxStack;
    let left = s.qty;
    for (const m of merged) {
      if (!left) break;
      if (sameStack(m, s.id, s.q) && m.water === undefined && m.qty < max) {
        const n = Math.min(left, max - m.qty);
        m.qty += n;
        left -= n;
      }
    }
    if (left) merged.push({ ...s, qty: left });
  }
  const rank = (s: ItemStack) => KIND_ORDER.indexOf(getItem(s.id).kind);
  merged.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id) || (b.q ?? 0) - (a.q ?? 0));
  merged.forEach((s, i) => (inv[HOTBAR_SIZE + i] = s));
}
