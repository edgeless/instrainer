import { midiToFreq } from '$lib/utils/pitch';

const STORAGE_KEY_INPUT = 'audio_input_device_id';
const STORAGE_KEY_OUTPUT = 'audio_output_device_id';
const STORAGE_KEY_VOLUME = 'audio_master_volume';

function loadSavedDeviceId(key: string): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined' || !localStorage.getItem) return '';
  return localStorage.getItem(key) ?? '';
}

function saveDeviceId(key: string, value: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined' || !localStorage.setItem) return;
  if (value) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

export const audioState = $state<{
  audioCtx: AudioContext | null;
  analyserNode: AnalyserNode | null;
  micStream: MediaStream | null;
  micSource: MediaStreamAudioSourceNode | null;
  pitchBuf: Float32Array | null;
  diffBuf: Float32Array | null;
  cmndBuf: Float32Array | null;
  micError: string | null;
  micGranted: boolean;
  devices: MediaDeviceInfo[];
  selectedInputId: string;
  selectedOutputId: string;
  recordedAudioUrl: string | null;
  masterVolume: number;
  latencyCompensationMs: number;
}>({
  audioCtx: null,
  analyserNode: null,
  micStream: null,
  micSource: null,
  pitchBuf: null,
  diffBuf: null,
  cmndBuf: null,
  micError: null,
  micGranted: false,
  devices: [],
  selectedInputId: loadSavedDeviceId(STORAGE_KEY_INPUT),
  selectedOutputId: loadSavedDeviceId(STORAGE_KEY_OUTPUT),
  recordedAudioUrl: null,
  masterVolume: Number(loadSavedDeviceId(STORAGE_KEY_VOLUME) || '1'),
  latencyCompensationMs: 250
});

// ブラウザ環境なら初期化（ユーザーアクション前なので suspended 状態で作成される）
if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    audioState.audioCtx = new AC();
    console.log("[Audio] Sample rate:", audioState.audioCtx.sampleRate);
    audioState.analyserNode = audioState.audioCtx.createAnalyser();
    audioState.analyserNode.fftSize = 4096;
    audioState.analyserNode.smoothingTimeConstant = 0.1;
    audioState.pitchBuf = new Float32Array(audioState.analyserNode.fftSize);
    const maxLagSize = Math.ceil(audioState.audioCtx.sampleRate / 30) + 1;
    audioState.diffBuf = new Float32Array(maxLagSize);
    audioState.cmndBuf = new Float32Array(maxLagSize);
  } catch (e) {
    console.warn("Eager AudioContext creation failed:", e);
  }
}

export function setMasterVolume(vol: number) {
  audioState.masterVolume = vol;
  saveDeviceId(STORAGE_KEY_VOLUME, vol.toString());
}

export async function requestMic(deviceIdOrEvent?: string | Event) {
  let deviceId = typeof deviceIdOrEvent === 'string' ? deviceIdOrEvent : undefined;
  if (!deviceId && audioState.selectedInputId) {
    deviceId = audioState.selectedInputId;
  }

  try {
    if (audioState.micStream) {
      audioState.micStream.getTracks().forEach(track => track.stop());
    }
    if (audioState.micSource) {
      audioState.micSource.disconnect();
      audioState.micSource = null;
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {})
      }
    };
    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      console.warn("[Audio] getUserMedia failed, retrying without deviceId...", e);
      if (deviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
      } else {
        throw e;
      }
    }
    audioState.micStream = stream;
    
    function initNodes() {
      if (!audioState.audioCtx) return;
      console.log("[Audio] initNodes called");
      audioState.analyserNode = audioState.audioCtx.createAnalyser();
      audioState.analyserNode.fftSize = 4096;
      audioState.analyserNode.smoothingTimeConstant = 0.1;
      audioState.pitchBuf = new Float32Array(audioState.analyserNode.fftSize);
      const maxLagSize = Math.ceil(audioState.audioCtx.sampleRate / 30) + 1;
      audioState.diffBuf = new Float32Array(maxLagSize);
      audioState.cmndBuf = new Float32Array(maxLagSize);
    }

    if (!audioState.audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioState.audioCtx = new AC();
      initNodes();
    }
    
    if (audioState.audioCtx.state === 'suspended') {
      await audioState.audioCtx.resume();
    }
    
    const acWithSink = audioState.audioCtx as unknown as AudioContextWithSink;
    const isE2E = typeof window !== 'undefined' && (window as any).__E2E__;

    if (!isE2E && audioState.selectedOutputId && typeof acWithSink.setSinkId === 'function') {
      try {
        await acWithSink.setSinkId(audioState.selectedOutputId);
        await new Promise(r => setTimeout(r, 200));
        if (audioState.audioCtx.state === 'suspended' || audioState.audioCtx.state === 'closed') {
          throw new Error("Renderer crashed");
        }
      } catch(e) {
        console.warn("setSinkId failed:", e);
        audioState.selectedOutputId = '';
        saveDeviceId(STORAGE_KEY_OUTPUT, '');
        try { await audioState.audioCtx.close(); } catch(err) {}
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioState.audioCtx = new AC();
        initNodes();
      }
    }
    
    audioState.micSource = audioState.audioCtx.createMediaStreamSource(stream);
    audioState.micSource.connect(audioState.analyserNode!);
    
    audioState.micGranted = true;
    audioState.micError = null;

    // await updateDevices(); // E2Eテストでのハングを避けるため一時的に無効化
    const track = stream.getAudioTracks()[0];
    if (track) {
      const settings = track.getSettings();
      if (settings.deviceId) {
        audioState.selectedInputId = settings.deviceId;
        saveDeviceId(STORAGE_KEY_INPUT, settings.deviceId);
      }
    }
  } catch (e: any) {
    console.error("[Audio] requestMic error:", e);
    audioState.micError = 'エラー: ' + e.message;
    audioState.micGranted = false;
  }
}

export async function updateDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  audioState.devices = devices.filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput');
}

export async function setOutputDevice(deviceId: string) {
  audioState.selectedOutputId = deviceId;
  saveDeviceId(STORAGE_KEY_OUTPUT, deviceId);
  const acWithSink = audioState.audioCtx as unknown as AudioContextWithSink;
  if (!acWithSink) return;
  if (typeof acWithSink.setSinkId === 'function') {
    try { 
      await acWithSink.setSinkId(deviceId); 
      // 非同期クラッシュをチェック
      await new Promise(r => setTimeout(r, 200));
      if (audioState.audioCtx?.state === 'suspended' || audioState.audioCtx?.state === 'closed') {
        throw new Error("Renderer crashed");
      }
    } catch (e) {
      console.warn("setSinkId error", e);
      audioState.selectedOutputId = '';
      saveDeviceId(STORAGE_KEY_OUTPUT, '');
      if (typeof window !== 'undefined') {
        console.warn("出力デバイスの変更に失敗したため、OS標準の出力にリセットしました。\n(※仮想オーディオデバイスなどで発生しやすいChromiumの既知の問題です)");
      }
      try { await acWithSink.setSinkId(''); } catch (err) {}
      
      // 完全にクラッシュした場合はコンテキストを閉じ、次回の再生等で再生成させる
      if (audioState.audioCtx?.state === 'suspended' || audioState.audioCtx?.state === 'closed') {
        try { await audioState.audioCtx.close(); } catch(err) {}
      }
    }
  }
}

export function playClick(accent: boolean) {
  const ac = audioState.audioCtx;
  if (!ac) return;
  const time = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.frequency.value = accent ? 1200 : 900;
  const baseGain = accent ? 0.3 : 0.15;
  gain.gain.setValueAtTime(baseGain * audioState.masterVolume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.start(time);
  osc.stop(time + 0.06);
}

// 進行中のデモ用オシレーターを管理するリスト
export const activeDemoOscillators: OscillatorNode[] = [];

export function stopDemoNotes() {
  for (const osc of activeDemoOscillators) {
    try {
      osc.stop();
      osc.disconnect();
    } catch (e) {
      // already stopped or disconnected
    }
  }
  activeDemoOscillators.length = 0;
}

export function playDemoNote(midi: number, durationSec: number, delaySec: number = 0) {
  const ac = audioState.audioCtx;
  if (!ac) return;

  const time = ac.currentTime + delaySec;
  const freq = midiToFreq(midi);

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  osc.connect(gain);
  gain.connect(ac.destination);

  // Attack, Decay, Sustain, Release (ADSR) envelope for a somewhat musical sound
  const attackTime = 0.02;
  const releaseTime = 0.05;
  const maxGain = 0.5 * audioState.masterVolume;

  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(maxGain, time + attackTime);

  // Slight decay
  gain.gain.exponentialRampToValueAtTime(maxGain * 0.8, time + attackTime + 0.1);

  // Release
  gain.gain.setValueAtTime(maxGain * 0.8, time + durationSec - releaseTime);
  gain.gain.linearRampToValueAtTime(0.001, time + durationSec);

  osc.start(time);
  osc.stop(time + durationSec + 0.1); // add a little buffer for release

  activeDemoOscillators.push(osc);

  // クリーンアップ
  osc.onended = () => {
    const idx = activeDemoOscillators.indexOf(osc);
    if (idx !== -1) {
      activeDemoOscillators.splice(idx, 1);
    }
    osc.disconnect();
    gain.disconnect();
  };
}
