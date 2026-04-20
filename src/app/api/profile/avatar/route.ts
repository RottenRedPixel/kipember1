import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';
import { getUploadPath, getUploadUrl } from '@/lib/uploads';
import { uploadBufferToObjectStorage } from '@/lib/object-storage';
import { promises as fs } from 'fs';
import { dirname } from 'path';

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const mimeType = file.type || '';
  if (!mimeType.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let ext = 'jpg';
  if (mimeType === 'image/png') {
    ext = 'png';
  } else if (mimeType === 'image/webp') {
    ext = 'webp';
  } else if (mimeType === 'image/gif') {
    ext = 'gif';
  } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    ext = 'jpg';
  }

  const filename = `avatar-${auth.user.id}-${Date.now()}.${ext}`;
  const uploadPath = getUploadPath(filename);

  // Write to local disk (for local dev and as fallback)
  try {
    await fs.mkdir(dirname(uploadPath), { recursive: true });
    await fs.writeFile(uploadPath, buffer);
  } catch (err) {
    console.error('Failed to write avatar to local disk:', err);
  }

  // Try to upload to object storage if configured
  try {
    await uploadBufferToObjectStorage({ filename, body: buffer, contentType: mimeType });
  } catch (err) {
    console.error('Failed to upload avatar to object storage (using local disk):', err);
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { avatarFilename: filename },
  });

  return NextResponse.json({ avatarUrl: getUploadUrl(filename) });
}
