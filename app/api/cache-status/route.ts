import { NextResponse } from 'next/server'
import { getCacheInfo, isCacheAvailable } from '@/lib/offline-cache'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const cacheInfo = getCacheInfo()
    const available = isCacheAvailable()

    return NextResponse.json({
      available,
      ...cacheInfo,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[API /cache-status] Error:', err)
    return NextResponse.json(
      {
        available: false,
        error: err?.message || String(err),
      },
      { status: 500 }
    )
  }
}
