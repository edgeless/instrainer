const STORAGE_KEY_INPUT = 'audio_input_device_id';
const STORAGE_KEY_OUTPUT = 'audio_output_device_id';

function loadSavedDeviceId(key: string): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(key) ?? '';
}

function saveDeviceId(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
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
  micError: string | null;
  micGranted: boolean;
  devices: MediaDeviceInfo[];
  selectedInputId: string;
  selectedOutputId: string;
  recordedAudioUrl: string | null;
}>({
  audioCtx: null,
  analyserNode: null,
  micStream: null,
  micSource: null,
  pitchBuf: null,
  micError: null,
  micGranted: false,
  devices: [],
  selectedInputId: loadSavedDeviceId(STORAGE_KEY_INPUT),
  selectedOutputId: loadSavedDeviceId(STORAGE_KEY_OUTPUT),
  recordedAudioUrl: null
});

export async function requestMic(deviceIdOrEvent?: string | Event) {
  let deviceId = typeof deviceIdOrEvent === 'string' ? deviceIdOrEvent : undefined;
  // If no explicit deviceId provided, try to use the saved one
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
      // If the saved device is no longer available, fallback to default
      if (deviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
      } else {
        throw e;
      }
    }
    audioState.micStream = stream;

    if (!audioState.audioCtx) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioState.audioCtx = new AudioContext({ sampleRate: 44100 });
      audioState.analyserNode = audioState.audioCtx.createAnalyser();
      audioState.analyserNode.fftSize = 2048;
      audioState.analyserNode.smoothingTimeConstant = 0.1;
      audioState.pitchBuf = new Float32Array(audioState.analyserNode.fftSize);
    }
    
    if (audioState.selectedOutputId && typeof (audioState.audioCtx as any).setSinkId === 'function') {
      try { await (audioState.audioCtx as any).setSinkId(audioState.selectedOutputId); } catch(e) {}
    }
    
    audioState.micSource = audioState.audioCtx.createMediaStreamSource(stream);
    audioState.micSource.connect(audioState.analyserNode!);
    audioState.micGranted = true;
    audioState.micError = null;

    await updateDevices();
    const track = stream.getAudioTracks()[0];
    if (track) {
      const settings = track.getSettings();
      if (settings.deviceId) {
        audioState.selectedInputId = settings.deviceId;
        saveDeviceId(STORAGE_KEY_INPUT, settings.deviceId);
      }
    }
  } catch (e: any) {
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
  const ac = audioState.audioCtx;
  if (!ac) return;
  if (typeof (ac as any).setSinkId === 'function') {
    try { await (ac as any).setSinkId(deviceId); } catch (e) {
      console.warn("setSinkId error", e);
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
  gain.gain.setValueAtTime(accent ? 0.3 : 0.15, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.start(time);
  osc.stop(time + 0.06);
}
