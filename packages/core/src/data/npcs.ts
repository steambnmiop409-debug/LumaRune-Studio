import type { Appearance } from '../player/appearance';

/** Named spots NPCs walk between. Resolved to tiles from the generated map (see sim/npc.ts). */
export type Place =
  | 'seedShop'
  | 'toolShop'
  | 'fountain'
  | 'stallW'
  | 'stallE'
  | 'pier'
  | 'harbor'
  | 'lighthouse'
  | 'meadow'
  | 'beach'
  | 'farmGate'
  | 'home0'
  | 'home1'
  | 'home2'
  | 'forest';

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  look: Appearance;
  /** [start minute, place] — they walk there from the previous place. */
  schedule: Array<[number, Place]>;
  loves: string[];
  likes: string[];
  dislikes: string[];
  lines: {
    greet: string[];
    friend: string[];
    close: string[];
    rain: string[];
    loved: string;
    liked: string;
    neutral: string;
    disliked: string;
  };
}

export const NPCS: NpcDef[] = [
  {
    id: 'hana',
    name: '하나',
    role: '들꽃 씨앗방 주인',
    look: { skin: 1, hairStyle: 3, hairColor: 6, eyes: 3, top: 3, topColor: 3, bottomColor: 7, hat: 0 },
    schedule: [
      [360, 'home0'],
      [420, 'meadow'],
      [520, 'seedShop'],
      [1080, 'fountain'],
      [1260, 'home0'],
    ],
    loves: ['forage.wildflower', 'crop.sunflower', 'crop.lavender'],
    likes: ['crop.tulip', 'crop.cosmos', 'crop.strawberry', 'forage.wildberry'],
    dislikes: ['forage.driftwood', 'forage.pinecone'],
    lines: {
      greet: ['어서 와요! 오늘도 흙냄새가 좋네요.', '씨앗 봉투 뒤에 적힌 기온을 꼭 봐 주세요.', '아침엔 언덕에 들꽃을 보러 가요.', '벌통 옆에 라벤더를 심어 봐요. 꿀에서 꽃향기가 나요.'],
      friend: ['당신 밭을 지나가다 봤어요. 정말 잘 가꾸고 있더라고요!', '비 오는 날엔 가게 창가에서 빗소리를 듣는 게 좋아요.'],
      close: ['당신 덕분에 이 섬이 더 좋아졌어요. 정말이에요.', '언젠가 둘이서 별빛 언덕에 꽃을 심어 봐요.'],
      rain: ['비에 약한 딸기랑 토마토는 괜찮아요? 비가림막이 있으면 든든할 거예요.'],
      loved: '어머… 제가 제일 좋아하는 거예요! 고마워요!',
      liked: '와, 예뻐요. 고마워요.',
      neutral: '고마워요, 잘 쓸게요.',
      disliked: '음… 마음만 받을게요.',
    },
  },
  {
    id: 'doyun',
    name: '도윤',
    role: '등불 공방 대장장이',
    look: { skin: 4, hairStyle: 0, hairColor: 0, eyes: 1, top: 1, topColor: 6, bottomColor: 2, hat: 3 },
    schedule: [
      [360, 'home1'],
      [500, 'toolShop'],
      [720, 'stallE'],
      [790, 'toolShop'],
      [1110, 'pier'],
      [1290, 'home1'],
    ],
    loves: ['forage.chanterelle', 'crop.chili', 'crop.cheongyang'],
    likes: ['crop.potato', 'crop.corn', 'forage.pinecone'],
    dislikes: ['crop.lettuce', 'forage.wildflower'],
    lines: {
      greet: ['뭐든 고쳐 줄게. 망치 소리가 좀 시끄럽겠지만.', '스프링클러 하나면 아침이 한결 여유로워져.', '상자는 넉넉히 사 두는 게 좋아.', '북쪽 절벽 아래 채석장에서 광석을 캐 와. 곡괭이는 여기서 팔아.', '용광로엔 광석 다섯 개에 석탄 하나. 그게 요령이야.'],
      friend: ['저녁엔 부두에서 배가 떠나는 걸 보는 게 낙이야.', '네 물뿌리개, 한번 손봐 줄까?'],
      close: ['다음에 은 스프링클러 만들 때 네 이름을 새겨 둘게.', '이 섬에 와 줘서 고마워, 진심으로.'],
      rain: ['비 오는 날엔 화로 앞이 최고지.'],
      loved: '오… 이건 정말 좋은데! 고마워.',
      liked: '괜찮은데? 잘 받을게.',
      neutral: '음, 고마워.',
      disliked: '이건… 내 취향은 아니네.',
    },
  },
  {
    id: 'marin',
    name: '마린 선장',
    role: '화물선 선장',
    look: { skin: 3, hairStyle: 4, hairColor: 8, eyes: 2, top: 2, topColor: 5, bottomColor: 1, hat: 2 },
    schedule: [
      [360, 'pier'],
      [1030, 'harbor'],
      [1200, 'fountain'],
      [1320, 'harbor'],
    ],
    loves: ['forage.seaglass', 'crop.mandarin', 'crop.hallabong'],
    likes: ['forage.shell', 'crop.lemon', 'crop.apple'],
    dislikes: ['crop.onion'],
    lines: {
      greet: ['상자는 17시 전까지 실어 줘. 바다는 기다려 주지 않거든.', '좋은 작물일수록 뭍에서 값을 잘 쳐줘.', '같은 걸 한꺼번에 너무 많이 보내면 값이 떨어져.', '잼이나 과일주는 뭍 사람들이 아주 좋아해. 생과일보다 훨씬 비싸게 팔려.'],
      friend: ['오늘 항해는 순조로울 것 같군. 네 상자 덕분이야.', '등대 불빛이 없으면 이 항구에 못 들어와.'],
      close: ['언젠가 너를 태우고 먼바다 섬들을 보여 주고 싶어.', '네 작물은 뭍에서도 소문이 자자해.'],
      rain: ['폭풍이 오면 배를 띄울 수 없을지도 몰라. 그래도 약속은 지키지.'],
      loved: '하하! 뱃사람 마음을 제대로 아는군!',
      liked: '고맙군. 선실에 두지.',
      neutral: '음, 고마워.',
      disliked: '흠… 이건 배에 싣기엔 좀.',
    },
  },
  {
    id: 'sora',
    name: '소라',
    role: '등대지기 화가',
    look: { skin: 2, hairStyle: 2, hairColor: 9, eyes: 4, top: 2, topColor: 7, bottomColor: 7, hat: 2 },
    schedule: [
      [360, 'lighthouse'],
      [780, 'meadow'],
      [960, 'beach'],
      [1140, 'lighthouse'],
    ],
    loves: ['forage.seaglass', 'crop.lotus', 'crop.hydrangea'],
    likes: ['forage.shell', 'crop.blueberry', 'crop.rose'],
    dislikes: ['crop.garlic', 'forage.driftwood'],
    lines: {
      greet: ['오늘 하늘 색은 연보라와 살구색 사이야.', '밤에 등대 빛줄기를 보러 와. 파도가 은색으로 빛나.', '그림 그릴 풍경이 많은 섬이야.', '겨울이면 농장 연못이 얼어서 거울처럼 빛나.'],
      friend: ['네 밭을 그려 봤어. 초록색 물감이 모자랐어.', '해질녘 해변은 매일 다른 색이야.'],
      close: ['네가 오고 나서 그림에 사람이 들어가기 시작했어.', '등대 꼭대기에서 보는 별, 같이 볼래?'],
      rain: ['비 오는 날의 회색은 아주 부드러워서 좋아.'],
      loved: '…너무 예뻐. 그림에 꼭 넣을게.',
      liked: '고마워. 색이 좋다.',
      neutral: '응, 고마워.',
      disliked: '음… 이건 그리기 어렵겠다.',
    },
  },
  {
    id: 'bomi',
    name: '봄이',
    role: '마을 꼬마',
    look: { skin: 1, hairStyle: 5, hairColor: 3, eyes: 0, top: 0, topColor: 8, bottomColor: 3, hat: 0 },
    schedule: [
      [420, 'home2'],
      [480, 'fountain'],
      [720, 'stallW'],
      [800, 'beach'],
      [1020, 'farmGate'],
      [1110, 'home2'],
    ],
    loves: ['crop.strawberry', 'crop.watermelon', 'forage.wildberry'],
    likes: ['crop.sweetcorn', 'crop.cherrytomato', 'forage.shell'],
    dislikes: ['crop.cheongyang', 'crop.bittermelon'],
    lines: {
      greet: ['안녕! 농부 언니, 오빠! 오늘은 뭐 심어?', '해변에서 반짝이는 유리를 찾았어!', '분수에 동전 던지면 소원 이뤄진대!', '폭포 뒤 숲에 옛날 유적이 있대. 무섭지만 가 보고 싶어!'],
      friend: ['나도 크면 너처럼 농장 할 거야!', '배가 뿌우— 하고 떠나는 소리 좋아!'],
      close: ['너는 내 제일 친한 어른 친구야!', '이거 비밀인데… 숲에 곰보버섯 나는 자리 알아!'],
      rain: ['비 오면 웅덩이 첨벙첨벙 하는 게 제일 좋아!'],
      loved: '우와아! 최고야! 고마워!!',
      liked: '헤헤, 고마워!',
      neutral: '음, 고마워!',
      disliked: '으엑… 이거 매워!',
    },
  },
];

export const NPC_BY_ID = new Map(NPCS.map((n) => [n.id, n]));
