import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const FFMPEG_BINARY = process.env.FFMPEG_PATH || 'ffmpeg';

export function shouldNormalizeAudioForIos(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext === 'webm' || ext === 'ogg' || ext === 'oga';
}

export async function transcodeAudioToM4a({
  inputPath,
  outputPath,
}: {
  inputPath: string;
  outputPath: string;
}) {
  await execFileAsync(FFMPEG_BINARY, [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '44100',
    '-ac',
    '1',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

export async function extractAudioClipToM4a({
  input,
  outputPath,
  startMs,
  endMs,
}: {
  input: string;
  outputPath: string;
  startMs: number;
  endMs: number;
}) {
  const clipStart = Math.max(0, startMs / 1000);
  const clipEnd = Math.max(clipStart, endMs / 1000);
  const clipDuration = Math.max(0.25, clipEnd - clipStart);

  await execFileAsync(FFMPEG_BINARY, [
    '-y',
    '-i',
    input,
    '-ss',
    clipStart.toFixed(3),
    '-t',
    clipDuration.toFixed(3),
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '44100',
    '-ac',
    '1',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

export async function concatenateAudioSegmentsToM4a({
  inputPaths,
  outputPath,
}: {
  inputPaths: string[];
  outputPath: string;
}) {
  if (inputPaths.length === 0) {
    throw new Error('At least one audio segment is required');
  }

  const concatListPath = `${outputPath}.txt`;
  const concatList = inputPaths
    .map((inputPath) => `file '${inputPath.replace(/'/g, "'\\''")}'`)
    .join('\n');

  await fs.writeFile(concatListPath, concatList, 'utf8');

  try {
    await execFileAsync(FFMPEG_BINARY, [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-ac',
      '1',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  } finally {
    await fs.unlink(concatListPath).catch(() => undefined);
  }
}
