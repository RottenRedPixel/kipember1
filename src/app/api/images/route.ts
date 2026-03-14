import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { requireApiUser } from '@/lib/auth-server';
import { getAcceptedFriendIds } from '@/lib/ember-access';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { getUploadPath, getUploadsDir } from '@/lib/uploads';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    const shareToNetwork = (formData.get('shareToNetwork') as string | null) === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${randomUUID()}.${ext}`;

    // Ensure uploads directory exists
    const uploadsDir = getUploadsDir();
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(getUploadPath(filename), buffer);

    // Create database record
    const image = await prisma.image.create({
      data: {
        ownerId: auth.user.id,
        filename,
        originalName: file.name,
        description: description || null,
        shareToNetwork,
      },
    });

    let wikiGenerated = false;
    let warning: string | null = null;

    try {
      await generateWikiForImage(image.id);
      wikiGenerated = true;
    } catch (error) {
      console.error('Auto wiki generation failed:', error);
      warning =
        error instanceof Error
          ? error.message
          : 'Image uploaded, but the automatic wiki could not be generated';
    }

    return NextResponse.json({ id: image.id, wikiGenerated, warning });
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
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const friendIds = await getAcceptedFriendIds(auth.user.id);

    const images = await prisma.image.findMany({
      where: {
        OR: [
          { ownerId: auth.user.id },
          { contributors: { some: { userId: auth.user.id } } },
          ...(friendIds.length > 0
            ? [{ shareToNetwork: true, ownerId: { in: friendIds } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contributors: {
          where: { userId: auth.user.id },
          select: { id: true },
          take: 1,
        },
        _count: {
          select: { contributors: true, tags: true },
        },
        wiki: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json(
      images.map((image) => ({
        id: image.id,
        filename: image.filename,
        originalName: image.originalName,
        description: image.description,
        createdAt: image.createdAt,
        shareToNetwork: image.shareToNetwork,
        owner: image.owner,
        accessType:
          image.ownerId === auth.user.id
            ? 'owner'
            : image.contributors.length > 0
              ? 'contributor'
              : 'network',
        _count: image._count,
        wiki: image.wiki,
      }))
    );
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
