import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { isChinaRegion } from '@/lib/config/region'
import { supabase } from '@/lib/integrations/supabase'
import cloudbase from '@cloudbase/node-sdk'

const RegisterSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(6),
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
    const { name, email, password } = RegisterSchema.parse(body)

    if (isChinaRegion()) {
      // CloudBase registration
      const app = getCloudBaseApp()
      const db = app.database()
      const usersCollection = db.collection('users')

      // Check if email already exists
      const existingResult = await usersCollection.where({ email }).get()
      if (existingResult.data && existingResult.data.length > 0) {
        return new Response(JSON.stringify({ error: 'Email already in use' }), { status: 409 })
      }

      const hashed = await bcrypt.hash(password, 10)

      const newUser = {
        email,
        password: hashed,
        name: name || email.split('@')[0],
        pro: false,
        region: 'china',
        subscription_plan: 'free',
        subscription_status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = await usersCollection.add(newUser)

      return new Response(JSON.stringify({ id: result.id, email }), { status: 201 })
    } else {
      // Supabase registration
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
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

