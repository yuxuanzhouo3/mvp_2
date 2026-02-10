import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { isChinaRegion } from '@/lib/config/region'
import { supabase } from '@/lib/integrations/supabase'
import cloudbase from '@cloudbase/node-sdk'
import { consumeEmailVerificationCode } from '@/lib/auth/email-verification'

const RegisterSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  verificationCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
})

let cachedApp: any = null

function getCloudBaseApp() {
  if (cachedApp) {
    return cachedApp
  }

  cachedApp = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  })

  return cachedApp
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, verificationCode } = RegisterSchema.parse(body)
    const normalizedEmail = email.trim().toLowerCase()

    if (isChinaRegion()) {
      // CloudBase registration
      const app = getCloudBaseApp()
      const db = app.database()
      const usersCollection = db.collection('users')

      if (!verificationCode) {
        return new Response(
          JSON.stringify({
            error: 'Verification code is required',
            code: 'VERIFICATION_CODE_REQUIRED',
          }),
          { status: 400 }
        )
      }

      // Check if email already exists
      const existingResult = await usersCollection.where({ email: normalizedEmail }).get()
      if (existingResult.data && existingResult.data.length > 0) {
        return new Response(JSON.stringify({ error: 'Email already in use' }), { status: 409 })
      }

      const consumeResult = await consumeEmailVerificationCode({
        email: normalizedEmail,
        purpose: 'register',
        code: verificationCode,
      })

      if (!consumeResult.success) {
        const statusCode =
          consumeResult.code === 'CODE_INVALID' ||
          consumeResult.code === 'CODE_NOT_FOUND' ||
          consumeResult.code === 'CODE_EXPIRED'
            ? 400
            : 500
        return new Response(
          JSON.stringify({
            error: consumeResult.message,
            code: consumeResult.code,
          }),
          { status: statusCode }
        )
      }

      const hashed = await bcrypt.hash(password, 10)

      const newUser = {
        email: normalizedEmail,
        password: hashed,
        name: name || normalizedEmail.split('@')[0],
        pro: false,
        region: 'china',
        subscription_plan: 'free',
        subscription_status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = await usersCollection.add(newUser)

      return new Response(JSON.stringify({ id: result.id, email: normalizedEmail }), { status: 201 })
    } else {
      // Supabase registration
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: name || normalizedEmail.split('@')[0],
          },
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          return new Response(JSON.stringify({ error: 'Email already in use' }), { status: 409 })
        }
        return new Response(JSON.stringify({ error: error.message }), { status: 400 })
      }

      return new Response(JSON.stringify({ id: data.user?.id, email: data.user?.email }), { status: 201 })
    }
  } catch (err: any) {
    const message = err?.message ?? 'Invalid request'
    return new Response(JSON.stringify({ error: message }), { status: 400 })
  }
}
