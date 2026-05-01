import wave
import struct
import math
import sys

def midi_to_freq(midi):
    return 440 * math.pow(2, (midi - 69) / 12)

def generate_wav(filename, notes, bpm, sample_rate=48000):
    sec_per_beat = 60.0 / bpm

    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2) # 16-bit
        wav_file.setframerate(sample_rate)

        if not notes and filename != 'silent.wav':
            return
        
        last_note = notes[-1] if notes else {"beat": 0, "dur": 4}
        total_beats = last_note['beat'] + last_note['dur']

        count_in_beats = 4
        # 0ms latency padding for E2E precision
        latency_padding_samples = 0
        total_samples_with_count_in = int(((count_in_beats + total_beats) * sec_per_beat) * sample_rate)
        total_samples = latency_padding_samples + total_samples_with_count_in

        buffer = [0] * total_samples

        for note in notes:
            beat = note['beat']
            dur = note['dur']
            freq = note['freq']

            start_beat = count_in_beats + beat
            end_beat = start_beat + dur

            start_sample = latency_padding_samples + int((start_beat * sec_per_beat) * sample_rate)
            end_sample = latency_padding_samples + int((end_beat * sec_per_beat) * sample_rate)

            for i in range(start_sample, min(end_sample, total_samples)):
                t = (i - start_sample) / sample_rate
                sample = math.sin(2.0 * math.pi * freq * t)
                envelope = 1.0
                if (i - start_sample) < 0.05 * sample_rate:
                    envelope = (i - start_sample) / (0.05 * sample_rate)
                elif (end_sample - i) < 0.05 * sample_rate:
                    envelope = (end_sample - i) / (0.05 * sample_rate)

                buffer[i] = int(sample * envelope * 32767.0)

        if filename == 'silent.wav':
            # Keep buffer as all zeros
            pass

        for s in buffer:
            clamped_s = max(-32768, min(32767, s))
            wav_file.writeframes(struct.pack('h', clamped_s))

if __name__ == "__main__":
    target_sample_rate = 48000
    if len(sys.argv) > 1:
        try:
            target_sample_rate = int(sys.argv[1])
        except ValueError:
            pass

    print(f"Generating test WAV files with sample_rate={target_sample_rate}...")
    bpm = 60
    
    c_major_midi = [
        {"beat": 0,  "dur": 1, "midi": 36},  # C2
        {"beat": 1,  "dur": 1, "midi": 38},  # D2
        {"beat": 2,  "dur": 1, "midi": 40},  # E2
        {"beat": 3,  "dur": 1, "midi": 41},  # F2
        {"beat": 4,  "dur": 1, "midi": 43},  # G2
        {"beat": 5,  "dur": 1, "midi": 45},  # A2
        {"beat": 6,  "dur": 1, "midi": 47},  # B2
        {"beat": 7,  "dur": 1, "midi": 48},  # C3
        {"beat": 8,  "dur": 1, "midi": 47},  # B2
        {"beat": 9,  "dur": 1, "midi": 45},  # A2
        {"beat": 10, "dur": 1, "midi": 43},  # G2
        {"beat": 11, "dur": 1, "midi": 41},  # F2
        {"beat": 12, "dur": 1, "midi": 40},  # E2
        {"beat": 13, "dur": 1, "midi": 38},  # D2
        {"beat": 14, "dur": 2, "midi": 36},  # C2
    ]

    # Calibration offset: -108 cents to match Chromium fake audio pipeline shift (macOS only)
    calibration_ratio = 1.0
    if sys.platform == 'darwin':
        calibration_ratio = math.pow(2, -108 / 1200)
    
    # Perfect (Calibrated)
    notes_perfect = [{"beat": n["beat"], "dur": n["dur"], "freq": midi_to_freq(n["midi"]) * calibration_ratio} for n in c_major_midi]
    generate_wav('c_major_perfect.wav', notes_perfect, bpm, sample_rate=target_sample_rate)
    print("[OK] c_major_perfect.wav (Calibrated -108c)")

    # Good pitch (~15 cents sharp)
    notes_good_pitch = [{"beat": n["beat"], "dur": n["dur"], "freq": n["freq"] * math.pow(2, 15/1200)} for n in notes_perfect]
    generate_wav('c_major_good_pitch.wav', notes_good_pitch, bpm, sample_rate=target_sample_rate)
    print("[OK] c_major_good_pitch.wav")

    # Good timing (80ms late)
    late_beats = 0.08 / (60.0 / bpm)
    notes_good_timing = [{"beat": n["beat"] + late_beats, "dur": n["dur"], "freq": n["freq"]} for n in notes_perfect]
    generate_wav('c_major_good_timing.wav', notes_good_timing, bpm, sample_rate=target_sample_rate)
    print("[OK] c_major_good_timing.wav")

    # Silent
    generate_wav('silent.wav', [], bpm, sample_rate=target_sample_rate)
    print("[OK] silent.wav")

    print("Done!")
