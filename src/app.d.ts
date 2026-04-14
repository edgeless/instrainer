// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface HTMLAudioElementWithSink extends HTMLAudioElement {
		setSinkId(sinkId: string): Promise<void>;
	}
	interface AudioContextWithSink extends AudioContext {
		setSinkId(sinkId: string): Promise<void>;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
