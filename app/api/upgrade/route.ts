import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const user = await prisma.user.update({
    where: { email: session.user.email },
    data: { isPro: true },
  })
  return new Response(JSON.stringify({ isPro: user.isPro }), { status: 200 })
}


