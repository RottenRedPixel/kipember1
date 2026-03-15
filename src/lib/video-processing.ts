import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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
  const { stdout } = await execFileAsync('ffprobe', [
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

  await execFileAsync('ffmpeg', [
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
