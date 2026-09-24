/// <reference lib="webworker" />
/**
 * Paints terrain chunks off the main thread and hands them back as image bitmaps,
 * so walking into new ground never stalls a frame.
 */
import type { WorldMap } from '@lumina/core';
import { TerrainBuilder } from './TerrainRenderer';

let builder: TerrainBuilder | null = null;

type In = { t: 'init'; map: WorldMap } | { t: 'build'; key: number; cx: number; cy: number; season: number };

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data;
  if (m.t === 'init') {
    builder = new TerrainBuilder(m.map);
    return;
  }
  if (!builder) return;
  builder.setSeason(m.season);
  const px = builder.build(m.cx, m.cy);
  const bmp = (img: ImageData) => createImageBitmap(img);
  const base = await bmp(px.base);
  const foam = px.foam ? await Promise.all(px.foam.map(bmp)) : null;
  const falls = px.falls ? await Promise.all(px.falls.map(bmp)) : null;
  const transfer: Transferable[] = [base, ...(foam ?? []), ...(falls ?? [])];
  (self as unknown as DedicatedWorkerGlobalScope).postMessage({ key: m.key, base, foam, falls }, transfer);
};
