/**
 * CV Experiments Service
 * Handles all database operations for CV/ML experiments
 * Related: UNDERWATER_CV_ML_PLATFORM.md, DATA_PROCESSING_RENOVATION_PLAN.md
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface CVExperiment {
  id: string
  name: string
  description: string | null
  user_id: string

  // Input
  video_id: string | null
  video_filename: string | null
  video_duration_seconds: number | null
  frame_count: number | null

  // Preprocessing
  preprocessing_steps: PreprocessingStep[]

  // Model Configuration
  model_name: string | null
  model_version: string | null
  model_architecture: string | null
  hyperparameters: Record<string, any>

  // Results
  metrics: ExperimentMetrics

  // Artifacts
  output_model_path: string | null
  output_images: string[]
  output_videos: string[]

  // Execution Metadata
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  gpu_type: string | null
  gpu_hours: number | null
  compute_cost_usd: number | null
  duration_seconds: number | null
  started_at: string
  completed_at: string | null

  // Reproducibility
  notebook_path: string | null
  code_version: string | null
  git_commit_hash: string | null
  environment_snapshot: Record<string, any> | null

  // Notes
  notes: string | null
  tags: string[]

  created_at: string
  updated_at: string
}

export interface PreprocessingStep {
  operation: string
  [key: string]: any
}

export interface ExperimentMetrics {
  map50?: number
  map50_95?: number
  precision?: number
  recall?: number
  f1_score?: number
  detections_count?: number
  [key: string]: any
}

export interface ExperimentResult {
  id: string
  experiment_id: string
  result_type: 'detection_image' | 'training_curve' | 'confusion_matrix' | 'detection_video' | 'metrics_json' | 'model_weights'
  file_path: string | null
  thumbnail_path: string | null
  metadata: Record<string, any>
  created_at: string
}

export interface ExperimentWithResults extends CVExperiment {
  results: ExperimentResult[]
}

export interface ExperimentFilters {
  status?: 'running' | 'completed' | 'failed' | 'cancelled'
  model_name?: string
  model_architecture?: string
  tags?: string[]
  date_from?: string
  date_to?: string
  search?: string
}

export interface CreateExperimentParams {
  name: string
  description?: string
  video_filename?: string
  video_duration_seconds?: number
  frame_count?: number
  preprocessing_steps?: PreprocessingStep[]
  model_name?: string
  model_version?: string
  model_architecture?: string
  hyperparameters?: Record<string, any>
  notebook_path?: string
  tags?: string[]
}

export interface UpdateExperimentParams {
  name?: string
  description?: string
  status?: 'running' | 'completed' | 'failed' | 'cancelled'
  metrics?: ExperimentMetrics
  output_model_path?: string
  output_images?: string[]
  output_videos?: string[]
  gpu_type?: string
  gpu_hours?: number
  compute_cost_usd?: number
  duration_seconds?: number
  completed_at?: string
  git_commit_hash?: string
  environment_snapshot?: Record<string, any>
  notes?: string
  tags?: string[]
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all experiments for the current user
 */
export async function getExperiments(supabase: SupabaseClient, filters?: ExperimentFilters) {

  let query = supabase
    .from('cv_experiments')
    .select('*')
    .order('started_at', { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.model_name) {
    query = query.eq('model_name', filters.model_name)
  }

  if (filters?.model_architecture) {
    query = query.eq('model_architecture', filters.model_architecture)
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags)
  }

  if (filters?.date_from) {
    query = query.gte('started_at', filters.date_from)
  }

  if (filters?.date_to) {
    query = query.lte('started_at', filters.date_to)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,video_filename.ilike.%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching experiments:', error)
    return { experiments: null, error }
  }

  return { experiments: data as CVExperiment[], error: null }
}

/**
 * Get a single experiment by ID with its results
 */
export async function getExperimentById(supabase: SupabaseClient, id: string) {

  const { data, error } = await supabase
    .from('cv_experiments')
    .select(`
      *,
      results:cv_experiment_results(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching experiment:', error)
    return { experiment: null, error }
  }

  return { experiment: data as ExperimentWithResults, error: null }
}

/**
 * Get multiple experiments by IDs (for comparison)
 */
export async function getExperimentsByIds(supabase: SupabaseClient, ids: string[]) {

  const { data, error } = await supabase
    .from('cv_experiments')
    .select(`
      *,
      results:cv_experiment_results(*)
    `)
    .in('id', ids)

  if (error) {
    console.error('Error fetching experiments:', error)
    return { experiments: null, error }
  }

  return { experiments: data as ExperimentWithResults[], error: null }
}

/**
 * Create a new experiment
 */
export async function createExperiment(supabase: SupabaseClient, params: CreateExperimentParams) {

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { experiment: null, error: userError || new Error('Not authenticated') }
  }

  const { data, error } = await supabase
    .from('cv_experiments')
    .insert({
      name: params.name,
      description: params.description,
      user_id: user.id,
      video_filename: params.video_filename,
      video_duration_seconds: params.video_duration_seconds,
      frame_count: params.frame_count,
      preprocessing_steps: params.preprocessing_steps || [],
      model_name: params.model_name,
      model_version: params.model_version,
      model_architecture: params.model_architecture,
      hyperparameters: params.hyperparameters || {},
      notebook_path: params.notebook_path,
      tags: params.tags || [],
      status: 'running',
      started_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating experiment:', error)
    return { experiment: null, error }
  }

  return { experiment: data as CVExperiment, error: null }
}

/**
 * Update an existing experiment
 */
export async function updateExperiment(supabase: SupabaseClient, id: string, params: UpdateExperimentParams) {

  const { data, error } = await supabase
    .from('cv_experiments')
    .update(params)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating experiment:', error)
    return { experiment: null, error }
  }

  return { experiment: data as CVExperiment, error: null }
}

/**
 * Delete an experiment
 */
export async function deleteExperiment(supabase: SupabaseClient, id: string) {

  const { error } = await supabase
    .from('cv_experiments')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting experiment:', error)
    return { success: false, error }
  }

  return { success: true, error: null }
}

/**
 * Add a result/artifact to an experiment
 */
export async function addExperimentResult(
  supabase: SupabaseClient,
  experimentId: string,
  resultType: ExperimentResult['result_type'],
  filePath: string,
  metadata?: Record<string, any>,
  thumbnailPath?: string
) {
  const { data, error} = await supabase
    .from('cv_experiment_results')
    .insert({
      experiment_id: experimentId,
      result_type: resultType,
      file_path: filePath,
      thumbnail_path: thumbnailPath,
      metadata: metadata || {}
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding experiment result:', error)
    return { result: null, error }
  }

  return { result: data as ExperimentResult, error: null }
}

/**
 * Get experiment statistics
 */
export async function getExperimentStats(supabase: SupabaseClient) {

  const { data, error } = await supabase
    .from('cv_experiments')
    .select('status, compute_cost_usd, metrics')

  if (error) {
    console.error('Error fetching experiment stats:', error)
    return { stats: null, error }
  }

  const experiments = data as CVExperiment[]

  const stats = {
    total: experiments.length,
    completed: experiments.filter(e => e.status === 'completed').length,
    running: experiments.filter(e => e.status === 'running').length,
    failed: experiments.filter(e => e.status === 'failed').length,
    totalCost: experiments.reduce((sum, e) => sum + (e.compute_cost_usd || 0), 0),
    avgMap50: experiments
      .filter(e => e.metrics?.map50)
      .reduce((sum, e, _, arr) => sum + (e.metrics.map50 || 0) / arr.length, 0),
    bestMap50: Math.max(...experiments.map(e => e.metrics?.map50 || 0))
  }

  return { stats, error: null }
}

/**
 * Get recent experiments (last 7 days)
 */
export async function getRecentExperiments(supabase: SupabaseClient, days: number = 7) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const { data, error } = await supabase
    .from('cv_experiments')
    .select('*')
    .gte('started_at', cutoffDate.toISOString())
    .order('started_at', { ascending: false })

  if (error) {
    console.error('Error fetching recent experiments:', error)
    return { experiments: null, error }
  }

  return { experiments: data as CVExperiment[], error: null }
}

/**
 * Get unique model names (for filters)
 */
export async function getUniqueModelNames(supabase: SupabaseClient) {

  const { data, error } = await supabase
    .from('cv_experiments')
    .select('model_name')
    .not('model_name', 'is', null)

  if (error) {
    console.error('Error fetching model names:', error)
    return { modelNames: null, error }
  }

  const uniqueNames = [...new Set(data.map(e => e.model_name).filter(Boolean))]

  return { modelNames: uniqueNames as string[], error: null }
}

/**
 * Get unique tags (for filters)
 */
export async function getUniqueTags(supabase: SupabaseClient) {

  const { data, error } = await supabase
    .from('cv_experiments')
    .select('tags')

  if (error) {
    console.error('Error fetching tags:', error)
    return { tags: null, error }
  }

  const allTags = data.flatMap(e => e.tags || [])
  const uniqueTags = [...new Set(allTags)]

  return { tags: uniqueTags, error: null }
}
