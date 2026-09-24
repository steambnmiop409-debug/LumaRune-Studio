import { Pix } from '../Pix';
import { light, shade } from '../palette';

type Icon = () => HTMLCanvasElement;

function done(p: Pix): HTMLCanvasElement {
  p.outline();
  return p.toCanvas();
}

const hoe: Icon = () => {
  const p = new Pix(16, 16);
  p.line(3, 14, 11, 4, '#a8744a');
  p.line(4, 14, 12, 4, '#8a5a3a');
  p.rect(9, 2, 5, 3, '#8a96a8');
  p.rect(12, 2, 2, 5, '#6e7a8c');
  p.set(9, 2, '#c8d0dc');
  return done(p);
};

const can = (tier: number): Icon => () => {
  const metal = tier === 1 ? '#6a9ab8' : tier === 2 ? '#c8804a' : '#c8d0dc';
  const p = new Pix(16, 16);
  p.rect(3, 6, 8, 8, metal);
  p.rect(3, 6, 2, 8, light(metal, 1));
  p.rect(9, 6, 2, 8, shade(metal, 1));
  p.rect(3, 13, 8, 1, shade(metal, 2));
  p.line(11, 9, 14, 5, metal);
  p.line(11, 10, 14, 6, shade(metal, 1));
  p.rect(14, 4, 2, 2, shade(metal, 1));
  p.line(4, 6, 6, 3, '#3a3d52');
  p.line(6, 3, 9, 3, '#3a3d52');
  p.line(9, 3, 10, 6, '#3a3d52');
  return done(p);
};

const scythe: Icon = () => {
  const p = new Pix(16, 16);
  p.line(4, 15, 9, 3, '#a8744a');
  p.line(5, 15, 10, 3, '#8a5a3a');
  for (let i = 0; i < 9; i++) p.set(9 - i * 0.6 + (i > 5 ? -1 : 0), 3 + Math.sin((i / 8) * Math.PI) * 3 - 1, '#c8d0dc');
  p.line(9, 2, 2, 5, '#c8d0dc');
  p.line(9, 3, 3, 6, '#8a96a8');
  return done(p);
};

const sack = (label: string): Icon => () => {
  const p = new Pix(16, 16);
  p.ellipse(8, 10, 5.5, 5, (nx) => (nx < -0.4 ? '#e8d8b0' : nx > 0.5 ? '#b8a478' : '#d8c898'));
  p.rect(6, 3, 4, 3, '#c8b888');
  p.rect(5, 5, 6, 1, '#8a5a3a');
  p.rect(5, 8, 6, 4, label);
  p.rect(5, 8, 6, 1, light(label, 1));
  return done(p);
};

const bottle = (liquid: string): Icon => () => {
  const p = new Pix(16, 16);
  p.rect(6, 1, 4, 3, '#8a5a3a');
  p.rect(6, 4, 4, 2, '#cfe8f0');
  p.ellipse(8, 10, 4.5, 5, (nx, ny) => (ny < -0.4 ? '#e8f4f8' : nx < -0.4 ? light(liquid, 1) : liquid));
  p.set(6, 8, '#ffffff');
  p.rect(6, 10, 4, 2, '#f4ecd8');
  return done(p);
};

const cover: Icon = () => {
  const p = new Pix(16, 16);
  p.rect(1, 3, 14, 5, '#e8eef4');
  p.rect(1, 3, 14, 1, '#ffffff');
  p.rect(1, 7, 14, 1, '#b8c0cc');
  p.rect(2, 8, 1, 7, '#8a8f9e');
  p.rect(13, 8, 1, 7, '#8a8f9e');
  for (let x = 4; x < 12; x += 3) p.set(x, 10 + (x % 2), '#6ab0d8');
  return done(p);
};

const crateIcon: Icon = () => {
  const p = new Pix(16, 16);
  const wood = '#c8955a';
  p.rect(2, 4, 12, 10, wood);
  p.rect(2, 4, 12, 1, light(wood, 1));
  p.rect(2, 8, 12, 1, shade(wood, 1));
  p.rect(2, 13, 12, 1, shade(wood, 2));
  p.line(3, 5, 12, 12, shade(wood, 1));
  return done(p);
};

const cart: Icon = () => {
  const p = new Pix(16, 16);
  p.rect(2, 5, 11, 6, '#b07a4a');
  p.rect(2, 5, 11, 1, '#d09a6a');
  p.line(12, 6, 15, 3, '#6e4a34');
  p.ellipse(5, 12, 2.5, 2.5, '#3a3d52');
  p.ellipse(10, 12, 2.5, 2.5, '#3a3d52');
  p.set(5, 12, '#c8c0b4');
  p.set(10, 12, '#c8c0b4');
  return done(p);
};

export const ITEM_ICONS: Record<string, Icon> = {
  'tool.hoe': hoe,
  'tool.can.1': can(1),
  'tool.can.2': can(2),
  'tool.can.3': can(3),
  'tool.scythe': scythe,
  'fert.basic': sack('#c8a060'),
  'fert.quality': sack('#e8b830'),
  'fert.speed': sack('#7ac05a'),
  'fert.speed2': sack('#3fa060'),
  'fert.retain': sack('#5a8ab8'),
  tonic: bottle('#6ad08a'),
  'place.cover': cover,
  crate: crateIcon,
  'upgrade.cart': cart,
};
