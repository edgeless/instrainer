import wave
import struct
import math

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
        total_samples_with_count_in = int(((count_in_beats + total_beats) * sec_per_beat) * sample_rate)

        buffer = [0] * total_samples_with_count_in

        for note in notes:
            beat = note['beat']
            dur = note['dur']
            freq = note['freq']

            start_beat = count_in_beats + beat
            end_beat = start_beat + dur

            start_sample = int((start_beat * sec_per_beat) * sample_rate)
            end_sample = int((end_beat * sec_per_beat) * sample_rate)

            for i in range(start_sample, end_sample):
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
c_major_notes_perfect = [
    {"beat": 0, "dur": 1, "freq": 130.81},
    {"beat": 1, "dur": 1, "freq": 146.83},
    {"beat": 2, "dur": 1, "freq": 164.81},
    {"beat": 3, "dur": 1, "freq": 174.61},
    {"beat": 4, "dur": 1, "freq": 196.00},
    {"beat": 5, "dur": 1, "freq": 220.00},
    {"beat": 6, "dur": 1, "freq": 246.94},
    {"beat": 7, "dur": 1, "freq": 261.63},
    {"beat": 8, "dur": 1, "freq": 246.94},
    {"beat": 9, "dur": 1, "freq": 220.00},
    {"beat": 10, "dur": 1, "freq": 196.00},
    {"beat": 11, "dur": 1, "freq": 174.61},
    {"beat": 12, "dur": 1, "freq": 164.81},
    {"beat": 13, "dur": 1, "freq": 146.83},
    {"beat": 14, "dur": 2, "freq": 130.81},
]

generate_wav("c_major_perfect.wav", c_major_notes_perfect, bpm)
c_major_notes_good = [{"beat": n["beat"], "dur": n["dur"], "freq": n["freq"] * 1.00870} for n in c_major_notes_perfect]
generate_wav("c_major_good_pitch.wav", c_major_notes_good, bpm)
late_beats = 0.1067
c_major_notes_timing_good = [{"beat": n["beat"] + late_beats, "dur": n["dur"], "freq": n["freq"]} for n in c_major_notes_perfect]
generate_wav("c_major_good_timing.wav", c_major_notes_timing_good, bpm)
