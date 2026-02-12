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
        method: 'paypal',
        planType: safeTier,
      },
    }, { status: 410 })
  } catch (error) {
    console.error('PayPal subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to create PayPal subscription' },
      { status: 500 }
    )
  }
}
