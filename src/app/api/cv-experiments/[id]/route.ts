/**
 * CV Experiments API Routes - Single Experiment
 * GET /api/cv-experiments/[id] - Get a single experiment with results
 * PATCH /api/cv-experiments/[id] - Update an experiment
 * DELETE /api/cv-experiments/[id] - Delete an experiment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExperimentById,
  updateExperiment,
  deleteExperiment,
  type UpdateExperimentParams
} from '@/lib/supabase/cv-experiments-service'

/**
 * GET /api/cv-experiments/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { experiment, error } = await getExperimentById(supabase, params.id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Experiment not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch experiment', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ experiment })

  } catch (error) {
    console.error('[CV Experiments API] GET [id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/cv-experiments/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const body: UpdateExperimentParams = await request.json()

    // Update experiment
    const { experiment, error } = await updateExperiment(supabase, params.id, body)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Experiment not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update experiment', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ experiment })

  } catch (error) {
    console.error('[CV Experiments API] PATCH [id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cv-experiments/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Delete experiment
    const { success, error } = await deleteExperiment(supabase, params.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete experiment', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success })

  } catch (error) {
    console.error('[CV Experiments API] DELETE [id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
