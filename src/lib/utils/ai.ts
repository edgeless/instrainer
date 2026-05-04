import { pipeline, env } from '@huggingface/transformers';
import type { Song } from './songs';

// Disable local models to fetch from HF hub
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'onnx-community/Bonsai-1.7B-ONNX';

// Using a singleton for the pipeline
let generatorInstance: any = null;
let isInitializing = false;

// Mock function for tests
let mockGenerator: any = null;

export function setMockGenerator(mock: any) {
  mockGenerator = mock;
}

export type ProgressCallback = (info: { status: string; name?: string; file?: string; progress?: number; loaded?: number; total?: number }) => void;

const SYSTEM_PROMPT = `あなたはプロのベーシストです。ユーザーの指示に従い、ベースのフレーズをJSON形式で出力してください。
JSONは以下の \`Song\` インターフェースに従う必要があります。余計なマークダウンや説明は一切含めず、純粋なJSON文字列のみを出力してください。

\`\`\`typescript
type Note = {
  name: string;   // 記譜ピッチの音名 (例: "C3", "Bb2")
  midi: number;   // 記譜ピッチのMIDIノート番号 (E2=28, A2=33, D3=38, G3=43)
  string: string; // 弦名 ("E" | "A" | "D" | "G")
  fret: number;   // フレット番号 (0 = 開放弦)
  beat: number;   // 開始拍 (0始まり)
  dur: number;    // 長さ (拍単位)
};

type Song = {
  name: string;                   // 曲名
  bpm: number;                    // テンポ
  key?: string;                   // キー (例: "C", "F")
  timeSignature?: [number, number]; // 拍子記号 [4, 4]
  notes: Note[];                  // ノートの配列
};
\`\`\`
`;

export async function initAI(onProgress?: ProgressCallback) {
  if (mockGenerator) return mockGenerator;
  if (generatorInstance) return generatorInstance;
  if (isInitializing) {
    // Wait for the existing initialization to finish (simple polling)
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    return generatorInstance;
  }

  isInitializing = true;
  try {
    generatorInstance = await pipeline('text-generation', MODEL_ID, {
      device: 'webgpu',
      dtype: 'q4', // using quantized 4-bit model to save memory
      progress_callback: onProgress
    });
    return generatorInstance;
  } catch (error) {
    console.error("Failed to initialize AI:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

export async function generateSong(prompt: string, onProgress?: ProgressCallback): Promise<Song> {
  const generator = await initAI(onProgress);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt }
  ];

  if (onProgress) {
    onProgress({ status: 'generating', name: 'Generating music data...' });
  }

  const output = await generator(messages, {
    max_new_tokens: 1500,
    temperature: 0.7,
    do_sample: true,
  });

  const text = output[0].generated_text;

  // Try to extract the assistant's reply
  let jsonString = text;

  // Handle chat template output if it contains the full conversation
  if (Array.isArray(text)) {
      const lastMsg = text[text.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
          jsonString = lastMsg.content;
      }
  } else if (typeof text === 'string') {
      // Sometimes it outputs a string with <|im_start|> tags or just the plain JSON
      const assistantMarker = "<|im_start|>assistant\n";
      const idx = text.lastIndexOf(assistantMarker);
      if (idx !== -1) {
          jsonString = text.slice(idx + assistantMarker.length);
      }
  }

  // Find the first '{' and the last '}'
  const startIdx = jsonString.indexOf('{');
  const endIdx = jsonString.lastIndexOf('}');

  if (startIdx === -1 || endIdx === -1) {
      throw new Error("Failed to find JSON object in model output.");
  }

  jsonString = jsonString.slice(startIdx, endIdx + 1);

  try {
      const parsed = JSON.parse(jsonString) as Song;

      // Basic validation
      if (!parsed.name || typeof parsed.bpm !== 'number' || !Array.isArray(parsed.notes)) {
          throw new Error("Parsed JSON does not match the Song schema.");
      }

      return parsed;
  } catch (e) {
      console.error("Failed to parse JSON:", jsonString);
      throw new Error(`Invalid JSON format: ${(e as Error).message}`);
  }
}
