# コーディングエージェント向けガイドライン (AGENTS.md)

AIコーディングエージェント向けの文書です。このドキュメントでは、`Fretless Training` アプリケーションを開発・修正する際のアーキテクチャパターン、コーディング規約、およびルールについて説明します。
実装を変更する前に、必ずこのファイルを注意深く読んでください。

## 1. 目的とドメイン
このアプリはリアルタイムのフレットレスベース練習用アプリケーションです。特にWeb Audio APIの統合やピッチ検出ループまわりのパフォーマンスが非常に重要です。音声処理中にメインスレッドをブロックする処理を避けてください。

## 2. 技術スタックと状態管理
- **フレームワーク**: Svelte 5を使用するSvelteKit。本番環境（デプロイ）用には `@sveltejs/adapter-node` を使用します。
- **状態管理**: **Svelte 5 Runes** (`$state`, `$derived`, `$effect`, `$props`) のみを排他的に使用します。Svelte 4互換のストアのサブスクリプション(`$store`)や、古い `export let` 構文のPropsは絶対に使わないでください。
- **スタイリング**: 標準的なCSS。Svelteコンポーネント内のスコープされた `<style>` ブロックを優先して使用します。ユーザーから明示的な要求がない限り、Tailwindは使用しないでください。

## 3. アーキテクチャ
- **コンポーネント (`src/lib/components`)**: UI要素は機能ごとに構造化されています。
  - `Header.svelte`: BPMやリピート回数、オーディオデバイスの選択を担当。RepeatとBPMはスクロール（マウスホイール）で増減可能。
  - `PitchMonitor.svelte`: ピッチと波形をリアルタイムで可視化。
  - `ScoreSection.svelte`: 五線譜・タブ譜の描画。4小節/行の多段表示に対応し、「両方」モードでは五線譜行とタブ譜行を交互に配置する。`buildStaffRows()` / `buildTabRows()` が行ごとのHTML文字列配列を返し、`renderScore()` が viewMode に応じて合成する。リピート中（`repeatCount > 1`）は右上にループインジケーター（n/m）を表示する。
  - `ScorePanel.svelte`: セッションスコア（正確度・偏差）とノート履歴ドットの表示。リピート時は最後に演奏した周回の結果を表示する。
  - `Transport.svelte`: 再生コントロール。
- **ストア・状態 (`src/lib/stores`)**: `$state`を利用したクラスやクロージャを含む `.svelte.ts` ファイルを使用します。
  - `audio.svelte.ts`: Web Audio APIロジック、デバイス選択、マイクのアクセス許可。`localStorage` を使用して選択した入力・出力デバイスを永続化する。
  - `player.svelte.ts`: メトロノーム、再生状態、およびリピート設定。`repeatCount` (総周回数) と `currentLoop` (現在何周目か) を保持する。
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
- `beat` はオクターブ単位ではなくビート単位の絶対値（曲の先頭からの累積）。繰り返し区間でも `beat` はリセットせず連続した値を使うこと（例: 16拍の曲を2周繰り返す場合、2周目は `beat: 16` から始まる）。
- 小節番号・区切り線は `beat` と `timeSignature[0]`（分子）から `ScoreSection.svelte` が自動的に計算して描画するため、JSONに小節情報を記述する必要はない。
- 小節線と音符のX座標は**統合レイアウトエンジン**が一括計算する。ビート比例位置を理想値としつつ、要素間の最低距離（音符⇔音符: 22px、音符⇔小節線: 16px）を制約として適用する。はみ出し時はスケーリングで収める。

### 譜面描画のアーキテクチャ (`ScoreSection.svelte`)
- `MEASURES_PER_ROW = 4` を基本単位として、五線譜・タブ譜をそれぞれ複数行に分割描画する。
- `buildStaffRows(W)` / `buildTabRows(W)` は行ごとのHTML文字列の配列 (`string[]`) を返す純粋関数。DOM操作は `renderScore()` のみが行う。
- ヘ音記号・拍子記号は五線譜の初行のみに表示する。2行目以降は省略し、描画領域の `startX` を小さくして音符の余白を揃える。
- 「両方」モード (`viewMode === 'both'`) では、行インデックスごとに五線譜SVG → タブ譜HTMLを交互に配置する。

### 音符の形状描画ルール
`note.dur` の値に応じて符頭・符幹・旗・付点を描き分ける。

| `dur` | 形状 | 符頭 | 符幹 | 旗 | 付点 |
|-------|------|------|------|-----|------|
| 0.25 | 16分音符 | 塗り潰し | あり | 2本 | なし |
| 0.5 | 8分音符 | 塗り潰し | あり | 1本 | なし |
| 0.75 | 付点8分音符 | 塗り潰し | あり | 1本 | あり |
| 1 | 4分音符 | 塗り潰し | あり | なし | なし |
| 1.5 | 付点4分音符 | 塗り潰し | あり | なし | あり |
| 2 | 2分音符 | 白抜き | あり | なし | なし |
| 3 | 付点2分音符 | 白抜き | あり | なし | あり |
| 4 | 全音符 | 白抜き | なし | なし | なし |

## 8. デプロイと本番環境
- **環境**: GCP Cloud Run 上のコンテナとして動作します。
- **Adapter**: `@sveltejs/adapter-node` を使用。ビルド結果は `./build` ディレクトリに出力されます。
- **コンテナ設定**:
  - `Dockerfile`: マルチステージビルド（`node:22-slim`）を使用します。
  - **ポート**: Cloud Run の仕様に合わせ、環境変数 `PORT` (デフォルト 8080) でリッスンします。
- **デプロイコマンド（フルオプション）**:
  無料枠を維持するためのリソース制限を含めた推奨コマンド：
  ```bash
  gcloud run deploy fretless-training \
    --source . \
    --region asia-northeast1 \
    --project warabimochi-kinako \
    --cpu 1 \
    --memory 512Mi \
    --max-instances 1 \
    --allow-unauthenticated \
    --quiet
  ```
- **設定の確認方法**:
  現在のサービス設定（メモリ、CPU、インスタンス数など）を確認するコマンド：
  ```bash
  gcloud run services describe fretless-training \
    --region asia-northeast1 \
    --project warabimochi-kinako
  ```
- **制限の考え方**: 無料枠（Free Tier）を維持するため、最大インスタンス数は `1`、メモリは `512Mi` に制限して運用します。CPU割り当てはデフォルト（リクエスト処理時のみ）を推奨します。
