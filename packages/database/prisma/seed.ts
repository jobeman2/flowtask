import { PrismaClient, WorkspaceRole, WorkspaceType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.info('🌱 Starting FlowTask database seed...');

  // Seed default billing plans
  const plans = [
    {
      code: 'FREE',
      name: 'Free Starter',
      description: 'Perfect for individual task management on Telegram',
      priceEtbMonth: 0,
      maxProjects: 3,
      maxMembers: 1,
      hasAiFeatures: false,
    },
    {
      code: 'PRO',
      name: 'Pro Individual',
      description: 'Unlimited projects, reminders, and AI task extraction',
      priceEtbMonth: 199,
      maxProjects: 100,
      maxMembers: 1,
      hasAiFeatures: true,
    },
    {
      code: 'TEAM',
      name: 'Team Collaboration',
      description: 'Collaborate with team members inside Telegram groups',
      priceEtbMonth: 999,
      maxProjects: 500,
      maxMembers: 15,
      hasAiFeatures: true,
    },
    {
      code: 'BUSINESS',
      name: 'Business Scale',
      description: 'Enterprise grade task management with advanced analytics',
      priceEtbMonth: 2999,
      maxProjects: 5000,
      maxMembers: 100,
      hasAiFeatures: true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  // Seed a demo user and workspace
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@flowtask.app' },
    update: {},
    create: {
      email: 'demo@flowtask.app',
      name: 'Demo Founder',
      timezone: 'Africa/Addis_Ababa',
    },
  });

  const demoWorkspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Personal Workspace',
      slug: 'demo-workspace',
      ownerId: demoUser.id,
      type: WorkspaceType.PERSONAL,
      members: {
        create: {
          userId: demoUser.id,
          role: WorkspaceRole.OWNER,
        },
      },
    },
  });

  console.info(`✅ Seeded plans, demo user (${demoUser.id}), and workspace (${demoWorkspace.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
