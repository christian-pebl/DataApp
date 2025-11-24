/**
 * CV Models API Routes
 * GET /api/cv-models - Get all models with optional filtering
 * POST /api/cv-models - Create a new model
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getModels,
  createModel,
  getProductionModels,
  getModelsByTask,
  getModelStats,
  type ModelFilters,
  type CreateModelParams
} from '@/lib/supabase/cv-models-service'

/**
 * GET /api/cv-models
 * Query params:
 * - status: experimental | validated | production | deprecated
 * - task: fish_detection | snail_detection | crab_detection | shellfish_detection | multi_organism | other
 * - architecture: yolov8n | yolov8s | yolov8m | yolov8l | yolov8x | custom
 * - search: string
 * - production: boolean (if true, only return production models)
 * - stats: boolean (if true, return statistics instead of models)
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
      const { stats, error } = await getModelStats(supabase)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch model statistics', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ stats })
    }

    // Check for production models only
    if (searchParams.get('production') === 'true') {
      const { models, error } = await getProductionModels(supabase)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch production models', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ models })
    }

    // Check for task-specific models
    const task = searchParams.get('task')
    if (task) {
      const { models, error } = await getModelsByTask(supabase, task as any)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch models by task', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ models })
    }

    // Build filters
    const filters: ModelFilters = {}

    const status = searchParams.get('status')
    if (status) {
      filters.status = status as any
    }

    const architecture = searchParams.get('architecture')
    if (architecture) {
      filters.architecture = architecture as any
    }

    const search = searchParams.get('search')
    if (search) {
      filters.search = search
    }

    // Fetch models
    const { models, error } = await getModels(supabase, filters)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch models', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ models })

  } catch (error) {
    console.error('[CV Models API] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cv-models
 * Create a new model
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
    const body: CreateModelParams = await request.json()

    // Validate required fields
    if (!body.name || !body.version || !body.architecture || !body.task || !body.weights_path) {
      return NextResponse.json(
        { error: 'name, version, architecture, task, and weights_path are required' },
        { status: 400 }
      )
    }

    // Create model
    const { model, error } = await createModel(supabase, body)

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A model with this name and version already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create model', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ model }, { status: 201 })

  } catch (error) {
    console.error('[CV Models API] POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
