import wave
import struct
import math
import argparse
import os

def midi_to_freq(midi):
    return 440 * math.pow(2, (midi - 69) / 12)

def generate_wavs(bpm=60, sample_rate=44100):
    sec_per_beat = 60.0 / bpm
    duration = sec_per_beat * 0.5 # 50% duty cycle
    count_in_beats = 4
    
    total_beats = 16
    total_duration = (total_beats + count_in_beats) * sec_per_beat
    
    # C Major Scale: C3, D3, E3, F3, G3, A3, B3, C4, B3, A3, G3, F3, E3, D3, C3 (15 notes)
    notes = [36, 38, 40, 41, 43, 45, 47, 48, 47, 45, 43, 41, 40, 38, 36]
    
    output_dir = os.path.dirname(__file__)
    
    def write_wav(filename, pitch_offset=0, timing_offset=0):
        filepath = os.path.join(output_dir, filename)
        with wave.open(filepath, 'w') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(sample_rate)
            
            num_samples = int(total_duration * sample_rate)
            for i in range(num_samples):
                t = i / sample_rate
                val = 0
                
                for idx, midi in enumerate(notes):
                    note_start = (count_in_beats + idx) * sec_per_beat + timing_offset
                    if note_start <= t < note_start + duration:
                        freq = midi_to_freq(midi + pitch_offset)
                        val = int(32767 * 0.5 * math.sin(2 * math.pi * freq * t))
                        break
                
                f.writeframesraw(struct.pack('<h', val))
        print(f"DONE {filename}")

    print(f"Generating {bpm} BPM test WAV files at {sample_rate}Hz...")
    write_wav("c_major_perfect.wav", 0, 0)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bpm", type=int, default=60)
    parser.add_argument("--sample-rate", type=int, default=44100)
    args = parser.parse_args()
    generate_wavs(bpm=args.bpm, sample_rate=args.sample_rate)
