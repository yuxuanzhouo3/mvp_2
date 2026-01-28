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

    // For demo purposes, return mock subscription ID
    // In production, create actual PayPal subscription
    /*
    const request = new paypal.billingagreements.BillingAgreement()
    request.requestBody({
      plan_id: PAYPAL_PLANS[tier].planId,
      subscriber: {
        email_address: session.user.email,
      },
      application_context: {
        return_url: `${getBaseUrl()}/settings?success=true`,
        cancel_url: `${getBaseUrl()}/settings?canceled=true`,
      },
    })
    const response = await paypalClient.execute(request)
    */

    // Mock response for demo
    return NextResponse.json({
      subscriptionId: `PAYPAL-DEMO-${tier.toUpperCase()}-${Date.now()}`,
      approvalUrl: `/settings?demo_paypal_checkout=${tier}`,
      message: 'Demo mode - PayPal subscription simulated'
    })
  } catch (error) {
    console.error('PayPal subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to create PayPal subscription' },
      { status: 500 }
    )
  }
}
