import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/nextauth-options'
import { isChinaRegion } from '@/lib/config/region'
import { supabase } from '@/lib/integrations/supabase'
import cloudbase from '@cloudbase/node-sdk'

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

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    if (isChinaRegion()) {
      // CloudBase upgrade
      const app = getCloudBaseApp()
      const db = app.database()
      const usersCollection = db.collection('users')

      const userResult = await usersCollection.where({ email: session.user.email }).get()
      if (!userResult.data || userResult.data.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
      }

      const user = userResult.data[0]
      await usersCollection.doc(user._id).update({
        subscription_plan: 'pro',
        pro: true,
        updatedAt: new Date().toISOString(),
      })

      return new Response(JSON.stringify({ isPro: true, subscription_plan: 'pro' }), { status: 200 })
    } else {
      // Supabase upgrade
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
      }

      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: 'pro' })
        .eq('id', user.id)

      if (error) {
        console.error('Supabase upgrade error:', error)
        return new Response(JSON.stringify({ error: 'Upgrade failed' }), { status: 500 })
      }

      return new Response(JSON.stringify({ isPro: true, subscription_plan: 'pro' }), { status: 200 })
    }
  } catch (err: any) {
    console.error('Upgrade error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Upgrade failed' }), { status: 500 })
  }
}

