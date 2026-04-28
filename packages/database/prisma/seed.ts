import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL || 'superadmin@novareachsolutions.com';
const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2026';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin';

async function main() {
  const email = SUPER_ADMIN_EMAIL.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'SUPER_ADMIN',
        approvalStatus: 'APPROVED',
        approvedAt: existing.approvedAt ?? new Date(),
        isEmailVerified: true,
      },
    });
    console.log(`✓ Updated existing user → SUPER_ADMIN: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  const stripeCustomerId = `seed_${randomBytes(16).toString('hex')}`;

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: SUPER_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      isEmailVerified: true,
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      subscription: {
        create: {
          stripeCustomerId,
          plan: 'AGENCY',
          status: 'ACTIVE',
        },
      },
    },
  });

  console.log('✓ Super admin created');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${SUPER_ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
