# Fretless Training

SvelteKitで構築された、モダンなWebベースのフレットレスベース練習用アプリケーションです。リアルタイムのピッチ検出、波形の可視化、セッションの分析機能を提供することで、プレイヤーのイントネーション習得をサポートします。

## 主な機能
- **リアルタイムピッチ検出**: Web Audio APIを使用し、楽器のピッチをリアルタイムで検出して分析します。
- **波形とピッチの可視化**: ターゲットピッチに対する現在のイントネーションを視覚的なフィードバックとして表示します。
- **調整可能なメトロノーム (BPM)**: 練習中にテンポを動的に変更できます。
- **オーディオデバイスの選択**: 好みの入力デバイス（オーディオインターフェイスなど）と出力デバイスを簡単に選択できます。
- **セッション分析**: スコアリングシステムによるパフォーマンスの詳細な分析を提供します。
- **多段スコア表示**: 五線譜・タブ譜を4小節/行で複数行に折り返し表示。「両方」モードでは五線譜行→タブ譜行を交互に配置します。

## 技術スタック
- フロントエンドフレームワーク: [SvelteKit](https://kit.svelte.dev/)
- 状態管理: Svelte 5 Runes (`$state`, `$derived`, `$effect`)
- スタイリング: スコープされたコンポーネントスタイル付きのプレーンCSS
- 音声処理: Web Audio API (ピッチ検出とメトロノーム)
- 言語: TypeScript

## ディレクトリ構成
- `src/lib/components`: UIコンポーネント (Header, Transport, PitchMonitorなど)
- `src/lib/stores`: Svelte 5 Runesを使用したアプリケーション状態 (`audio.svelte.ts`, `player.svelte.ts`, `score.svelte.ts`)
- `src/lib/utils`: ピッチ検出の計算や曲のロジックなどのヘルパー関数
- `src/lib/utils/songs`: 個別の楽曲データ (JSON形式)
- `src/routes`: SvelteKitのページとレイアウト

## 楽曲データの追加

新しい楽曲を追加するには、`src/lib/utils/songs/` ディレクトリに `{任意のID}.json` ファイルを作成してください。
ファイル名（拡張子を除く）がアプリ内部の曲キーになります。`import.meta.glob` で自動的に読み込まれるため、登録処理は不要です。

### JSON フォーマット仕様

```json
{
  "name": "曲の表示名",
  "bpm": 80,
  "timeSignature": [4, 4],
  "notes": [
    {"name":"C3", "midi":36, "string":"A", "fret":3, "beat":0, "dur":1},
    {"name":"E3", "midi":40, "string":"A", "fret":7, "beat":1, "dur":1}
  ]
}
```

### Song（トップレベル）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | `string` | ✅ | UI に表示される曲名。日本語可。 |
| `bpm` | `number` | ✅ | デフォルトの再生テンポ（BPM）。ユーザーがヘッダーから変更可能。 |
| `timeSignature` | `[number, number]` | — | 拍子記号 `[分子, 分母]`。例: `[4, 4]`。省略時は `[4, 4]` として扱われるが、明示的に記述すること推奨。 |
| `notes` | `Note[]` | ✅ | ノートオブジェクトの配列。`beat` の昇順で記述する。 |

### Note（notes 配列の各要素）

| フィールド | 型 | 必須 | 説明 | 例 |
|---|---|---|---|---|
| `name` | `string` | ✅ | 音名＋オクターブ（**記譜ピッチ**）。`A4`=440Hz ではなく、ベースの記譜表記に従う（※後述）。シャープは `#`、フラットは `b` で表記。 | `"C3"`, `"Bb2"`, `"F#3"` |
| `midi` | `number` | ✅ | **記譜ピッチ**に対応する MIDI ノート番号（0–127）。`name` と一致させること。 | `36` (C3), `40` (E3) |
| `string` | `string` | ✅ | 演奏する弦の名前。4弦ベース基準: `"E"`, `"A"`, `"D"`, `"G"`。 | `"A"` |
| `fret` | `number` | ✅ | フレット番号（0 = 開放弦）。 | `3` |
| `beat` | `number` | ✅ | ノートの開始位置（拍単位、0始まり）。曲の先頭からの**累積値**。繰り返し区間でもリセットせず連続する（例: 16拍の曲を2周→2周目は `beat: 16` から）。 | `0`, `4`, `16` |
| `dur` | `number` | ✅ | ノートの長さ（拍単位）。`1`=4分音符、`2`=2分音符、`0.5`=8分音符。 | `1`, `2` |

### 音程表記のルール（記譜ピッチ / Written Pitch）

楽曲データでは**実音（Concert Pitch）ではなくベースの記譜ピッチ**を使用します。
ベースの楽譜は実音より1オクターブ高く記譜されるため、以下の対応になります：

| 記譜上の表記 | 実音 | MIDI | 備考 |
|---|---|---|---|
| `E2` | E1 (41.2 Hz) | 28 | 4弦開放 |
| `A2` | A1 (55.0 Hz) | 33 | 3弦開放 |
| `D3` | D2 (73.4 Hz) | 38 | 2弦開放 |
| `G3` | G2 (98.0 Hz) | 43 | 1弦開放 |

> **注意**: `midi` 値は実音のMIDI番号ではなく、記譜ピッチに対応するMIDI番号を記載してください。内部でピッチ検出との照合時に変換が行われます。

### 楽曲データの例

```json
{
  "name": "Cメジャー・アルペジオ",
  "bpm": 72,
  "timeSignature": [4, 4],
  "notes": [
    {"name":"C3", "midi":36, "string":"A", "fret":3,  "beat":0,  "dur":1},
    {"name":"E3", "midi":40, "string":"A", "fret":7,  "beat":1,  "dur":1},
    {"name":"G3", "midi":43, "string":"E", "fret":10, "beat":2,  "dur":1},
    {"name":"C4", "midi":48, "string":"G", "fret":5,  "beat":3,  "dur":1},
    {"name":"G3", "midi":43, "string":"E", "fret":10, "beat":4,  "dur":1},
    {"name":"E3", "midi":40, "string":"A", "fret":7,  "beat":5,  "dur":1},
    {"name":"C3", "midi":36, "string":"A", "fret":3,  "beat":6,  "dur":2}
  ]
}
```

### TypeScript 型定義

アプリ内では `src/lib/utils/songs.ts` で以下の型が定義されています：

```typescript
type Note = {
  name: string;   // 記譜ピッチの音名 (例: "C3")
  midi: number;   // 記譜ピッチの MIDI ノート番号
  string: string; // 弦名 ("E" | "A" | "D" | "G")
  fret: number;   // フレット番号 (0 = 開放弦)
  beat: number;   // 開始拍 (0始まり)
  dur: number;    // 長さ (拍単位)
};

type Song = {
  name: string;                   // 曲名
  bpm: number;                    // デフォルトBPM
  timeSignature?: [number, number]; // 拍子記号 [分子, 分母] (省略時: [4,4])
  notes: Note[];                  // ノート配列
};
```

## はじめに

### 前提条件
Node.jsとnpmがインストールされていることを確認してください。

### インストールと起動
リポジトリをクローンし、依存関係をインストールします:
```bash
npm install
```

開発サーバーを起動します:
```bash
npm run dev
```
ブラウザで `http://localhost:5173` にアクセスしてください。

### 本番用ビルド
```bash
npm run build
```
ビルドされたアプリのプレビュー:
```bash
npm run preview
```
