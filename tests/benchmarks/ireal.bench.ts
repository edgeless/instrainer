import { parseIRealURI } from '../../src/lib/utils/ireal';

// A relatively long iReal URI or a complex string to make parsing take some effort
const title = "Complex Benchmark Song";
const key = "C";
// This is a simple representation, let's create a longer music data string.
let musicData = "1r34LbKcu7";
for (let i = 0; i < 50; i++) {
  musicData += "[C |F |G |C ]| Dm | G7 | C | Kcl |";
}
const content = `${title}=Composer=Style=${key}=n=${musicData}`;
const uri = `irealb://${encodeURIComponent(content)}`;

const iterations = 10000;

console.log(`Running benchmark for ${iterations} iterations...`);

const start = performance.now();

for (let i = 0; i < iterations; i++) {
  parseIRealURI(uri);
}

const end = performance.now();
const duration = end - start;

console.log(`Baseline Execution time: ${duration.toFixed(2)} ms`);
console.log(`Average time per parse: ${(duration / iterations).toFixed(4)} ms`);
