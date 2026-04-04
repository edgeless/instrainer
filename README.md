# Fretless Training

SvelteKitで構築された、モダンなWebベースのフレットレスベース練習用アプリケーションです。リアルタイムのピッチ検出、波形の可視化、セッションの分析機能を提供することで、プレイヤーのイントネーション習得をサポートします。

## 主な機能
- **リアルタイムピッチ検出**: Web Audio APIを使用し、楽器のピッチをリアルタイムで検出して分析します。
- **波形とピッチの可視化**: ターゲットピッチに対する現在のイントネーションを視覚的なフィードバックとして表示します。
- **調整可能なメトロノーム (BPM)**: 練習中にテンポを動的に変更できます。
- **オーディオデバイスの選択**: 好みの入力デバイス（オーディオインターフェイスなど）と出力デバイスを簡単に選択できます。
- **セッション分析**: スコアリングシステムによるパフォーマンスの詳細な分析を提供します。

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
- `src/routes`: SvelteKitのページとレイアウト

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
