import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_PHP_SERVICE_URL: process.env.NEXT_PUBLIC_PHP_SERVICE_URL,
    isProduction: process.env.NODE_ENV === 'production',
    timestamp: new Date().toISOString()
  })
}
