<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { generateSong } from '$lib/utils/ai';
  import { setSong } from '$lib/stores/player.svelte';

  let { isOpen = $bindable(false) } = $props<{ isOpen?: boolean }>();

  let prompt = $state("Cメジャーのウォーキングベースを8小節で作って");
  let isGenerating = $state(false);
  let errorMsg = $state<string | null>(null);

  // Download and generation progress
  let progressText = $state("Ready");
  let progressPercent = $state(0);

  function closeModal() {
    if (!isGenerating) {
      isOpen = false;
    }
  }

  async function onGenerate() {
    if (!prompt.trim()) return;

    isGenerating = true;
    errorMsg = null;
    progressText = "モデルをロード中...";
    progressPercent = 0;

    try {
      const song = await generateSong(prompt, (info) => {
        if (info.status === 'progress' && info.progress !== undefined) {
            progressPercent = info.progress;
            progressText = `モデルをダウンロード中 (${Math.round(info.progress)}%) : ${info.file || ''}`;
        } else if (info.status === 'ready') {
            progressPercent = 100;
            progressText = `モデルロード完了: ${info.file || ''}`;
        } else if (info.status === 'initiate') {
            progressPercent = 0;
            progressText = `ロード準備中: ${info.file || ''}`;
        } else if (info.status === 'generating') {
            progressPercent = 100;
            progressText = "AIが楽曲データを生成中...";
        } else if (info.status === 'download') {
            progressText = `ダウンロード開始: ${info.file || ''}`;
        }
      });

      setSong(song);
      isOpen = false;
      prompt = ""; // reset
    } catch (e) {
      console.error(e);
      errorMsg = (e as Error).message || "生成に失敗しました";
    } finally {
      isGenerating = false;
    }
  }

</script>

{#if isOpen}
  <div class="modal-backdrop" transition:fade={{duration: 200}}>
    <div class="modal" transition:scale={{duration: 300, start: 0.95}}>
      <header>
        <h2>AI曲データ生成 (WebGPU)</h2>
        <button class="close-btn" onclick={closeModal} disabled={isGenerating}>×</button>
      </header>

      <div class="content">
        <p class="description">
          プロンプトを入力して、AI(Bonsai-1.7B)にベースラインを生成させます。<br>
          <small class="warn">※初回実行時は約1GBのモデルをブラウザにダウンロードするため時間がかかります。</small>
        </p>

        <textarea
          bind:value={prompt}
          placeholder="例: Eのブルース進行で、簡単な8分音符のフレーズを作って"
          disabled={isGenerating}
        ></textarea>

        {#if errorMsg}
          <div class="error">{errorMsg}</div>
        {/if}

        {#if isGenerating}
          <div class="progress-box">
            <div class="progress-text">{progressText}</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: {progressPercent}%"></div>
            </div>
          </div>
        {/if}
      </div>

      <footer>
        <button class="btn-cancel" onclick={closeModal} disabled={isGenerating}>キャンセル</button>
        <button class="btn-generate" onclick={onGenerate} disabled={isGenerating || !prompt.trim()}>
          {isGenerating ? '生成中...' : '生成'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 90%; max-width: 500px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: flex; flex-direction: column;
  }

  header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 16px;
    color: var(--accent);
  }

  .close-btn {
    background: none; border: none; color: var(--muted);
    font-size: 24px; cursor: pointer;
    line-height: 1; padding: 0;
  }
  .close-btn:hover:not(:disabled) { color: #fff; }

  .content {
    padding: 20px;
    display: flex; flex-direction: column; gap: 16px;
  }

  .description {
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 13px; color: var(--text);
    margin: 0; line-height: 1.5;
  }
  .warn { color: var(--warn); }

  textarea {
    width: 100%; height: 100px;
    background: var(--panel2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 12px;
    color: #fff;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 14px;
    resize: none;
    box-sizing: border-box;
  }
  textarea:focus { border-color: var(--accent); outline: none; }
  textarea:disabled { opacity: 0.5; }

  .error {
    color: var(--danger);
    font-size: 12px;
    padding: 8px;
    background: rgba(249,64,64,0.1);
    border-left: 2px solid var(--danger);
  }

  .progress-box {
    display: flex; flex-direction: column; gap: 8px;
  }
  .progress-text {
    font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted);
    word-break: break-all;
  }
  .progress-bar-bg {
    width: 100%; height: 6px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%; background: var(--accent); transition: width 0.1s linear;
  }

  footer {
    display: flex; justify-content: flex-end; gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
  }

  button {
    font-family: 'Noto Sans JP', sans-serif; font-size: 14px;
    padding: 8px 16px; border-radius: 4px; cursor: pointer;
    border: none; transition: all 0.2s;
  }
  .btn-cancel {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
  }
  .btn-cancel:hover:not(:disabled) { background: var(--panel2); color: #fff; }
  .btn-generate {
    background: var(--accent); color: #000; font-weight: bold;
  }
  .btn-generate:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(200,245,58,0.2); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }

</style>
