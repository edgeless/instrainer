// テスト前の localStorage 初期化スクリプト
import { test as setup } from '@playwright/test';

setup('initialize localStorage', async ({ page }) => {
	await page.goto('/');
	// localStorage が正しく動作するか確認
	const result = await page.evaluate(() => {
		if (!window.localStorage) return 'No localStorage';
		try {
			localStorage.setItem('test', 'value');
			return localStorage.getItem('test') ?? 'Empty';
		} catch (e) {
			return String(e);
		}
	});

	if (result !== 'value') {
		console.warn(`localStorage setup result: ${result}`);
	}
});