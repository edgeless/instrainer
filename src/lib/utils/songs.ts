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
  notes: Note[];
};

export const SONGS: Record<string, Song> = {};

for (const path in modules) {
  const key = path.replace('./songs/', '').replace('.json', '');
  SONGS[key] = modules[path] as Song;
}
