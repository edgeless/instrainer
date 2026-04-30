import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	timeout: 300000,
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
	},

	// localStorage を有効にするための設定
	storageState: 'tests/e2e/.auth/storage.json',

	// テスト前に localStorage を初期化するセットアップ
	setupFiles: ['./tests/e2e/setup-storage.ts'],

	projects: [
		{
			name: 'chromium',
			use: { 
				...devices['Desktop Chrome'],
				launchOptions: {
					args: [
						'--use-fake-device-for-media-stream',
						'--use-fake-ui-for-media-stream',
						'--use-file-for-fake-audio-capture=tests/assets/c_major_perfect.wav',
						'--allow-file-access-from-files'
					]
				}
			},
		},
	],

	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
	},
});
