/**
 * CV Models Service
 * Handles all database operations for the model registry
 * Related: UNDERWATER_CV_ML_PLATFORM.md, DATA_PROCESSING_RENOVATION_PLAN.md
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface CVModel {
  id: string
  name: string
  version: string
  description: string | null

  architecture: 'yolov8n' | 'yolov8s' | 'yolov8m' | 'yolov8l' | 'yolov8x' | 'custom'
  task: 'fish_detection' | 'snail_detection' | 'crab_detection' | 'shellfish_detection' | 'multi_organism' | 'other'

  weights_path: string
  config_path: string | null

  training_experiment_id: string | null

  performance_metrics: ModelPerformanceMetrics

  status: 'experimental' | 'validated' | 'production' | 'deprecated'

  deployed_at: string | null
  created_at: string
  updated_at: string
}

export interface ModelPerformanceMetrics {
  map50?: number
  map50_95?: number
  precision?: number
  recall?: number
  f1_score?: number
  inference_time_ms?: number
  [key: string]: any
}

export interface ModelWithExperiment extends CVModel {
  training_experiment?: {
    id: string
    name: string
    started_at: string
    completed_at: string | null
    notebook_path: string | null
  }
}

export interface ModelFilters {
  status?: CVModel['status']
  task?: CVModel['task']
  architecture?: CVModel['architecture']
  search?: string
}

export interface CreateModelParams {
  name: string
  version: string
  description?: string
  architecture: CVModel['architecture']
  task: CVModel['task']
  weights_path: string
  config_path?: string
  training_experiment_id?: string
  performance_metrics?: ModelPerformanceMetrics
  status?: CVModel['status']
}

export interface UpdateModelParams {
  description?: string
  performance_metrics?: ModelPerformanceMetrics
  status?: CVModel['status']
  deployed_at?: string
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all models with optional filtering
 */
export async function getModels(supabase: SupabaseClient, filters?: ModelFilters) {

  let query = supabase
    .from('cv_models')
    .select('*')
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.task) {
    query = query.eq('task', filters.task)
  }

  if (filters?.architecture) {
    query = query.eq('architecture', filters.architecture)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching models:', error)
    return { models: null, error }
  }

  return { models: data as CVModel[], error: null }
}

/**
 * Get a single model by ID with training experiment details
 */
export async function getModelById(supabase: SupabaseClient, id: string) {

  const { data, error } = await supabase
    .from('cv_models')
    .select(`
      *,
      training_experiment:cv_experiments!training_experiment_id(
        id,
        name,
        started_at,
        completed_at,
        notebook_path
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching model:', error)
    return { model: null, error }
  }

  return { model: data as ModelWithExperiment, error: null }
}

/**
 * Get model by name and version
 */
export async function getModelByNameVersion(supabase: SupabaseClient, name: string, version: string) {

  const { data, error } = await supabase
    .from('cv_models')
    .select('*')
    .eq('name', name)
    .eq('version', version)
    .single()

  if (error) {
    console.error('Error fetching model:', error)
    return { model: null, error }
  }

  return { model: data as CVModel, error: null }
}

/**
 * Get all versions of a model
 */
export async function getModelVersions(supabase: SupabaseClient, name: string) {

  const { data, error } = await supabase
    .from('cv_models')
    .select('*')
    .eq('name', name)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching model versions:', error)
    return { versions: null, error }
  }

  return { versions: data as CVModel[], error: null }
}

/**
 * Create a new model
 */
export async function createModel(supabase: SupabaseClient, params: CreateModelParams) {

  const { data, error } = await supabase
    .from('cv_models')
    .insert({
      name: params.name,
      version: params.version,
      description: params.description,
      architecture: params.architecture,
      task: params.task,
      weights_path: params.weights_path,
      config_path: params.config_path,
      training_experiment_id: params.training_experiment_id,
      performance_metrics: params.performance_metrics || {},
      status: params.status || 'experimental'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating model:', error)
    return { model: null, error }
  }

  return { model: data as CVModel, error: null }
}

/**
 * Update an existing model
 */
export async function updateModel(supabase: SupabaseClient, id: string, params: UpdateModelParams) {

  const { data, error } = await supabase
    .from('cv_models')
    .update(params)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating model:', error)
    return { model: null, error }
  }

  return { model: data as CVModel, error: null }
}

/**
 * Delete a model
 */
export async function deleteModel(supabase: SupabaseClient, id: string) {

  const { error } = await supabase
    .from('cv_models')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting model:', error)
    return { success: false, error }
  }

  return { success: true, error: null }
}

/**
 * Mark a model as production
 */
export async function promoteModelToProduction(supabase: SupabaseClient, id: string) {

  const { data, error } = await supabase
    .from('cv_models')
    .update({
      status: 'production',
      deployed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error promoting model:', error)
    return { model: null, error }
  }

  return { model: data as CVModel, error: null }
}

/**
 * Mark a model as deprecated
 */
export async function deprecateModel(supabase: SupabaseClient, id: string) {

  const { data, error } = await supabase
    .from('cv_models')
    .update({ status: 'deprecated' })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error deprecating model:', error)
    return { model: null, error }
  }

  return { model: data as CVModel, error: null }
}

/**
 * Get production models only
 */
export async function getProductionModels(supabase: SupabaseClient) {
  return getModels({ status: 'production' })
}

/**
 * Get models by task type
 */
export async function getModelsByTask(supabase: SupabaseClient, task: CVModel['task']) {
  return getModels({ task })
}

/**
 * Get model statistics
 */
export async function getModelStats(supabase: SupabaseClient) {

  const { data, error } = await supabase
    .from('cv_models')
    .select('status, task, performance_metrics')

  if (error) {
    console.error('Error fetching model stats:', error)
    return { stats: null, error }
  }

  const models = data as CVModel[]

  const stats = {
    total: models.length,
    experimental: models.filter(m => m.status === 'experimental').length,
    validated: models.filter(m => m.status === 'validated').length,
    production: models.filter(m => m.status === 'production').length,
    deprecated: models.filter(m => m.status === 'deprecated').length,
    byTask: {
      fish_detection: models.filter(m => m.task === 'fish_detection').length,
      snail_detection: models.filter(m => m.task === 'snail_detection').length,
      crab_detection: models.filter(m => m.task === 'crab_detection').length,
      shellfish_detection: models.filter(m => m.task === 'shellfish_detection').length,
      multi_organism: models.filter(m => m.task === 'multi_organism').length,
      other: models.filter(m => m.task === 'other').length
    },
    avgMap50: models
      .filter(m => m.performance_metrics?.map50)
      .reduce((sum, m, _, arr) => sum + (m.performance_metrics.map50 || 0) / arr.length, 0),
    bestMap50: Math.max(...models.map(m => m.performance_metrics?.map50 || 0))
  }

  return { stats, error: null }
}

/**
 * Get unique task types (for filters)
 */
export async function getUniqueTasks(supabase: SupabaseClient) {

  const { data, error } = await supabase
    .from('cv_models')
    .select('task')

  if (error) {
    console.error('Error fetching tasks:', error)
    return { tasks: null, error }
  }

  const uniqueTasks = [...new Set(data.map(m => m.task))]

  return { tasks: uniqueTasks as CVModel['task'][], error: null }
}
