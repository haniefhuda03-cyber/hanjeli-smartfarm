import fs from 'fs';

const files = [
  'hanjeli-fe/src/app/login/page.tsx',
  'hanjeli-fe/src/app/register/page.tsx',
  'hanjeli-fe/src/app/forgot-password/page.tsx',
  'hanjeli-fe/src/app/reset-password/page.tsx',
  'hanjeli-fe/src/app/login/verify-2fa/page.tsx',
  'hanjeli-fe/src/app/login/recovery/page.tsx',
  'hanjeli-fe/src/app/register/verify-email/page.tsx',
];

const fails = [];
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.includes('t(') || trimmed.includes('{t(') || trimmed.includes('//')) return;

    // Check for hardcoded placeholder attributes
    if (/placeholder=["'](.*?)["']/.test(trimmed)) {
      console.log(`${f}:${i + 1}: ${trimmed}`);
    }

    // Check for hardcoded text content between JSX tags
    if (/>([^<*{ }]([^<]*?))</.test(trimmed)) {
      console.log(`${f}:${i + 1}: ${trimmed}`);
    }

    // Check for hardcoded strings in console.log / setError / toast
    const cleaned = trimmed.replace(/\/\*.*?\*\//g, '');
    if (/(console\.log|setError|toast\.?.*)\(["']([^"']+)["']\)/.test(cleaned)) {
      console.log(`${f}:${i + 1}: ${trimmed}`);
    }
  });
});