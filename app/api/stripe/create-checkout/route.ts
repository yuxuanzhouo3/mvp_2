import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tier } = await request.json()

    if (tier !== 'pro' && tier !== 'enterprise') {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    // For demo purposes, return a mock checkout URL
    // In production, create actual Stripe Checkout Session:
    /*
    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: session.user.email,
      line_items: [
        {
          price: STRIPE_PLANS[tier].priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${getBaseUrl()}/settings?success=true`,
      cancel_url: `${getBaseUrl()}/settings?canceled=true`,
      metadata: {
        userId: (session.user as any).id,
        tier: tier,
      },
    })
    return NextResponse.json({ url: checkoutSession.url })
    */

    // Mock response for demo
    return NextResponse.json({
      url: `/settings?demo_stripe_checkout=${tier}`,
      message: 'Demo mode - Stripe checkout simulated'
    })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
