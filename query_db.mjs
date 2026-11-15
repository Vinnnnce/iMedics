import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  console.log('Attempting findFirst query...');
  const start = Date.now();
  const user = await Promise.race([
    prisma.user.findFirst(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout after 5s')), 5000)
    )
  ]);
  const elapsed = Date.now() - start;
  console.log(`Query completed in ${elapsed}ms:`, user ? 'found user' : 'no users');
} catch (e) {
  console.error('Query failed:', e.message);
} finally {
  await prisma.$disconnect();
}
