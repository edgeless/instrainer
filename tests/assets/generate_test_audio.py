import wave
import struct
import math
import sys
import os
import random

# Test Audio Asset Generator for Fretless Training
# 
# Generates WAV files at a specific sample rate for E2E evaluation.
# - Perfect: No pitch/timing offset.
# - Bad Pitch: +100 cents (1 semitone) offset for Note 1+.
# - Bad Timing: +500ms (0.5 beats) shift for Note 1+.
# - Silence: No audio content.
# 
# Note 0 (C2) is always kept perfect for calibration synchronization.

def midi_to_freq(midi):
    return 440 * math.pow(2, (midi - 69) / 12)

def generate_wav(filename, notes, bpm, sample_rate=48000):
    sec_per_beat = 60.0 / bpm
    output_path = os.path.join(os.path.dirname(__file__), filename)

    with wave.open(output_path, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        if not notes and filename != 'silent.wav':
            return
        
        last_note = notes[-1] if notes else {"beat": 0, "dur": 4}
        total_beats = last_note['beat'] + last_note['dur']
        count_in_beats = 4
        # Margin for shifts
        max_beat = count_in_beats + total_beats + 2.0 
        total_samples = int((max_beat * sec_per_beat) * sample_rate)
        buffer = [0] * total_samples

        for note in notes:
            beat = note['beat']
            dur = note['dur']
            freq = note['freq']
            
            start_beat = count_in_beats + beat
            end_beat = start_beat + dur
            start_sample = int((start_beat * sec_per_beat) * sample_rate)
            end_sample = int((end_beat * sec_per_beat) * sample_rate)

            for i in range(start_sample, min(end_sample, total_samples)):
                t = (i - start_sample) / sample_rate
                # Pure sine wave with a small envelope for smooth transitions
                sample = math.sin(2.0 * math.pi * freq * t)
                envelope = 1.0
                if (i - start_sample) < 0.05 * sample_rate:
                    envelope = (i - start_sample) / (0.05 * sample_rate)
                elif (end_sample - i) < 0.05 * sample_rate:
                    envelope = (end_sample - i) / (0.05 * sample_rate)
                buffer[i] = int(sample * envelope * 32767.0 * 0.9)

        for sample in buffer:
            wav_file.writeframes(struct.pack('<h', sample))

if __name__ == '__main__':
    target_sample_rate = int(sys.argv[1]) if len(sys.argv) > 1 else 44100
    bpm = 60
    
    # C Major Scale Pattern (MIDI 36 to 48)
    c_major_midi = [
        {"beat": 0,  "dur": 4, "midi": 36}, 
        {"beat": 8,  "dur": 1, "midi": 38}, 
        {"beat": 9,  "dur": 1, "midi": 40}, 
        {"beat": 10, "dur": 1, "midi": 41}, 
        {"beat": 11, "dur": 1, "midi": 43}, 
        {"beat": 12, "dur": 1, "midi": 45}, 
        {"beat": 13, "dur": 1, "midi": 47}, 
        {"beat": 14, "dur": 2, "midi": 48}, 
    ]

    # 1. Perfect
    notes_perfect = [{"beat": n["beat"], "dur": n["dur"], "freq": midi_to_freq(n["midi"])} for n in c_major_midi]
    generate_wav('c_major_perfect.wav', notes_perfect, bpm, sample_rate=target_sample_rate)

    # 2. Bad Pitch (+100 cents)
    pitch_offset = math.pow(2, 100/1200)
    notes_bad_pitch = []
    for i, n in enumerate(c_major_midi):
        f = midi_to_freq(n["midi"])
        if i > 0: f *= pitch_offset 
        notes_bad_pitch.append({"beat": n["beat"], "dur": n["dur"], "freq": f})
    generate_wav('c_major_bad_pitch.wav', notes_bad_pitch, bpm, sample_rate=target_sample_rate)

    # 3. Bad Timing (+500ms shift)
    notes_bad_timing = []
    for i, n in enumerate(c_major_midi):
        b = n["beat"]
        if i > 0: b += 0.5 
        notes_bad_timing.append({"beat": b, "dur": n["dur"], "freq": midi_to_freq(n["midi"])})
    generate_wav('c_major_bad_timing.wav', notes_bad_timing, bpm, sample_rate=target_sample_rate)

    # 4. Silence
    generate_wav('silent.wav', [], bpm, sample_rate=target_sample_rate)
    
    print(f"Generated evaluation assets at {target_sample_rate}Hz.")
