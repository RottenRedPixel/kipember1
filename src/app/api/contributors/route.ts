import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAccess } from '@/lib/access-server';

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { imageId, phoneNumber, name } = await request.json();

    if (!imageId || !phoneNumber) {
      return NextResponse.json(
        { error: 'imageId and phoneNumber are required' },
        { status: 400 }
      );
    }

    // Normalize phone number (basic normalization)
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    // Check if contributor already exists for this image
    const existing = await prisma.contributor.findFirst({
      where: {
        imageId,
        phoneNumber: normalizedPhone,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This phone number is already added' },
        { status: 400 }
      );
    }

    const contributor = await prisma.contributor.create({
      data: {
        imageId,
        phoneNumber: normalizedPhone,
        name: name || null,
      },
      include: {
        conversation: true,
      },
    });

    return NextResponse.json(contributor);
  } catch (error) {
    console.error('Error adding contributor:', error);
    return NextResponse.json(
      { error: 'Failed to add contributor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Contributor ID is required' },
        { status: 400 }
      );
    }

    await prisma.contributor.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contributor:', error);
    return NextResponse.json(
      { error: 'Failed to delete contributor' },
      { status: 500 }
    );
  }
}
