const modules = import.meta.glob('./songs/*.json', { eager: true, import: 'default' });

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
  /** 拍子記号 [分子, 分母]。例: [4, 4] = 4/4拍子、[3, 4] = 3/4拍子。省略時は [4, 4] とみなす。 */
  timeSignature?: [number, number];
  notes: Note[];
};

export const SONGS: Record<string, Song> = {};

for (const path in modules) {
  const key = path.replace('./songs/', '').replace('.json', '');
  SONGS[key] = modules[path] as Song;
}
