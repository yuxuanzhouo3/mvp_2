import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create dummy users
  const password = await bcrypt.hash('demo123', 10)

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      password: password,
      name: 'Demo User',
      subscriptionTier: 'free',
    },
  })

  const proUser = await prisma.user.upsert({
    where: { email: 'pro@example.com' },
    update: {},
    create: {
      email: 'pro@example.com',
      password: password,
      name: 'Pro User',
      subscriptionTier: 'pro',
      subscriptionId: 'sub_demo_pro_123',
      paymentMethod: 'stripe',
    },
  })

  const enterpriseUser = await prisma.user.upsert({
    where: { email: 'enterprise@example.com' },
    update: {},
    create: {
      email: 'enterprise@example.com',
      password: password,
      name: 'Enterprise User',
      subscriptionTier: 'enterprise',
      subscriptionId: 'sub_demo_ent_456',
      paymentMethod: 'paypal',
    },
  })

  console.log('✅ Dummy users created:')
  console.log('📧 Email: demo@example.com | Password: demo123 (Free tier)')
  console.log('📧 Email: pro@example.com | Password: demo123 (Pro tier - Stripe)')
  console.log('📧 Email: enterprise@example.com | Password: demo123 (Enterprise tier - PayPal)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
