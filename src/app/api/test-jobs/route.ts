import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('[test-jobs] Simple test endpoint called')

  return NextResponse.json({
    jobs: [
      {
        id: 'test-1',
        company_name: 'Test Company',
        status: 'completed'
      }
    ],
    total: 1
  })
}
