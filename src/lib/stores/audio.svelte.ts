import { browser } from '$app/environment';

export const audioState = $state({
  audioCtx: null as AudioContext | null,
  analyserNode: null as AnalyserNode | null,
  micStream: null as MediaStream | null,
  pitchBuf: null as Float32Array | null,
  inputDevices: [] as MediaDeviceInfo[],
  outputDevices: [] as MediaDeviceInfo[],
  selectedInputId: '',
  selectedOutputId: '',
  masterVolume: 0.8,
  latencyCompensationMs: 250,
  isAudioInitialized: false,
  error: ''
});

let activeOscillators: OscillatorNode[] = [];

export function getAudioTimeMs(): number {
  if (!browser || !audioState.audioCtx) return performance.now();
  return audioState.audioCtx.currentTime * 1000;
}

export async function initAudio() {
  if (!browser) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    audioState.inputDevices = devices.filter((d) => d.kind === 'audioinput');
    audioState.outputDevices = devices.filter((d) => d.kind === 'audiooutput');
    if (audioState.inputDevices.length > 0) audioState.selectedInputId = audioState.inputDevices[0].deviceId;
    if (audioState.outputDevices.length > 0) audioState.selectedOutputId = audioState.outputDevices[0].deviceId;
  } catch (err) {}
}

export async function requestMic() {
  if (!browser) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioState.micStream = stream;
    await initAudioCtx();
    const source = audioState.audioCtx!.createMediaStreamSource(stream);
    source.connect(audioState.analyserNode!);
    audioState.isAudioInitialized = true;
  } catch (err) {
    console.error(err);
    audioState.error = 'Mic error';
  }
}

export async function initAudioCtx() {
  if (!browser || audioState.audioCtx) return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  // Restore fixed 44100Hz for stable pitch detection.
  // Dynamic beat calculation in Transport.svelte will handle any clock drift.
  audioState.audioCtx = new AudioContextClass({ sampleRate: 44100 });
  
  audioState.analyserNode = audioState.audioCtx.createAnalyser();
  audioState.analyserNode.fftSize = 4096;
  audioState.pitchBuf = new Float32Array(audioState.analyserNode.fftSize);
}

export function playClick(freq = 1000, duration = 0.05) {
  if (!browser || !audioState.audioCtx) return;
  const ctx = audioState.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0.2 * audioState.masterVolume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playDemoNote(freq: number, startTime: number, duration: number) {
  if (!browser || !audioState.audioCtx) return;
  const ctx = audioState.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3 * audioState.masterVolume, startTime + 0.02);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
  activeOscillators.push(osc);
}

export function stopDemoNotes() {
  activeOscillators.forEach(osc => { try { osc.stop(); } catch(e) {} });
  activeOscillators = [];
}

export function setMasterVolume(v: number) { audioState.masterVolume = v; }
export function setLatency(ms: number) { audioState.latencyCompensationMs = ms; }
export async function setInputDevice(id: string) { audioState.selectedInputId = id; }
export async function setOutputDevice(id: string) { audioState.selectedOutputId = id; }
