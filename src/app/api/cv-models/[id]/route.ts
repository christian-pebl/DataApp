/**
 * CV Models API Routes - Single Model
 * GET /api/cv-models/[id] - Get a single model with experiment details
 * PATCH /api/cv-models/[id] - Update a model
 * DELETE /api/cv-models/[id] - Delete a model
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getModelById,
  updateModel,
  deleteModel,
  promoteModelToProduction,
  deprecateModel,
  type UpdateModelParams
} from '@/lib/supabase/cv-models-service'

/**
 * GET /api/cv-models/[id]
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

    const { model, error } = await getModelById(supabase, params.id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Model not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch model', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ model })

  } catch (error) {
    console.error('[CV Models API] GET [id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/cv-models/[id]
 * Update model or change status
 * Special actions:
 * - { action: 'promote' } - Promote to production
 * - { action: 'deprecate' } - Mark as deprecated
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
    const body = await request.json()

    // Check for special actions
    if (body.action === 'promote') {
      const { model, error } = await promoteModelToProduction(supabase, params.id)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to promote model', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ model, message: 'Model promoted to production' })
    }

    if (body.action === 'deprecate') {
      const { model, error } = await deprecateModel(supabase, params.id)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to deprecate model', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ model, message: 'Model deprecated' })
    }

    // Regular update
    const updateParams: UpdateModelParams = body

    const { model, error } = await updateModel(supabase, params.id, updateParams)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Model not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update model', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ model })

  } catch (error) {
    console.error('[CV Models API] PATCH [id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cv-models/[id]
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

    // Delete model
    const { success, error } = await deleteModel(supabase, params.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete model', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success })

  } catch (error) {
    console.error('[CV Models API] DELETE [id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
