/**
 * CV Experiments API Routes
 * GET /api/cv-experiments - Get all experiments with optional filtering
 * POST /api/cv-experiments - Create a new experiment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExperiments,
  createExperiment,
  getExperimentStats,
  getRecentExperiments,
  type ExperimentFilters,
  type CreateExperimentParams
} from '@/lib/supabase/cv-experiments-service'

/**
 * GET /api/cv-experiments
 * Query params:
 * - status: running | completed | failed | cancelled
 * - model_name: string
 * - model_architecture: string
 * - tags: string (comma-separated)
 * - date_from: ISO date string
 * - date_to: ISO date string
 * - search: string
 * - recent: number (days)
 * - stats: boolean
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams

    // Check for stats request
    if (searchParams.get('stats') === 'true') {
      const { stats, error } = await getExperimentStats(supabase)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch experiment statistics', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ stats })
    }

    // Check for recent experiments
    const recentDays = searchParams.get('recent')
    if (recentDays) {
      const days = parseInt(recentDays, 10)
      const { experiments, error } = await getRecentExperiments(supabase, days)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch recent experiments', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ experiments })
    }

    // Build filters
    const filters: ExperimentFilters = {}

    const status = searchParams.get('status')
    if (status) {
      filters.status = status as any
    }

    const modelName = searchParams.get('model_name')
    if (modelName) {
      filters.model_name = modelName
    }

    const modelArchitecture = searchParams.get('model_architecture')
    if (modelArchitecture) {
      filters.model_architecture = modelArchitecture
    }

    const tagsParam = searchParams.get('tags')
    if (tagsParam) {
      filters.tags = tagsParam.split(',')
    }

    const dateFrom = searchParams.get('date_from')
    if (dateFrom) {
      filters.date_from = dateFrom
    }

    const dateTo = searchParams.get('date_to')
    if (dateTo) {
      filters.date_to = dateTo
    }

    const search = searchParams.get('search')
    if (search) {
      filters.search = search
    }

    // Fetch experiments
    const { experiments, error } = await getExperiments(supabase, filters)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch experiments', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ experiments })

  } catch (error) {
    console.error('[CV Experiments API] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cv-experiments
 * Create a new experiment
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
    const body: CreateExperimentParams = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Experiment name is required' },
        { status: 400 }
      )
    }

    // Create experiment
    const { experiment, error } = await createExperiment(supabase, body)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create experiment', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ experiment }, { status: 201 })

  } catch (error) {
    console.error('[CV Experiments API] POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
