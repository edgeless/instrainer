# コーディングエージェント向けガイドライン (AGENTS.md)

AIコーディングエージェント向けの文書です。このドキュメントでは、`Fretless Training` アプリケーションを開発・修正する際のアーキテクチャパターン、コーディング規約、およびルールについて説明します。
実装を変更する前に、必ずこのファイルを注意深く読んでください。

## 1. 目的とドメイン
このアプリはリアルタイムのフレットレスベース練習用アプリケーションです。特にWeb Audio APIの統合やピッチ検出ループまわりのパフォーマンスが非常に重要です。音声処理中にメインスレッドをブロックする処理を避けてください。

## 2. 技術スタックと状態管理
- **フレームワーク**: Svelte 5を使用するSvelteKit。
- **状態管理**: **Svelte 5 Runes** (`$state`, `$derived`, `$effect`, `$props`) のみを排他的に使用します。Svelte 4互換のストアのサブスクリプション(`$store`)や、古い `export let` 構文のPropsは絶対に使わないでください。
- **スタイリング**: 標準的なCSS。Svelteコンポーネント内のスコープされた `<style>` ブロックを優先して使用します。ユーザーから明示的な要求がない限り、Tailwindは使用しないでください。

## 3. アーキテクチャ
- **コンポーネント (`src/lib/components`)**: UI要素は機能ごとに構造化されています。
  - `Header.svelte`: BPMやオーディオデバイスの選択を担当。
  - `PitchMonitor.svelte`: ピッチと波形をリアルタイムで可視化。
  - `Transport.svelte`: 再生コントロール。
- **ストア・状態 (`src/lib/stores`)**: `$state`を利用したクラスやクロージャを含む `.svelte.ts` ファイルを使用します。
  - `audio.svelte.ts`: Web Audio APIロジック、デバイス選択、マイクのアクセス許可。
  - `player.svelte.ts`: メトロノームと再生状態。
  - `score.svelte.ts`: スコア計算やセッション指標を保存するロジック。
- **ユーティリティ (`src/lib/utils`)**: 副作用のない（純粋な）TypeScript関数群。例：セント値、周波数、ノートの計算を行う `pitch.ts`。

## 4. コーディング規約
- **TypeScript**: 常に厳格な型付けを使用します。`any`は避けてください。適用可能な箇所ではコンポーネントPropsの型定義にInterfaceを活用してください。
- **Audio API**: ブラウザの自動再生(Autoplay)ポリシーに注意してください。`AudioContext` はユーザーのアクション(クリック等)の後に再開/開始される必要があります。
- **Svelte 5 Runes 構文**:
  - Props: `let { myProp }: { myProp: string } = $props();`
  - State: `let count = $state(0);`
  - Derived: `let doubled = $derived(count * 2);`
  - Effect: `$effect(() => { console.log(count); });`

## 5. UI/UX ルール
- プレミアムでモダンな外観を持つ、ダークモードに適したレスポンシブなUIを維持・優先してください。
- BPMやスコアなどのリアルタイムデータを動的に更新する際、レイアウトシフト（配置のズレ）が発生しない構造を心がけてください。

## 6. 音程表記・記譜法のルール
- 楽曲データ(`src/lib/utils/songs/` 内のJSONファイル)および譜面描画(`ScoreSection.svelte`)におけるオクターブ表記は、科学的ピッチ記法(SPN)形の実音ではなく、**ベースの一般的な記譜（Written Pitch）** を基準とします。
- すなわち、4弦ベースの最低音（E開放弦）は `E1` ではなく `E2` として扱い、五線譜の下第一加線に配置されることを前提とします。

## 7. 楽曲データフォーマット (`src/lib/utils/songs/`)

楽曲データは `src/lib/utils/songs/` 以下にJSONファイルとして配置します。ファイル名がそのまま楽曲のキー（`SONGS` レコードのキー）になります。

### Songオブジェクトの構造

```jsonc
{
  "name": "曲名",          // 表示用の曲名 (string)
  "bpm": 80,               // テンポ (number)
  "timeSignature": [4, 4], // 拍子記号 [分子, 分母] (省略時は [4, 4] 扱い)
  "notes": [ ... ]         // 音符の配列 (Note[])
}
```

### Noteオブジェクトの構造

```jsonc
{
  "name":   "C3",   // 音名 (string, SPN記法だがベース記譜基準。§6参照)
  "midi":   36,     // MIDIノート番号 (number)
  "string": "A",    // 弦名 "E" | "A" | "D" | "G" (string)
  "fret":   3,      // フレット番号 0=開放弦 (number)
  "beat":   0,      // 曲の先頭からのビート位置 (number, 0始まり)
  "dur":    1       // 音符の長さ（ビート数）(number)
}
```

### 設計上の注意
- `beat` はオクターブ単位ではなくビート単位の絶対値（曲の先頭からの累積）。
- 小節番号・区切り線は `beat` と `timeSignature[0]`（分子）から `ScoreSection.svelte` が自動的に計算して描画するため、JSONに小節情報を記述する必要はない。
- 小節線のX座標は前後の音符の**中間点**（`beat_spacing / 2` だけ左）に配置する。`beat` が空の拍（休符扱い）があってもズレないようにするため、固定pxマージンではなくビート間隔から動的に計算すること。
