import { NextRequest, NextResponse } from 'next/server'
import { logAudit, logSSHConfigChange } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, details, ipAddress } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      )
    }

    // Log the audit event
    logAudit(action, userId, details, ipAddress)

    return NextResponse.json({
      success: true,
      message: 'Audit log recorded'
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error recording audit log:', errorMessage)

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
