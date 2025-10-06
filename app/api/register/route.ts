import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const RegisterSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password } = RegisterSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return new Response(JSON.stringify({ error: 'Email already in use' }), { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { name, email, password: hashed } })

    return new Response(JSON.stringify({ id: user.id, email: user.email }), { status: 201 })
  } catch (err: any) {
    const message = err?.message ?? 'Invalid request'
    return new Response(JSON.stringify({ error: message }), { status: 400 })
  }
}

