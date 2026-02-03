import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from './src/generated/prisma/client.js';

const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const images = await prisma.image.findMany({
  include: {
    contributors: { include: { conversation: true } },
    wiki: true
  }
});

console.log('\n=== Your Images ===\n');

for (const img of images) {
  const completed = img.contributors.filter(c => c.conversation?.status === 'completed').length;
  console.log(`Image: ${img.originalName}`);
  console.log(`  View/Manage: http://localhost:3000/image/${img.id}`);
  console.log(`  Wiki:        http://localhost:3000/image/${img.id}/wiki`);
  console.log(`  Chat:        http://localhost:3000/image/${img.id}/chat`);
  console.log(`  Contributors: ${img.contributors.length} (${completed} completed)`);
  console.log(`  Wiki generated: ${img.wiki ? 'Yes' : 'No - click Generate Wiki'}`);
  console.log('');
}

await prisma.$disconnect();
