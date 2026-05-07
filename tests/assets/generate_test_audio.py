import wave
import struct
import math
import sys
import os

def midi_to_freq(midi):
    return 440 * math.pow(2, (midi - 69) / 12)

def generate_wav(filename, notes, bpm, sample_rate=48000):
    sec_per_beat = 60.0 / bpm

    # Ensure output directory exists
    output_path = os.path.join(os.path.dirname(__file__), filename)

    with wave.open(output_path, 'w') as wav_file:
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
                # Smooth attack/release to avoid pops
                if (i - start_sample) < 0.05 * sample_rate:
                    envelope = (i - start_sample) / (0.05 * sample_rate)
                elif (end_sample - i) < 0.05 * sample_rate:
                    envelope = (end_sample - i) / (0.05 * sample_rate)

                buffer[i] = int(sample * envelope * 32767.0 * 0.9)

        if filename == 'silent.wav':
            # Keep buffer as all zeros
            pass

        # Write to file
        for sample in buffer:
            wav_file.writeframes(struct.pack('<h', sample))

if __name__ == '__main__':
    target_sample_rate = int(sys.argv[1]) if len(sys.argv) > 1 else 44100
    print(f"Generating test WAV files with sample_rate={target_sample_rate}...")
    bpm = 60
    
    c_major_midi = [
        {"beat": 0,  "dur": 4, "midi": 36},  # C2 (Make first note longer for calibration)
        {"beat": 8,  "dur": 1, "midi": 38},  # D2
        {"beat": 9,  "dur": 1, "midi": 40},  # E2
        {"beat": 10, "dur": 1, "midi": 41},  # F2
        {"beat": 11, "dur": 1, "midi": 43},  # G2
        {"beat": 12, "dur": 1, "midi": 45},  # A2
        {"beat": 13, "dur": 1, "midi": 47},  # B2
        {"beat": 14, "dur": 2, "midi": 48},  # C3
    ]

    # Perfect
    notes_perfect = [{"beat": n["beat"], "dur": n["dur"], "freq": midi_to_freq(n["midi"])} for n in c_major_midi]
    generate_wav('c_major_perfect.wav', notes_perfect, bpm, sample_rate=target_sample_rate)
    print(f"[OK] c_major_perfect.wav")

    # Silent
    generate_wav('silent.wav', [], bpm, sample_rate=target_sample_rate)
    print(f"[OK] silent.wav")

    print("Done!")
