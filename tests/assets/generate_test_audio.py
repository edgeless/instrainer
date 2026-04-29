import wave
import struct
import math

def midi_to_freq(midi):
    return 440 * math.pow(2, (midi - 69) / 12)

def generate_wav(filename, notes, bpm, sample_rate=44100):
    sec_per_beat = 60.0 / bpm

    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2) # 16-bit
        wav_file.setframerate(sample_rate)

        if not notes:
            return
        last_note = notes[-1]
        total_beats = last_note['beat'] + last_note['dur']

        count_in_beats = 4
        # 250ms latency padding to match app's default latencyCompensationMs (250ms)
        latency_padding_samples = int(0.25 * sample_rate)
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

        for s in buffer:
            clamped_s = max(-32768, min(32767, s))
            wav_file.writeframes(struct.pack('h', clamped_s))

bpm = 80

# Notes from c_major.json - using MIDI values for correct frequencies
# AGENTS.md Rule 6: bass written pitch, so MIDI 36 = C2 (65.41 Hz)
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

# Convert MIDI to freq
c_major_notes_perfect = [
    {"beat": n["beat"], "dur": n["dur"], "freq": midi_to_freq(n["midi"])}
    for n in c_major_midi
]

print("Generating test WAV files with correct MIDI frequencies...")
for n in c_major_notes_perfect:
    print(f"  beat={n['beat']} dur={n['dur']} freq={n['freq']:.2f} Hz")

generate_wav("c_major_perfect.wav", c_major_notes_perfect, bpm)
print("✔ c_major_perfect.wav")

# Good pitch: ~15 cents sharp
c_major_notes_good_pitch = [
    {"beat": n["beat"], "dur": n["dur"], "freq": n["freq"] * math.pow(2, 15/1200)}
    for n in c_major_notes_perfect
]
generate_wav("c_major_good_pitch.wav", c_major_notes_good_pitch, bpm)
print("✔ c_major_good_pitch.wav")

# Good timing: ~80ms late (0.1067 beats at 80 BPM)
late_beats = 0.08 / (60.0 / bpm)  # 80ms in beats
c_major_notes_timing_good = [
    {"beat": n["beat"] + late_beats, "dur": n["dur"], "freq": n["freq"]}
    for n in c_major_notes_perfect
]
generate_wav("c_major_good_timing.wav", c_major_notes_timing_good, bpm)
print("✔ c_major_good_timing.wav")

print("\nDone! WAV structure: [250ms padding] [3s count-in] [12s notes]")
