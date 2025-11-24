/**
 * CV Experiments Comparison API
 * POST /api/cv-experiments/compare - Compare multiple experiments
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExperimentsByIds } from '@/lib/supabase/cv-experiments-service'

/**
 * POST /api/cv-experiments/compare
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { ids } = body

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array is required' },
        { status: 400 }
      )
    }

    if (ids.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 experiments can be compared at once' },
        { status: 400 }
      )
    }

    // Fetch experiments
    const { experiments, error } = await getExperimentsByIds(ids)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch experiments', details: error.message },
        { status: 500 }
      )
    }

    // Check if all requested experiments were found
    if (experiments && experiments.length !== ids.length) {
      const foundIds = experiments.map(e => e.id)
      const missingIds = ids.filter(id => !foundIds.includes(id))

      return NextResponse.json(
        {
          error: 'Some experiments not found',
          missingIds,
          experiments
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ experiments })

  } catch (error) {
    console.error('[CV Experiments API] Compare error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
