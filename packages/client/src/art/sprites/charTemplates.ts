/**
 * Hand-placed pixel templates for the 16×32 farmer, one layer per body part
 * (Stardew-style modular sprite). Each template is `[startY, rows]`; every row is 16 chars.
 *
 * Palette keys
 *   skin:  O outline · S base · s shade · L light · B blush · M mouth
 *   eyes:  E lash · e iris · W catch-light
 *   hair:  X outline · H base · h shade · K highlight
 *   top:   Y outline · T base · t shade · u light · A button/collar accent
 *   pants: Z outline · P base · p shade
 *   shoes: F base · f dark
 *   hat:   G outline · Q base · q shade · R light · r band
 */
export type Tpl = readonly [number, readonly string[]];

// ─────────────────────────────── HEADS ───────────────────────────────

export const HEAD_DOWN: Tpl = [
  5,
  [
    '......OOOO......',
    '....OOSSSSOO....',
    '...OSSSSSSSSO...',
    '..OSSSSSSSSSSO..',
    '..OSSSSSSSSSsO..',
    '.OSSSSSSSSSSSsO.',
    '.OSSSSSSSSSSSsO.',
    '.OSSEESSSSEESsO.',
    '.OSSWeSSSSWeSsO.',
    '.OSBeeSSSSeeBsO.',
    '..OSSSSMMSSSsO..',
    '...OSSSSSSSsO...',
    '....OssssssO....',
    '......OssO......',
  ],
];

export const HEAD_DOWN_BLINK: Tpl = [
  12,
  [
    '.OSSSSSSSSSSSsO.',
    '.OSSEESSSSEESsO.',
    '.OSBSSSSSSSSBsO.',
  ],
];

export const HEAD_UP: Tpl = [
  5,
  [
    '......OOOO......',
    '....OOSSSSOO....',
    '...OSSSSSSSSO...',
    '..OSSSSSSSSSSO..',
    '..OSSSSSSSSSsO..',
    '.OSSSSSSSSSSSsO.',
    '.OSSSSSSSSSSSsO.',
    '.OsSSSSSSSSSSsO.',
    '.OsSSSSSSSSSssO.',
    '.OssSSSSSSSSssO.',
    '..OssSSSSSSssO..',
    '...OssSSSSssO...',
    '....OssssssO....',
    '......OssO......',
  ],
];

export const HEAD_RIGHT: Tpl = [
  5,
  [
    '......OOOOO.....',
    '....OOSSSSSOO...',
    '...OSSSSSSSSSO..',
    '..OSSSSSSSSSSSO.',
    '..OSSSSSSSSSSSO.',
    '.OSSSSSSSSSSSSO.',
    '.OSSSSSSSSSSSSO.',
    '.OSSSSSSSSSEESO.',
    '.OsSSSSSSSSWeSSO',
    '.OsSSSSSSSBeeSO.',
    '..OsSSSSSSSSMO..',
    '...OsSSSSSSSO...',
    '....OOssssOO....',
    '......OssO......',
  ],
];

export const HEAD_RIGHT_BLINK: Tpl = [
  12,
  [
    '.OSSSSSSSSSSSSO.',
    '.OsSSSSSSSSEESSO',
    '.OsSSSSSSSBSSSO.',
  ],
];

// ─────────────────────────────── HAIR ────────────────────────────────
// Each style: front layer (over the head) and back layer (behind the body) per direction.

export interface HairStyle {
  down: { front: Tpl; back?: Tpl };
  up: { front: Tpl; back?: Tpl };
  right: { front: Tpl; back?: Tpl };
}

const SHORT: HairStyle = {
  down: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKHHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        'XHHHHHHHHHHHHhhX',
        'XhHHHhHHHHhHHhhX',
        'XhHh.hHh.HhH.hhX',
        'Xhh..........hhX',
        '.X............X.',
      ],
    ],
  },
  up: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHHHHHXX...',
        '..XHHKKHHHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHhhhX',
        'XhHHHHHHHHHHhhhX',
        'XhHHHHHHHHHHhhhX',
        '.XhHHHHHHHHhhhX.',
        '.XhhHhHHhHhhhhX.',
        '..XhhXhhXhhhhX..',
        '...XX.XX.XXXX...',
      ],
    ],
  },
  right: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKHHHHHX..',
        '.XHHKKHHHHHHHHX.',
        '.XHKHHHHHHHHHHX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHhhHhX.',
        'XHHHHHHHh.h.hX..',
        'XhHHHHH.........',
        'XhHHHHh.........',
        'XhhHHh..........',
        '.XhhhX..........',
        '..XXX...........',
      ],
    ],
  },
};

const BOB: HairStyle = {
  down: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKKHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XhHhhhhhhhhhhhhX',
        'XHh..........hhX',
        'XHh..........hhX',
        'XHh..........hhX',
        'XHh..........hhX',
        'XhhX........XhhX',
        '.XX..........XX.',
      ],
    ],
  },
  up: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHHHHHXX...',
        '..XHHKKHHHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHhhhX',
        'XhHHHHHHHHHHhhhX',
        'XhHHHHHHHHHHhhhX',
        'XhHHHHHHHHHHhhhX',
        'XhHHHHHHHHHhhhhX',
        'XhhHhhHhhHhhhhhX',
        '.XXXXXXXXXXXXXX.',
      ],
    ],
  },
  right: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKKHHHHX..',
        '.XHHKKHHHHHHHHX.',
        '.XHKHHHHHHHHHHX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhX.',
        'XHHHHHHHhhhhhX..',
        'XhHHHHHHh.......',
        'XhHHHHHHh.......',
        'XhHHHHHh........',
        'XhhHHHhh........',
        '.XhhhhhX........',
        '..XXXXX.........',
      ],
    ],
  },
};

const LONG: HairStyle = {
  down: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKKHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHhHHHHHhhX',
        'XhHHh.hH.hHh.hhX',
        'XHh..........hhX',
        'XHh..........hhX',
        'XHh..........hhX',
        'XHh..........hhX',
        'XHhX........XhhX',
        'XHhX........XhhX',
        'XHh..........hhX',
        '.X............X.',
      ],
    ],
    back: [
      10,
      [
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XhHHHHHHHHHHhhhX',
        'XhHHHHHHHHHHhhhX',
        'XhHHHHHHHHHHhhhX',
        'XhhHHHHHHHHhhhhX',
        '.XhhHhhHhhHhhhX.',
        '..XX.XX.XX.XXX..',
      ],
    ],
  },
  up: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHHHHHXX...',
        '..XHHKKHHHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHhhhX',
        'XHHHHhHHHHhHhhhX',
        'XHHHHhHHHHhHhhhX',
        'XHHHHhHHHHhHhhhX',
        'XhHHHhHHHHhHhhhX',
        'XhHHHhHHHHhHhhhX',
        'XhHHHhHHHHhHhhhX',
        'XhHHHhHHHHhHhhhX',
        'XhHHHhHHHHhHhhhX',
        'XhHHHhHHHHhHhhhX',
        'XhHHHhHHHHhhhhhX',
        'XhhHHhHHHHhhhhhX',
        'XhhHhhHhHhhhhhhX',
        '.XhhhhhhhhhhhhX.',
        '..XhXXhXXhXXhX..',
        '...X..X..X..X...',
      ],
    ],
  },
  right: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKKHHHHX..',
        '.XHHKKHHHHHHHHX.',
        '.XHKHHHHHHHHHHX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhX.',
        'XHHHHHHHhhh.hX..',
        'XhHHHHHHh.......',
        'XhHHHHHHh.......',
        'XhHHHHHh........',
        'XhHHHHHh........',
        'XhHHHHhX........',
        'XhHHHHhX........',
        'XhHHHHhX........',
        'XhHHHHhX........',
        'XhHHHHhX........',
        'XhHHHHhX........',
        'XhhHHhhX........',
        'XhhHhhhX........',
        '.XhhhhX.........',
        '..XXXX..........',
      ],
    ],
  },
};

const PONYTAIL: HairStyle = {
  down: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKHHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        '.XHHHHHHHHHHHhX.',
        '.XhHHHHHHhhhhhX.',
        '.XhhHHhh....hhX.',
        '.Xh..........hX.',
        '.X............X.',
      ],
    ],
  },
  up: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHHHHHXX...',
        '..XHHKKHHHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        '.XHHHHHHHHHHHhX.',
        '.XHHHHHKHHHHhhX.',
        '.XhHHHHKHHHhhhX.',
        '.XhHHHrrrHHhhhX.',
        '..XhHHrrrHhhhX..',
        '...XXHHHHhXXX...',
        '.....XHKHhX.....',
        '.....XHKHhX.....',
        '.....XHHHhX.....',
        '......XHhhX.....',
        '......XHhX......',
        '......XHhX......',
        '.......XX.......',
      ],
    ],
  },
  right: {
    front: [
      3,
      [
        '.....XXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKHHHHHX..',
        '.XHHKKHHHHHHHHX.',
        '.XHKHHHHHHHHHHX.',
        '.XHHHHHHHHHHHhhX',
        '.XrrHHHHHHhhHhX.',
        'XHrrHHHHh.h.hX..',
        'XHhHHHH.........',
        'XHhHHHh.........',
        'XHhhHh..........',
        'XHhXhX..........',
        'XHhX.X..........',
        'XHhX............',
        'XhhX............',
        '.XhX............',
        '..X.............',
      ],
    ],
  },
};

const CURLY: HairStyle = {
  down: {
    front: [
      2,
      [
        '....XX.XX.XX....',
        '...XHHXHHXHHX...',
        '..XHKHHKHHKHhX..',
        '.XHKHHhHKHHhHhX.',
        'XHHHhHHHHhHHHhhX',
        'XHKHHHhHKHHhHhhX',
        'XhHHhHHHHHhHHhhX',
        'XHhHHhHhHHhHhhhX',
        'XhhHh.hH.hHh.hhX',
        'XhH..........HhX',
        'XhX..........XhX',
        '.X............X.',
      ],
    ],
  },
  up: {
    front: [
      2,
      [
        '....XX.XX.XX....',
        '...XHHXHHXHHX...',
        '..XHKHHKHHKHhX..',
        '.XHKHHhHKHHhHhX.',
        'XHHHhHHHHhHHHhhX',
        'XHKHHHhHKHHhHhhX',
        'XhHHhHHHHHhHHhhX',
        'XHhHHhHhHHhHhhhX',
        'XhHHhHHKHhHhHhhX',
        'XHhHHhHHhHHhhhhX',
        'XhHhHHhHHhHhhhhX',
        '.XhhHhhHhhhhhhX.',
        '..XhhXhhXhhhhX..',
        '...XX.XX.XXXX...',
      ],
    ],
  },
  right: {
    front: [
      2,
      [
        '....XX.XX.XX....',
        '...XHHXHHXHHX...',
        '..XHKHHKHHKHHX..',
        '.XHKHHhHKHHhHHX.',
        'XHHHhHHHHhHHHhhX',
        'XHKHHHhHKHHhHhX.',
        'XhHHhHHHHHhhhX..',
        'XHhHHhHHh.h.X...',
        'XhHHhHHh........',
        'XHhHHhHh........',
        'XhhHhhh.........',
        '.XhhhhX.........',
        '..XXXX..........',
      ],
    ],
  },
};

const BUN: HairStyle = {
  down: {
    front: [
      0,
      [
        '......XXXX......',
        '.....XHKKHX.....',
        '.....XHHHhX.....',
        '....XXXhhXXX....',
        '...XHHKKHHHHX...',
        '..XHKKHHHHHHhX..',
        '.XHKHHHHHHHHhhX.',
        '.XHHHHHHHHHHHhX.',
        '.XhHHHhhhhHHhhX.',
        '.Xh..........hX.',
        '.X............X.',
      ],
    ],
  },
  up: {
    front: [
      0,
      [
        '......XXXX......',
        '.....XHKKHX.....',
        '.....XHHHhX.....',
        '....XXrrrrXX....',
        '...XHHHHHHHHX...',
        '..XHHKKHHHHHhX..',
        '.XHHKKHHHHHHhhX.',
        '.XHKHHHHHHHHHhX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHHHHHhhX',
        'XhHHHHHHHHHHhhhX',
        'XhHHHHHHHHHHhhhX',
        '.XhHHHHHHHHhhhX.',
        '.XhhHHHHHHhhhhX.',
        '..XhhhhhhhhhhX..',
        '...XXXXXXXXXX...',
      ],
    ],
  },
  right: {
    front: [
      0,
      [
        '...XXXX.........',
        '..XHKKHX........',
        '..XHHHhX........',
        '...XrrXXXXX.....',
        '...XXHHKKHHXX...',
        '..XHHKKKHHHHHX..',
        '.XHHKKHHHHHHHHX.',
        '.XHKHHHHHHHHHHX.',
        'XHHHHHHHHHHHHhhX',
        'XHHHHHHHHhhhhX..',
        'XhHHHHHh........',
        'XhHHHHh.........',
        'XhhHHh..........',
        '.XhhhX..........',
        '..XXX...........',
      ],
    ],
  },
};

export const HAIR_STYLES: readonly HairStyle[] = [SHORT, BOB, LONG, PONYTAIL, CURLY, BUN];

// ─────────────────────────────── TORSO ───────────────────────────────
// Rows 18..23 (dress continues to 26). Styles: 0 tee · 1 overalls · 2 sweater · 3 dress.

export const TORSO_DOWN: readonly Tpl[] = [
  [18, ['.....YuSSuY.....', '...YuTTTTTTtY...', '..YuTTTTTTTTtY..', '....YTTTTTtY....', '....YTTTTTtY....', '....YtTTTttY....']],
  [18, ['.....YuSSuY.....', '...YuTTTTTTtY...', '..YuTZPPPPZTtY..', '....ZPAPPAPZ....', '....ZPPPPPpZ....', '....ZpPPPppZ....']],
  [18, ['.....YAAAAY.....', '...YuTuTuTtTY...', '..YuTTuTTuTTtY..', '....YTuTTuTY....', '....YTTuTTtY....', '....YAAAAAAY....']],
  [
    18,
    [
      '.....YuSSuY.....',
      '...YuTTTTTTtY...',
      '..YuTTTTTTTTtY..',
      '....YTTAATtY....',
      '....YTTTTTtY....',
      '....YtTTTttY....',
      '...YTTTTTTTtY...',
      '..YTTuTTTTTTtY..',
      '..YtTtTtTtTttY..',
      '...YYYYYYYYYY...',
    ],
  ],
];

export const TORSO_UP: readonly Tpl[] = [
  [18, ['.....YTTTTY.....', '...YuTTTTTTtY...', '..YuTTTTTTTTtY..', '....YTTTTTtY....', '....YTTTTTtY....', '....YtTTTttY....']],
  [18, ['.....YTTTTY.....', '...YuTTTTTTtY...', '..YuZTTTTZTtY...', '....YZTTTZtY....', '....ZPPPPPpZ....', '....ZpPPPppZ....']],
  [18, ['.....YAAAAY.....', '...YuTuTuTtTY...', '..YuTTuTTuTTtY..', '....YTuTTuTY....', '....YTTuTTtY....', '....YAAAAAAY....']],
  [
    18,
    [
      '.....YTTTTY.....',
      '...YuTTTTTTtY...',
      '..YuTTTTTTTTtY..',
      '....YTTTTTtY....',
      '....YTTTTTtY....',
      '....YtTTTttY....',
      '...YTTTTTTTtY...',
      '..YTTuTTTTTTtY..',
      '..YtTtTtTtTttY..',
      '...YYYYYYYYYY...',
    ],
  ],
];

export const TORSO_RIGHT: readonly Tpl[] = [
  [18, ['......YSSY......', '.....YuTTtY.....', '.....YuTTTtY....', '.....YTTTTtY....', '.....YTTTTtY....', '.....YtTTttY....']],
  [18, ['......YSSY......', '.....YuTTtY.....', '.....YuZPPZY....', '.....ZPPAPpZ....', '.....ZPPPPpZ....', '.....ZpPPppZ....']],
  [18, ['......YAAY......', '.....YuTuTY.....', '.....YuTTuTY....', '.....YTuTTtY....', '.....YTTuTtY....', '.....YAAAAAY....']],
  [
    18,
    [
      '......YSSY......',
      '.....YuTTtY.....',
      '.....YuTTTtY....',
      '.....YTTTTtY....',
      '.....YTTTTtY....',
      '.....YtTTttY....',
      '....YTTTTTTtY...',
      '....YTuTTTTtY...',
      '...YtTtTtTttY...',
      '....YYYYYYYY....',
    ],
  ],
];

// ─────────────────────────────── ARMS ────────────────────────────────
// Front/back arms hang at the sides; `swing` lengthens one arm and shortens the other.
// `sleeve` = number of rows covered by the sleeve colour (tee 0 → short sleeves on the shoulder only).

export function armsDown(swing: number, longSleeve: boolean, back: boolean): Tpl {
  const rows: string[] = [];
  for (let y = 21; y <= 26; y++) {
    const row = Array.from('................');
    // Left arm (x2..3), right arm (x12..13).
    const lEnd = 24 + (swing > 0 ? 1 : swing < 0 ? -1 : 0);
    const rEnd = 24 + (swing < 0 ? 1 : swing > 0 ? -1 : 0);
    for (const [x0, end, lit] of [
      [2, lEnd, !back],
      [12, rEnd, back],
    ] as const) {
      if (y < end) {
        const sleeve = longSleeve && y < end - 1;
        row[x0] = sleeve ? 'Y' : 'O';
        row[x0 + 1] = sleeve ? (lit ? 'T' : 't') : lit ? 'S' : 's';
        if (x0 === 12) {
          row[x0] = sleeve ? (lit ? 'T' : 't') : lit ? 'S' : 's';
          row[x0 + 1] = sleeve ? 'Y' : 'O';
        }
      } else if (y === end) {
        row[x0] = x0 === 2 ? 'O' : lit ? 'L' : 's';
        row[x0 + 1] = x0 === 2 ? (lit ? 'L' : 's') : 'O';
      } else if (y === end + 1) {
        row[x0 === 2 ? x0 + 1 : x0] = 'O';
      }
    }
    rows.push(row.join(''));
  }
  return [21, rows];
}

// ─────────────────────────────── LEGS ────────────────────────────────
// Rows 24..31. `stride` for front/back: 0 idle, 1 left foot forward, -1 right foot forward.

export function legsDown(stride: number, skirt: boolean): Tpl {
  const pant = skirt ? 'S' : 'P';
  const pantD = skirt ? 's' : 'p';
  const out = skirt ? 'O' : 'Z';
  const rows: string[] = [];
  const liftL = stride < 0 ? 1 : 0;
  const liftR = stride > 0 ? 1 : 0;
  for (let y = 24; y <= 31; y++) {
    const row = Array.from('................');
    if (!skirt && y <= 25) {
      for (let x = 4; x <= 11; x++) row[x] = x === 4 || x === 11 ? 'Z' : y === 25 && x === 8 ? 'p' : 'P';
      rows.push(row.join(''));
      continue;
    }
    for (const [x0, lift, dark] of [
      [4, liftL, false],
      [8, liftR, true],
    ] as const) {
      const legBottom = 28 - lift;
      const shoeTop = 29 - lift;
      if (y >= (skirt ? 27 : 26) && y <= legBottom) {
        row[x0] = x0 === 4 ? out : out;
        row[x0 + 1] = dark ? pantD : pant;
        row[x0 + 2] = y === legBottom ? pantD : dark ? pantD : pant;
        row[x0 + 3] = out;
      } else if (y >= shoeTop && y <= shoeTop + 1) {
        row[x0] = 'f';
        row[x0 + 1] = 'F';
        row[x0 + 2] = y === shoeTop ? 'F' : 'f';
        row[x0 + 3] = 'f';
      } else if (y === shoeTop + 2) {
        row[x0] = '.';
        row[x0 + 1] = 'f';
        row[x0 + 2] = 'f';
        row[x0 + 3] = '.';
      }
    }
    rows.push(row.join(''));
  }
  return [24, rows];
}

/** Side-view legs. `pose`: 0 together, 1 near leg forward, 2 passing, 3 far leg forward. */
export function legsRight(pose: number, skirt: boolean): Tpl {
  const rows: Record<number, string[]> = {
    0: ['.....ZPPPPZ.....', '.....ZPPPpZ.....', '......ZPpZ......', '......ZPpZ......', '......ZppZ......', '......fFFFFf....', '......fFFFff....', '.......ffff.....'],
    1: ['.....ZPPPPZ.....', '.....ZPPPpZ.....', '.....ZpZZPPZ....', '....ZpZ..ZPPZ...', '...ZpZ....ZpPZ..', '..fFf.....fFFFf.', '..fff.....fffff.', '................'],
    2: ['.....ZPPPPZ.....', '.....ZPPPpZ.....', '......ZPpZ......', '......ZPpZ......', '.....ZpZZpZ.....', '.....fFfFFFf....', '.....ffffff.....', '................'],
    3: ['.....ZPPPPZ.....', '.....ZPPPpZ.....', '.....ZPZZppZ....', '....ZPZ..ZppZ...', '...ZPZ....ZppZ..', '..fFf.....fFFFf.', '..fff.....fffff.', '................'],
  };
  let out = rows[pose];
  if (skirt) out = out.map((r, i) => (i < 2 ? '................' : r.replace(/Z/g, 'O').replace(/P/g, 'S').replace(/p/g, 's')));
  return [24, out];
}

// ─────────────────────────────── HATS ────────────────────────────────

export const HATS_T: ReadonlyArray<{ down: Tpl; up: Tpl; right: Tpl } | null> = [
  null,
  // Straw hat — broad brim, domed crown, red ribbon.
  {
    down: [0, ['................', '.....GGGGGG.....', '....GRRRQQqG....', '....GRQQQQqG....', '...GrrrrrrrrG...', '.GGRRQQQQQQqqGG.', 'GRRQQQQQQQQQQqqG', 'GQQQQQQQQQQQqqqG', '.GqqqqqqqqqqqqG.', '..GGGGGGGGGGGG..']],
    up: [0, ['................', '.....GGGGGG.....', '....GRQQQQqG....', '....GQQQQQqG....', '...GrrrrrrrrG...', '.GGRQQQQQQQqqGG.', 'GRRQQQQQQQQQQqqG', 'GQQQQQQQQQQQqqqG', '.GqqqqqqqqqqqqG.', '..GGGGGGGGGGGG..']],
    right: [0, ['................', '......GGGGGG....', '.....GRRQQqG....', '.....GRQQQqG....', '....GrrrrrrrG...', '.GGGRQQQQQqqGGG.', 'GRRQQQQQQQQQQqqG', 'GQQQQQQQQQQQqqqG', '.GqqqqqqqqqqqqG.', '..GGGGGGGGGGGG..']],
  },
  // Beret.
  {
    down: [1, ['.......GG.......', '....GGGQQGGG....', '..GGRRQQQQQqGG..', '.GRRQQQQQQQQqqG.', '.GqQQQQQQQQqqqG.', '..GGGGGGGGGGGG..']],
    up: [1, ['.......GG.......', '....GGGQQGGG....', '..GGRQQQQQQqGG..', '.GRQQQQQQQQQqqG.', '.GqqQQQQQQqqqqG.', '..GGGGGGGGGGGG..']],
    right: [1, ['........GG......', '....GGGGQQGGG...', '..GGRRQQQQQQqG..', '.GRRQQQQQQQQqqG.', '.GqQQQQQQQQqqG..', '..GGGGGGGGGGG...']],
  },
  // Beanie.
  {
    down: [0, ['.......GG.......', '......GRRG......', '......GqqG......', '....GGGGGGGG....', '...GRQRQRQRqG...', '..GRQRQRQRQqqG..', '.GQRQRQRQRQRqqG.', '.GrrrrrrrrrrrrG.', '.GqqqqqqqqqqqqG.', '..GGGGGGGGGGGG..']],
    up: [0, ['.......GG.......', '......GRRG......', '......GqqG......', '....GGGGGGGG....', '...GRQRQRQRqG...', '..GRQRQRQRQqqG..', '.GQRQRQRQRQRqqG.', '.GrrrrrrrrrrrrG.', '.GqqqqqqqqqqqqG.', '..GGGGGGGGGGGG..']],
    right: [0, ['......GG........', '.....GRRG.......', '.....GqqG.......', '....GGGGGGGG....', '...GRQRQRQRqG...', '..GRQRQRQRQqqG..', '.GQRQRQRQRQRqqG.', '.GrrrrrrrrrrrrG.', '.GqqqqqqqqqqqG..', '..GGGGGGGGGGG...']],
  },
];
