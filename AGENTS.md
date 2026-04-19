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
  - `Header.svelte`: BPMやリピート回数、オーディオデバイスの選択、およびデモ再生のトグルを担当。RepeatとBPMはスクロール（マウスホイール）で増減可能。
  - `PitchMonitor.svelte`: ピッチと波形をリアルタイムで可視化。
  - `ScoreSection.svelte`: 五線譜・タブ譜の描画。4小節/行の多段表示に対応し、「両方」モードでは五線譜行とタブ譜行を交互に配置する。`buildStaffRows()` / `buildTabRows()` が行ごとのHTML文字列配列を返し、`renderScore()` が viewMode に応じて合成する。リピート中（`repeatCount > 1`）は右上にループインジケーター（n/m）を表示する。
  - `ScorePanel.svelte`: セッションスコア（正確度・偏差）とノート履歴ドットの表示。リピート時は最後に演奏した周回の結果を表示する。
  - `Transport.svelte`: 再生コントロール。`requestAnimationFrame` を用いた連続的な進捗バーアニメーション、絶対時間ベースの `setTimeout` スケジューリングによるビートのドリフト補正、およびデモ用音源のスケジューリング再生を実装している。再生時の基準時刻は `playerState.playbackStartTimeMs` に保持する。`MediaRecorder` による音声の記録・再生・ダウンロード機能もここで制御する（カウントイン等の遅延再生には `setTimeout` を使用しており、精度はベストエフォートである点に注意）。
  - `FreeScoreArea.svelte`: フリー採点モード時の中央表示エリア。音名表示をリアルタイムで行う。
  - `FreeScorePanel.svelte`: フリー採点モード時の統計パネル（平均偏差、安定度など）。
- **ストア・状態 (`src/lib/stores`)**: `$state`を利用したクラスやクロージャを含む `.svelte.ts` ファイルを使用します。
  - `audio.svelte.ts`: Web Audio APIロジック、デバイス選択、マイクのアクセス許可、マスター音量（`masterVolume`）の管理。`localStorage` を使用して選択した入力・出力デバイス、およびマスター音量を永続化する。録音データ（`recordedAudioUrl`）の保持や、デモ再生時のサイン波オシレーター (`activeDemoOscillators`) の管理も行う。
  - `player.svelte.ts`: メトロノーム、再生状態、リピート設定、およびインポート曲の保持。`localStorage` を使用してインポートした曲を永続化する。
  - `score.svelte.ts`: スコア計算やセッション指標を保存するロジック。
- **ユーティリティ (`src/lib/utils`)**: 副作用のない（純粋な）TypeScript関数群。
  - `pitch.ts`: セント値、周波数、ノートの計算。
  - `ireal.ts`: iReal Proの `irealb://` URIを解析し、`Song` オブジェクトに変換する。難読化解除アルゴリズムを含む。

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
- **アニメーション**: 進捗バーなどUIアニメーションを実装・更新する際は、`requestAnimationFrame` を用いて連続的・滑らかに描画するアプローチを使用してください。CSS `transition` との併用は二重アニメーションが発生するため避け、どちらか一方に統一してください。また、進行状況を示すカーソルなどは特定の要素にジャンプするのではなく、再生時間に従って滑らかに補間移動させてください。

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
- 小節線と音符のX座標は**統合レイアウトエンジン**が一括計算する。ビート比例位置を理想値としつつ、要素間の最低距離（音符⇔音符: 28px、音符⇔小節線: 32px）を制約として適用する。はみ出し時はスケーリングで収める。

### 譜面描画のアーキテクチャ (`ScoreSection.svelte`)
- `MEASURES_PER_ROW = 4` を基本単位として、五線譜・タブ譜をそれぞれ複数行に分割描画する。
- **統合レイアウトエンジン**: `getRowLayout(W, row)` が行ごとのX座標計算を一括で行う。五線譜（SVG）とタブ譜（HTML/絶対座標）でこの計算結果を共有することで、上下の音符位置を完全に同期させる。
- `buildStaffRows(W)` / `buildTabRows(W)` は行ごとのHTML文字列の配列 (`string[]`) を返す純粋関数。DOM操作は `renderScore()` のみが行う。
- **臨時記号・ラベル**: `note.name` に基づき、五線譜上にシャープ（♯）やフラット（♭）を自動描画する。音名ラベルからはオクターブ番号を除去して表示する（例: A2 → A）。
- **キー（調）の表示**: `playerState.song.key` が存在する場合、初行のヘ音記号付近に大きく表示する。
- ヘ音記号・拍子記号は五線譜の初行のみに表示する。2行目以降は省略し、描画領域の `startX` を小さくして音符の余白を揃える。
- 「両方」モード (`viewMode === 'both'`) では、行インデックスごとに五線譜SVG → タブ譜HTMLを交互に配置する。
- 演奏された音符は、`scoreState.noteResults` の評価結果（perfect, good, ok, miss）に応じて、対応する色（それぞれ `--accent2`, `--accent`, `--warn`, `--danger`）でハイライト表示されます。さらに、打鍵タイミングが早い/遅い場合には、`timingDiffMs` に基づいて音符のX座標を左右にオフセットさせることで視覚的にブレを表現します。

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
  環境変数 `GCP_PROJECT` および `GCP_REGION` を使用して、柔軟にターゲットを切り替え可能です。
  ```bash
  gcloud run deploy fretless-training \
    --source . \
    --region ${GCP_REGION} \
    --project ${GCP_PROJECT} \
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
    --region ${GCP_REGION} \
    --project ${GCP_PROJECT}
  ```
- **制限の考え方**: 無料枠（Free Tier）を維持するため、最大インスタンス数は `1`、メモリは `512Mi` に制限して運用します。CPU割り当てはデフォルト（リクエスト処理時のみ）を推奨します。

## 9. セキュリティ
- **サプライチェーン攻撃対策**: GMO Flatt Security が提供する **Takumi Guard** を導入しています。
- **仕組み**: `.npmrc` で `registry=https://npm.flatt.tech/` を指定することで、npmパッケージのインストール前に悪意あるコードの混入をリアルタイムでブロックします。
- **運用の注意**: Takumi Guard は読み取り専用プロキシです。`npm publish` や `npm login` などの書き込み操作を行う場合は、個別に `--registry=https://registry.npmjs.org/` を指定する必要があります。

## 10. iReal Pro 取込機能の実装

iReal Proの `irealb://` URIを解析し、動的に練習曲として提供する機能を備えています。

### 仕組み
1. **URI解析**: `src/lib/utils/ireal.ts` が、URLエンコードされた文字列を分解し、独自の難読化（50文字ごとのシークエンス入れ替え）を解除します。
2. **音符生成**: 抽出されたコード進行（ルート音）をもとに、小節線と拍子に合わせて `Note[]` を自動生成します。フレット割り当ては低フレット優先の簡易ロジックで行います。
3. **ストアへのセット**: 生成された `Song` オブジェクトを `playerState.importedSong` に保存し、`currentSongKey` を `'imported'` に設定します。
4. **永続化**: インポートされた曲データは `localStorage` にJSON形式で保存され、ブラウザのリロード後も即座に再選択可能です。

### 注意事項
- 初期実装では**コードのルート音のみ**を生成します。
- 楽曲のキー（Eb, G等）をURIから自動抽出し、スコアに表示します。
- iReal Pro特有の記号（セクションマーカー、拍子記号、空白セル、エンディング番号）は解析前にクリーニングされます。
- `Kcl`（小節リピート）記号に対応しており、直前の小節のコード進行を複製します。
- 拍子はデフォルトで `4/4` として扱われます（iReal側で拍子が指定されている場合でも、現在は固定）。
- インポートボタンは `Header.svelte` の「IRB」ボタンとして実装されています。

## 11. フリー採点モードの実装

特定の楽曲データに基づかない、自由演奏中のピッチ精度をリアルタイムで計測・表示する機能です。

### 仕組み
1. **モード切替**: `Header.svelte` の「FREE」ボタン（`playerState.isFreeMode`）で切り替えます。
2. **リアルタイム解析**: `PitchMonitor.svelte` のメインループ内で、フリーモードかつ録音中に以下の統計を毎フレーム計算します。
   - **平均偏差 (Avg Deviation)**: 最寄りの半音に対するセント値の逐次平均。
   - **ピッチ安定度 (Stability)**: `tolerance`（許容範囲）内に収まっているサンプルの累積割合。
   - **スライド検知**: ピッチの急激な変化（25c/frame以上）を検知し、その区間を統計から自動的に除外します。
   - ※録音された音声は、フリーモードでの「再生」時にメトロノームの連続再生とともに同期再生されます。
3. **データ共有**: 検出された周波数は `scoreState.detectedFreq` に保存され、`FreeScoreArea.svelte` 等の他コンポーネントで再利用されます（重複したピッチ検出処理を避けるため）。
4. **結果の確定**: 録音停止時に `Transport.svelte` の `finalizeFreeModeSession()` が全履歴から最終的な平均・安定度を再計算し、高精度な統計を確定させます。
5. **結果表示**: `ResultOverlay.svelte` がフリーモード専用の統計サマリー（安定度、平均偏差、除外サンプル数など）を表示します。

## 12. コーディング規約の補足：共通ロジックの利用

### 判定ロジック (`getGrade`, `getTimingGrade`, `getCombinedGrade`)
イントネーションの正確さ判定（perfect, good, ok, miss）を行う際は、必ず `src/lib/utils/pitch.ts` の `getGrade(absCents, tolerance)` を使用してください。タイミングの判定には `getTimingGrade` を、総合判定には `getCombinedGrade` を使用します。個別のコンポーネントで不等式による判定を直接記述することは避けてください。

### XSS対策 (`escapeHtml`)
ユーザー入力を含む動的な文字列（曲名、音名、iRealデータ等）をSVGの `<text>` や HTMLのタグ内に直接描画する際は、必ず `src/lib/utils/security.ts` の `escapeHtml()` を通してください。

## 13. テスト

本プロジェクトは以下の2種類のテスト環境を用意しています。

- **ユニットテスト** (`tests/unit/`): ユーティリティ関数等の純粋なロジックをテストします。`node:test` および `node:assert` を使用して記述し、**Bun** で高速に実行します。
- **E2Eテスト** (`tests/e2e/`): ブラウザを介したUI/UXのテストです。**Playwright** を使用して記述します。

テストを追加・修正した際は、以下のコマンドで実行して確認してください：
```bash
npm run test:unit  # ユニットテストのみ
npm run test:e2e   # E2Eテストのみ
npm run test       # 両方を実行
```

また、ローカルでクリーンなコンテナ環境を利用する場合は `compose.test.yaml` を使用できます：
```bash
docker compose -f compose.test.yaml run unit
docker compose -f compose.test.yaml run e2etest
```

## 14. オーディオデバイス・ブラウザ互換性の注意点

### Web Audio API と仮想デバイス (Voicemeeter等) の競合
Voicemeeter Banana 等の仮想オーディオミキサーを使用している環境では、Web Audio API の挙動が不安定になり、ブラウザのオーディオレンダラがクラッシュ（`suspended` または `closed` 状態へ強制遷移）するケースがあります。以下の点に注意してください。

- **サンプリングレートのハードコード禁止**: `new AudioContext({ sampleRate: 44100 })` のようにレートを固定すると、OS側や仮想ドライバ側の設定とミスマッチが起きた際にレンダラがクラッシュします。原則として `sampleRate` は指定せず、ブラウザ（OS）の既定値を使用するようにしてください。
- **`setSinkId` のエラーハンドリング**: スピーカーなどの出力先をプログラムから切り替える `setSinkId` は、一部の仮想デバイスにおいて成功を返した直後にレンダラを停止させることがあります。この操作は必ず `try-catch` で囲み、失敗してもアプリケーション全体が停止しないように考慮してください。
- **デバッグ指針**: 開発者ツールの Console に "The AudioContext encountered an error..." というメッセージが出た場合、多くは上記のようなハードウェア/ドライバ層の競合が原因です。コードの例外ではないため、`onstatechange` などのイベントで状態を監視して、適切にユーザーへ通知することが推奨されます。

