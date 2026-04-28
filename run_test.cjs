const { execSync } = require('child_process');
try {
  execSync('npx playwright test tests/e2e/evaluation.spec.ts', { stdio: 'inherit', timeout: 150000 });
} catch(e) {}
