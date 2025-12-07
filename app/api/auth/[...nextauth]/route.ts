import NextAuth, { AuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { isChinaRegion } from '@/lib/config/region'
import cloudbase from '@cloudbase/node-sdk'
import { supabase } from '@/lib/integrations/supabase'

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

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        try {
          if (isChinaRegion()) {
            // CloudBase authentication
            const app = getCloudBaseApp()
            const db = app.database()
            const userResult = await db.collection('users').where({ email: credentials.email }).get()

            if (!userResult.data || userResult.data.length === 0) return null

            const user = userResult.data[0]
            const valid = await bcrypt.compare(credentials.password, user.password)
            if (!valid) return null

            return {
              id: user._id,
              name: user.name ?? null,
              email: user.email,
              subscriptionTier: user.subscription_plan || 'free',
            }
          } else {
            // Supabase authentication
            const { data, error } = await supabase.auth.signInWithPassword({
              email: credentials.email,
              password: credentials.password,
            })

            if (error || !data.user) return null

            return {
              id: data.user.id,
              name: data.user.user_metadata?.name ?? null,
              email: data.user.email,
            }
          }
        } catch (error) {
          console.error('[NextAuth] Authorization error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.subscriptionTier = (user as any).subscriptionTier
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.userId
        ;(session.user as any).subscriptionTier = token.subscriptionTier
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

