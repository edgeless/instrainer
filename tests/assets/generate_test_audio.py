import wave
import struct
import math
import sys
import os
import random

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
        # Calculate total samples more safely for potential beat shifts
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

    # Perfect
    notes_perfect = [{"beat": n["beat"], "dur": n["dur"], "freq": midi_to_freq(n["midi"])} for n in c_major_midi]
    generate_wav('c_major_perfect.wav', notes_perfect, bpm, sample_rate=target_sample_rate)

    # Bad Pitch (+100 cents offset = 1 semitone sharp)
    # OKが15cなので、100cあれば確実に全音ミスになる
    pitch_offset = math.pow(2, 100/1200)
    notes_bad_pitch = []
    for i, n in enumerate(c_major_midi):
        f = midi_to_freq(n["midi"])
        if i > 0: f *= pitch_offset 
        notes_bad_pitch.append({"beat": n["beat"], "dur": n["dur"], "freq": f})
    generate_wav('c_major_bad_pitch.wav', notes_bad_pitch, bpm, sample_rate=target_sample_rate)

    # Bad Timing (+500ms shift for Note 1+)
    # 500msは200ms(OK境界)を大きく超えるため確実に miss になる
    notes_bad_timing = []
    for i, n in enumerate(c_major_midi):
        b = n["beat"]
        if i > 0: b += 0.5 # 一律で0.5拍（500ms）遅らせる
        notes_bad_timing.append({"beat": b, "dur": n["dur"], "freq": midi_to_freq(n["midi"])})
    generate_wav('c_major_bad_timing.wav', notes_bad_timing, bpm, sample_rate=target_sample_rate)

    # Silent
    generate_wav('silent.wav', [], bpm, sample_rate=target_sample_rate)
    
    print(f"Generated strictly bad assets (fixed 100c/500ms shift) at {target_sample_rate}Hz.")
