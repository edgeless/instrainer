export type Note = {
  name: string;
  midi: number;
  string: string;
  fret: number;
  beat: number;
  dur: number;
};

export type Song = {
  name: string;
  bpm: number;
  notes: Note[];
};

export const SONGS: Record<string, Song> = {
  c_major: {
    name: 'C Major Scale', bpm: 80,
    notes: [
      {name:'C3', midi:36, string:'A', fret:3, beat:0, dur:1},
      {name:'D3', midi:38, string:'A', fret:5, beat:1, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:2, dur:1},
      {name:'F3', midi:41, string:'A', fret:8, beat:3, dur:1},
      {name:'G3', midi:43, string:'E', fret:10, beat:4, dur:1},
      {name:'A3', midi:45, string:'G', fret:2, beat:5, dur:1},
      {name:'B3', midi:47, string:'G', fret:4, beat:6, dur:1},
      {name:'C4', midi:48, string:'G', fret:5, beat:7, dur:1},
      {name:'B3', midi:47, string:'G', fret:4, beat:8, dur:1},
      {name:'A3', midi:45, string:'G', fret:2, beat:9, dur:1},
      {name:'G3', midi:43, string:'E', fret:10, beat:10, dur:1},
      {name:'F3', midi:41, string:'A', fret:8, beat:11, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:12, dur:1},
      {name:'D3', midi:38, string:'A', fret:5, beat:13, dur:1},
      {name:'C3', midi:36, string:'A', fret:3, beat:14, dur:2},
    ]
  },
  c_major_arp: {
    name: 'Cメジャー・アルペジオ', bpm: 72,
    notes: [
      {name:'C3', midi:36, string:'A', fret:3, beat:0, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:1, dur:1},
      {name:'G3', midi:43, string:'E', fret:10, beat:2, dur:1},
      {name:'C4', midi:48, string:'G', fret:5, beat:3, dur:1},
      {name:'G3', midi:43, string:'E', fret:10, beat:4, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:5, dur:1},
      {name:'C3', midi:36, string:'A', fret:3, beat:6, dur:2},
      {name:'F3', midi:41, string:'A', fret:8, beat:8, dur:1},
      {name:'A3', midi:45, string:'G', fret:2, beat:9, dur:1},
      {name:'C4', midi:48, string:'G', fret:5, beat:10, dur:1},
      {name:'F4', midi:53, string:'D', fret:3, beat:11, dur:1},
      {name:'C4', midi:48, string:'G', fret:5, beat:12, dur:1},
      {name:'A3', midi:45, string:'G', fret:2, beat:13, dur:1},
      {name:'F3', midi:41, string:'A', fret:8, beat:14, dur:2},
    ]
  },
  blues: {
    name: 'Eブルーススケール', bpm: 76,
    notes: [
      {name:'E2', midi:28, string:'E', fret:0, beat:0, dur:1},
      {name:'G2', midi:31, string:'E', fret:3, beat:1, dur:1},
      {name:'A2', midi:33, string:'E', fret:5, beat:2, dur:1},
      {name:'Bb2',midi:34, string:'E', fret:6, beat:3, dur:1},
      {name:'B2', midi:35, string:'E', fret:7, beat:4, dur:1},
      {name:'D3', midi:38, string:'A', fret:5, beat:5, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:6, dur:2},
      {name:'D3', midi:38, string:'A', fret:5, beat:8, dur:1},
      {name:'B2', midi:35, string:'E', fret:7, beat:9, dur:1},
      {name:'Bb2',midi:34, string:'E', fret:6, beat:10, dur:1},
      {name:'A2', midi:33, string:'E', fret:5, beat:11, dur:1},
      {name:'G2', midi:31, string:'E', fret:3, beat:12, dur:1},
      {name:'E2', midi:28, string:'E', fret:0, beat:13, dur:3},
    ]
  },
  pentatonic: {
    name: 'Aペンタトニック', bpm: 84,
    notes: [
      {name:'A2', midi:33, string:'E', fret:5, beat:0, dur:1},
      {name:'C3', midi:36, string:'A', fret:3, beat:1, dur:1},
      {name:'D3', midi:38, string:'A', fret:5, beat:2, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:3, dur:1},
      {name:'G3', midi:43, string:'E', fret:10, beat:4, dur:1},
      {name:'A3', midi:45, string:'G', fret:2, beat:5, dur:1},
      {name:'G3', midi:43, string:'E', fret:10, beat:6, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:7, dur:1},
      {name:'D3', midi:38, string:'A', fret:5, beat:8, dur:1},
      {name:'C3', midi:36, string:'A', fret:3, beat:9, dur:1},
      {name:'A2', midi:33, string:'E', fret:5, beat:10, dur:2},
    ]
  },
  walking: {
    name: 'ウォーキングベース in C', bpm: 100,
    notes: [
      {name:'C3', midi:36, string:'A', fret:3, beat:0, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:1, dur:1},
      {name:'G3', midi:43, string:'E', fret:10, beat:2, dur:1},
      {name:'B2', midi:35, string:'E', fret:7, beat:3, dur:1},
      {name:'C3', midi:36, string:'A', fret:3, beat:4, dur:1},
      {name:'A2', midi:33, string:'E', fret:5, beat:5, dur:1},
      {name:'F2', midi:29, string:'E', fret:1, beat:6, dur:1},
      {name:'G2', midi:31, string:'E', fret:3, beat:7, dur:1},
      {name:'C3', midi:36, string:'A', fret:3, beat:8, dur:1},
      {name:'D3', midi:38, string:'A', fret:5, beat:9, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:10, dur:1},
      {name:'F3', midi:41, string:'A', fret:8, beat:11, dur:1},
      {name:'G3', midi:43, string:'E', fret:10, beat:12, dur:1},
      {name:'E3', midi:40, string:'A', fret:7, beat:13, dur:1},
      {name:'D3', midi:38, string:'A', fret:5, beat:14, dur:1},
      {name:'C3', midi:36, string:'A', fret:3, beat:15, dur:1},
    ]
  }
};
