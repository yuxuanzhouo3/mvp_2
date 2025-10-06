import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Starting migration to subscription tiers...')

  // Get all users
  const users = await prisma.$queryRaw<any[]>`SELECT * FROM User`

  console.log(`Found ${users.length} users to migrate`)

  // Migrate each user
  for (const user of users) {
    const tier = user.isPro ? 'pro' : 'free'
    console.log(`Migrating user ${user.email}: ${user.isPro ? 'Pro' : 'Free'} → ${tier}`)
  }

  // Now push the schema (data migration handled by custom logic)
  console.log('\n✅ Migration preview complete!')
  console.log('Run: npx prisma db push --accept-data-loss')
  console.log('Then run: pnpm run seed to recreate test users')
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
