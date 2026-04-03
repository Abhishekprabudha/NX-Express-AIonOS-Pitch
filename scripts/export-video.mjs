#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const fps = Number(process.env.FPS || 30);
const width = Number(process.env.WIDTH || 1920);
const height = Number(process.env.HEIGHT || 1080);
const outDir = path.join(root, 'dist');
const framesDir = path.join(outDir, 'frames');
const output = process.env.OUTPUT || path.join(outDir, 'narrative.mp4');
const port = Number(process.env.PORT || 4173);
const sceneAudio = [1, 2, 3, 4, 5].map((n) => path.join(root, 'assets', 'narration', `scene-${String(n).padStart(2, '0')}.mp3`));

sceneAudio.forEach((file) => {
  if (!existsSync(file)) {
    throw new Error(`Missing narration audio file: ${file}`);
  }
});

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const proc = spawn(cmd, args, { stdio: 'inherit', ...opts });
  proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
  proc.on('error', reject);
});

const runCapture = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts });
  let stdout = '';
  proc.stdout.on('data', (chunk) => (stdout += String(chunk)));
  proc.on('exit', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${cmd} exited with ${code}`)));
  proc.on('error', reject);
});

const waitForServer = async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const result = await runCapture('curl', ['-sSf', `http://127.0.0.1:${port}/index.html`]);
      if (result.includes('Motion narrative')) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Static server did not start in time');
};

const buildNarrationTrack = async () => {
  const filterInputs = sceneAudio.flatMap((file) => ['-i', file]);
  const concatFilter = `${sceneAudio.map((_, i) => `[${i}:a]`).join('')}concat=n=${sceneAudio.length}:v=0:a=1[a]`;
  const outputAudio = path.join(outDir, 'narration.wav');
  await run('ffmpeg', ['-y', ...filterInputs, '-filter_complex', concatFilter, '-map', '[a]', outputAudio]);
  return outputAudio;
};

await rm(outDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const server = spawn('python', ['-m', 'http.server', String(port)], { cwd: root, stdio: 'inherit' });

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/index.html?mode=export&width=${width}&height=${height}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__NARRATIVE_EXPORT__));
  await page.evaluate(() => window.__NARRATIVE_EXPORT__.ready);
  const duration = await page.evaluate(() => window.__NARRATIVE_EXPORT__.getDuration());
  const totalFrames = Math.ceil(duration * fps);

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    await page.evaluate((timeSec) => window.__NARRATIVE_EXPORT__.renderAt(timeSec), t);
    const file = path.join(framesDir, `frame-${String(frame).padStart(6, '0')}.png`);
    await page.screenshot({ path: file });
    if (frame % 60 === 0) {
      process.stdout.write(`Captured ${frame}/${totalFrames}\n`);
    }
  }

  await browser.close();

  const narration = await buildNarrationTrack();
  await run('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame-%06d.png'),
    '-i', narration,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    output,
  ]);

  process.stdout.write(`\nVideo exported to ${output}\n`);
} finally {
  server.kill('SIGTERM');
}
