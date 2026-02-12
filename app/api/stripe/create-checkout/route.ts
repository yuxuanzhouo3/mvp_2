import { NextRequest, NextResponse } from 'next/server'

const DEPRECATION_DATE = '2026-02-18';

export async function POST(request: NextRequest) {
  try {
    const { tier } = await request.json();
    const safeTier = tier === 'enterprise' ? 'enterprise' : 'pro';

    return NextResponse.json({
      error: 'Route deprecated',
      message: `This demo route has been retired and will be removed after ${DEPRECATION_DATE}.`,
      replacement: '/api/payment/create',
      deprecationDate: DEPRECATION_DATE,
      suggestedPayload: {
        method: 'stripe',
        planType: safeTier,
      },
    }, { status: 410 })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
