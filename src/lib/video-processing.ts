import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const FFMPEG_BINARY = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_BINARY = process.env.FFPROBE_PATH || 'ffprobe';

type ProbeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
};

type ProbeFormat = {
  duration?: string;
};

type ProbeResponse = {
  streams?: ProbeStream[];
  format?: ProbeFormat;
};

export type VideoMetadata = {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
};

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  const { stdout } = await execFileAsync(FFPROBE_BINARY, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_entries',
    'format=duration:stream=codec_type,width,height,duration',
    filePath,
  ]);

  const payload = JSON.parse(stdout) as ProbeResponse;
  const stream = payload.streams?.find((entry) => entry.codec_type === 'video');

  return {
    durationSeconds:
      parseOptionalNumber(payload.format?.duration) || parseOptionalNumber(stream?.duration),
    width: parseOptionalNumber(stream?.width),
    height: parseOptionalNumber(stream?.height),
  };
}

export async function generatePosterFrame({
  inputPath,
  outputPath,
  durationSeconds,
}: {
  inputPath: string;
  outputPath: string;
  durationSeconds: number | null;
}) {
  const targetSecond =
    durationSeconds && durationSeconds > 1 ? Math.min(1, Math.max(durationSeconds * 0.15, 0.2)) : 0;

  await execFileAsync(FFMPEG_BINARY, [
    '-y',
    '-ss',
    targetSecond.toFixed(2),
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    outputPath,
  ]);
}

export function shouldNormalizeVideoForBrowser(filename: string): boolean {
  const normalized = filename.toLowerCase();
  return normalized.endsWith('.mov') || normalized.endsWith('.m4v');
}

export async function transcodeVideoToMp4({
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
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}
