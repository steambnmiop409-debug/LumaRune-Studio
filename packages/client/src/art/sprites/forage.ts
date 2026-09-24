import { Pix } from '../Pix';
import { pack } from '../palette';

/**
 * Hand-placed 16×16 forage icons. Each one is its own drawing (no shared base),
 * outlined with a darker hue of its own colour rather than flat black.
 */
const ICONS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  'forage.shell': {
    rows: [
      '................',
      '................',
      '......oooo......',
      '....oohhhhoo....',
      '...ohhlhhlhho...',
      '..ohlhmlhmlhlo..',
      '..ohlmmlmmlmlo..',
      '.ohlmmlmmlmmlho.',
      '.ohlmmlmmlmmlmo.',
      '.odlmmlmmlmmldo.',
      '..odlmlmmlmldo..',
      '...oddlddlddo...',
      '....oobbbboo....',
      '.....obbbbo.....',
      '......oooo......',
      '................',
    ],
    pal: { o: '#8a4a3a', h: '#fff4ea', l: '#e8a890', m: '#f8d6c4', d: '#c87a66', b: '#e89a86' },
  },
  'forage.seaglass': {
    rows: [
      '................',
      '................',
      '.......oo.......',
      '.....oohhoo.....',
      '....ohhwhhmo....',
      '...ohwhhmmmmo...',
      '..ohhhmmmmmmmo..',
      '..ohmmmmmmmdmo..',
      '.ohmmmmmmmmddo..',
      '.ommmmmmmddddo..',
      '..odmmmmdddddo..',
      '...odddddddoo...',
      '....ooodddo.....',
      '.......ooo......',
      '................',
      '................',
    ],
    pal: { o: '#2a6a62', h: '#c8f4e4', w: '#ffffff', m: '#7ad0b8', d: '#4aa894' },
  },
  'forage.driftwood': {
    rows: [
      '................',
      '................',
      '................',
      '...........oo...',
      '..........ohlo..',
      '.oo......ohlmo..',
      'ohloooooohlmmo..',
      'ohllllhllllmdo..',
      '.ommkmmmmkmmdo..',
      '.odmmmddmmmddo..',
      '..oddddooddddo..',
      '...oooo..oddo...',
      '..........oo....',
      '................',
      '................',
      '................',
    ],
    pal: { o: '#5a4a3e', h: '#f0e6d6', l: '#d8cab4', m: '#b8a68e', d: '#8e7c66', k: '#6e5e4c' },
  },
  'forage.chanterelle': {
    rows: [
      '................',
      '................',
      '...oooooooooo...',
      '..ohhhlhhhlhho..',
      '.ohlllmlllmllmo.',
      '.odmmmdmmmdmmdo.',
      '..odddgdgdgddo..',
      '...oogsgsgsoo...',
      '.....osssso.....',
      '.....osssso.....',
      '......ossdo.....',
      '......osso......',
      '.....ossddo.....',
      '....oddddddo....',
      '.....oooooo.....',
      '................',
    ],
    pal: { o: '#8a4a10', h: '#fff0a0', l: '#f8c848', m: '#e8a430', d: '#c07a1c', g: '#a86014', s: '#f4c860' },
  },
  'forage.morel': {
    rows: [
      '................',
      '......oooo......',
      '.....ohdhmo.....',
      '....ohdhmdmo....',
      '....odhmdhdo....',
      '...ohmdhdmdmo...',
      '...odhdmdhmdo...',
      '...ohmdhdmdmo...',
      '...odhmdhdmdo...',
      '....odmdmddo....',
      '.....ossslo.....',
      '.....osssso.....',
      '.....ossslo.....',
      '....ossssslo....',
      '.....oooooo.....',
      '................',
    ],
    pal: { o: '#3e2a1c', h: '#c8a070', m: '#9a7048', d: '#5e4028', s: '#f0e4c8', l: '#c8b890' },
  },
  'forage.pinecone': {
    rows: [
      '.......oo.......',
      '.......go.......',
      '.....oooooo.....',
      '....ohmohmmo....',
      '...ohmdohmdmo...',
      '...odoohmoodo...',
      '...ohmohmdhmo...',
      '..ohmdohmdomdo..',
      '..odoohmdooodo..',
      '...ohmohmdhmo...',
      '...odoohmoodo...',
      '....ohmdhmdo....',
      '....odoohodo....',
      '.....ohmdmo.....',
      '......oooo......',
      '................',
    ],
    pal: { o: '#3a2418', g: '#5a7a3a', h: '#d8a068', m: '#a86e3e', d: '#7a4a28' },
  },
  'forage.wildflower': {
    rows: [
      '................',
      '..oo.......oo...',
      '.opho.....oyyo..',
      '.opcpo...oycyo..',
      '..opo.....oyo...',
      '...ogo.oo..go...',
      '....go.owo.g....',
      '....gooowcoo....',
      '.....g.owowo....',
      '..oo..g.oog.....',
      '.olfo..g.g......',
      '.ofclo.gg.......',
      '..olo..g........',
      '...lgggnggg.....',
      '....nnnnnnn.....',
      '................',
    ],
    pal: { o: '#5a3a6a', p: '#e888c8', h: '#ffd0ec', c: '#ffd860', y: '#f8e070', w: '#ffffff', l: '#a8b8f8', f: '#d8e0ff', g: '#5aa050', n: '#3e7a3a' },
  },
  'forage.wildberry': {
    rows: [
      '................',
      '.........gg.....',
      '........gllg....',
      '.......glllg....',
      '......n.gggn....',
      '.....n.....n....',
      '...oon....oon...',
      '..orhro..orhro..',
      '..ormro..ormro..',
      '...oro.oo.oro...',
      '....o.orhro.o...',
      '......ormmro....',
      '......ormmro....',
      '.......odro.....',
      '........oo......',
      '................',
    ],
    pal: { o: '#3a1030', r: '#b82a58', h: '#ff9ab8', m: '#8a1a44', d: '#6a1234', g: '#3e7a3a', l: '#7ac060', n: '#6a4a2a' },
  },
};

Object.assign(ICONS, {
  'forage.apple': {
    rows: [
      '................',
      '.........ll.....',
      '.......n.lgl....',
      '.......n..ll....',
      '....oooonooo....',
      '...ohhrrnrrro...',
      '..ohwhrrrrrrdo..',
      '..ohhrrrrrrrdo..',
      '..orrrrrrrrrdo..',
      '..orrrrrrrrddo..',
      '..ordrrrrrrddo..',
      '...orddrrdddo...',
      '...oorddddoo....',
      '.....oooooo.....',
      '................',
      '................',
    ],
    pal: { o: '#5a1418', h: '#ff9a80', w: '#fff0e8', r: '#d8403a', d: '#a02a28', n: '#6a4a2a', l: '#7ac060', g: '#4a8a3a' },
  },
  'forage.peach': {
    rows: [
      '................',
      '..........ll....',
      '........nlggl...',
      '........n.ll....',
      '....oooonoooo...',
      '...ohhhpnpppo...',
      '..ohwhhppppcpo..',
      '..ohhpppppcppo..',
      '..opppppppcppdo.',
      '..opppppppcpddo.',
      '..oppppppcppddo.',
      '...opppppcpddo..',
      '....ooppdddoo...',
      '......ooooo.....',
      '................',
      '................',
    ],
    pal: { o: '#7a3020', h: '#ffe0b8', w: '#fff8ec', p: '#f0a050', c: '#e07a48', d: '#d06a40', n: '#6a4a2a', l: '#7ac060', g: '#4a8a3a' },
  },
  'forage.pear': {
    rows: [
      '.........n......',
      '........n.ll....',
      '.......oonglg...',
      '......ohyyo.....',
      '......ohyyo.....',
      '.....ohyyyyo....',
      '....ohyyyyydo...',
      '...ohwyyyyyydo..',
      '...ohyyyyyyydo..',
      '..ohyyyyyyyyddo.',
      '..oyyyyysyyyddo.',
      '..oyyyyyyyydddo.',
      '...oyyyyyydddo..',
      '....ooddddooo...',
      '......oooo......',
      '................',
    ],
    pal: { o: '#4a5010', h: '#f8f8c0', w: '#ffffff', y: '#d0d850', d: '#a0a83a', s: '#8a7a3a', n: '#6a4a2a', l: '#7ac060', g: '#4a8a3a' },
  },
  'forage.plum': {
    rows: [
      '................',
      '................',
      '.........n......',
      '........n..ll...',
      '.....ooonolgl...',
      '....ohhmnmmoo...',
      '...ohwhmmmmmdo..',
      '...ohmmmmmmmdo..',
      '...ommmmsmmmdo..',
      '...ommmmsmmddo..',
      '...ommmsmmmddo..',
      '....ommsmmddo...',
      '.....oodddoo....',
      '.......ooo......',
      '................',
      '................',
    ],
    pal: { o: '#2a1030', h: '#d8a0d0', w: '#f8e8f8', m: '#8a3a78', s: '#6a2a5a', d: '#5a2050', n: '#6a4a2a', l: '#7ac060', g: '#4a8a3a' },
  },
});

export function forageIcon(id: string): HTMLCanvasElement | null {
  const def = ICONS[id];
  if (!def) return null;
  const p = new Pix(16, 16);
  p.template(def.rows, def.pal);
  return p.toCanvas();
}

/** The world version sits a little lower and gets a soft ground shadow. */
export function forageGround(id: string): HTMLCanvasElement | null {
  const def = ICONS[id];
  if (!def) return null;
  const p = new Pix(16, 18);
  p.rect(4, 16, 8, 1, pack('#1a1a30', 70));
  p.rect(5, 17, 6, 1, pack('#1a1a30', 45));
  p.template(def.rows, def.pal, 0, 2);
  return p.toCanvas();
}

/** The plaza notice board: shingled roof, cork face, pinned notes. `fresh` adds today's request. */
export function noticeBoard(fresh: boolean): HTMLCanvasElement {
  const p = new Pix(22, 30);
  const wood = '#8a5a3a';
  const woodL = '#b07a4e';
  const woodD = '#5a3a26';
  const ink = '#3a2418';
  // Posts.
  for (const x of [3, 17]) {
    p.rect(x, 12, 2, 18, wood);
    p.rect(x, 12, 1, 18, woodL);
    p.set(x + 1, 29, woodD);
    p.set(x, 29, woodD);
  }
  // Roof: two rows of shingles with a ridge.
  for (let y = 0; y < 6; y++) {
    const inset = Math.max(0, 3 - y);
    for (let x = inset; x < 22 - inset; x++) {
      const edge = x === inset || x === 21 - inset || y === 0;
      p.set(x, y + 1, edge ? ink : y < 2 ? '#c8604a' : (x + (y > 3 ? 2 : 0)) % 4 === 0 ? '#8a3a2e' : y % 3 === 2 ? '#a84a3a' : '#b8563f');
    }
  }
  p.rect(0, 7, 22, 1, ink);
  p.rect(1, 6, 20, 1, '#8a3a2e');
  // Cork board.
  p.rect(1, 8, 20, 14, ink);
  p.rect(2, 9, 18, 12, '#c89a62');
  for (let i = 0; i < 20; i++) p.set(2 + ((i * 7) % 18), 9 + ((i * 5) % 12), '#b08452');
  p.rect(2, 9, 18, 1, '#dcb07a');
  // Old notes.
  p.rect(3, 11, 5, 6, '#e8e0cc');
  p.rect(4, 13, 3, 1, '#9a9488');
  p.rect(4, 15, 2, 1, '#9a9488');
  p.set(5, 11, '#4f7ab0');
  p.rect(13, 12, 5, 5, '#f0d8a0');
  p.rect(14, 14, 3, 1, '#a89060');
  p.set(15, 12, '#5a9a6a');
  if (fresh) {
    // Today's request: bright paper with a red pin and a little crop sketch.
    p.rect(8, 10, 6, 8, '#fffaf0');
    p.rect(8, 17, 6, 1, '#e0d6c0');
    p.set(10, 10, '#e05a4a');
    p.set(11, 10, '#e05a4a');
    p.rect(9, 12, 4, 1, '#6a6a7a');
    p.rect(9, 14, 3, 1, '#6a6a7a');
    p.set(12, 15, '#f0a040');
    p.set(11, 16, '#5aa050');
  }
  p.rect(1, 21, 20, 1, woodD);
  return p.toCanvas();
}
