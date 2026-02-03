import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { requireAccess } from '@/lib/access-server';

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    const visibilityInput = (formData.get('visibility') as string | null) || 'PRIVATE';
    const visibility =
      visibilityInput === 'PUBLIC' || visibilityInput === 'SHARED' || visibilityInput === 'PRIVATE'
        ? visibilityInput
        : 'PRIVATE';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${randomUUID()}.${ext}`;

    // Ensure uploads directory exists
    const uploadsDir =
      process.env.UPLOADS_DIR || join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(join(uploadsDir, filename), buffer);

    // Create database record
    const image = await prisma.image.create({
      data: {
        filename,
        originalName: file.name,
        description: description || null,
        visibility,
      },
    });

    return NextResponse.json({ id: image.id });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const access = await requireAccess();
    if (access) return access;

    const images = await prisma.image.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { contributors: true },
        },
        wiki: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
