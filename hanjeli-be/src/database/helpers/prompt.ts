/**
 * Interactive CLI prompt helpers.
 *
 * Uses Node.js built-in `readline` — no external dependencies needed.
 * Password input is hidden (masked) for security.
 */
import { createInterface } from 'readline';

/** ANSI color helpers for console output */
export const color = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
} as const;

/**
 * Ask a single question and return the answer.
 * Optionally accepts a default value shown in brackets.
 */
export async function ask(
  question: string,
  defaultValue?: string,
): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    return await new Promise<string>((resolve) => {
      const suffix = defaultValue ? ` [${defaultValue}]` : '';
      rl.question(`  ${question}${suffix}: `, (answer) => {
        const trimmed = answer.trim();
        resolve(trimmed || defaultValue || '');
      });
    });
  } finally {
    rl.close();
  }
}

/**
 * Ask for a password with masked input (no echo).
 *
 * Uses raw mode to intercept keystrokes so the password
 * is never displayed on screen.
 */
export async function askPassword(question: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    /* Write the prompt */
    stdout.write(`  ${question}: `);

    /* If stdin is not a TTY (e.g. piped input), read normally */
    if (!stdin.isTTY) {
      const rl = createInterface({
        input: stdin,
        output: stdout,
        terminal: false,
      });
      rl.once('line', (line) => {
        rl.close();
        resolve(line.trim());
      });
      rl.once('error', reject);
      return;
    }

    /* Raw mode for hiding password input */
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';

    const onData = (ch: string): void => {
      const charCode = ch.charCodeAt(0);

      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        /* Enter or Ctrl+D → done */
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(password);
      } else if (charCode === 3) {
        /* Ctrl+C → abort */
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        reject(new Error('User cancelled'));
      } else if (ch === '\u007F' || charCode === 8) {
        /* Backspace */
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        /* Regular character — show bullet */
        password += ch;
        stdout.write('●');
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * Print a status line with icon.
 */
export function log(icon: '✓' | '○' | 'ℹ' | '✗' | '⚠', message: string): void {
  const colors: Record<string, string> = {
    '✓': color.green,
    '○': color.dim,
    ℹ: color.cyan,
    '✗': color.red,
    '⚠': color.yellow,
  };
  console.log(`  ${colors[icon]}${icon}${color.reset} ${message}`);
}

/**
 * Print a phase header.
 */
export function phase(number: number, title: string): void {
  console.log(`\n${color.bold}Phase ${number}: ${title}${color.reset}`);
}
