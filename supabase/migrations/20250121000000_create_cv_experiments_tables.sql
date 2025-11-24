-- CV/ML Experiments Tracking System
-- Created: 2025-01-21
-- Purpose: Track underwater video CV/ML experimentation workflow
-- Related: UNDERWATER_CV_ML_PLATFORM.md

-- Core experiments table
CREATE TABLE IF NOT EXISTS cv_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input
  video_id TEXT,
  video_filename TEXT,
  video_duration_seconds FLOAT,
  frame_count INTEGER,

  -- Preprocessing
  preprocessing_steps JSONB DEFAULT '[]'::jsonb,

  -- Model Configuration
  model_name TEXT,
  model_version TEXT,
  model_architecture TEXT,
  hyperparameters JSONB DEFAULT '{}'::jsonb,

  -- Results
  metrics JSONB DEFAULT '{}'::jsonb,

  -- Artifacts
  output_model_path TEXT,
  output_images TEXT[] DEFAULT ARRAY[]::TEXT[],
  output_videos TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Execution Metadata
  status TEXT DEFAULT 'completed',

  gpu_type TEXT,
  gpu_hours FLOAT,
  compute_cost_usd DECIMAL(10, 4),

  duration_seconds FLOAT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Reproducibility
  notebook_path TEXT,
  code_version TEXT,
  git_commit_hash TEXT,
  environment_snapshot JSONB,

  -- Notes
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);

-- Experiment results/artifacts table
CREATE TABLE IF NOT EXISTS cv_experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES cv_experiments(id) ON DELETE CASCADE,

  result_type TEXT NOT NULL,

  file_path TEXT,
  thumbnail_path TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_result_type CHECK (result_type IN (
    'detection_image',
    'training_curve',
    'confusion_matrix',
    'detection_video',
    'metrics_json',
    'model_weights'
  ))
);

-- Model registry table
CREATE TABLE IF NOT EXISTS cv_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,

  architecture TEXT,

  task TEXT,

  weights_path TEXT NOT NULL,
  config_path TEXT,

  training_experiment_id UUID REFERENCES cv_experiments(id) ON DELETE SET NULL,

  performance_metrics JSONB DEFAULT '{}'::jsonb,

  status TEXT DEFAULT 'experimental',

  deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_architecture CHECK (architecture IN (
    'yolov8n', 'yolov8s', 'yolov8m', 'yolov8l', 'yolov8x', 'custom'
  )),
  CONSTRAINT valid_task CHECK (task IN (
    'fish_detection',
    'snail_detection',
    'crab_detection',
    'shellfish_detection',
    'multi_organism',
    'other'
  )),
  CONSTRAINT valid_model_status CHECK (status IN (
    'experimental', 'validated', 'production', 'deprecated'
  )),
  UNIQUE(name, version)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cv_experiments_user_id ON cv_experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_experiments_created_at ON cv_experiments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_experiments_started_at ON cv_experiments(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_experiments_status ON cv_experiments(status);
CREATE INDEX IF NOT EXISTS idx_cv_experiments_model_name ON cv_experiments(model_name);
CREATE INDEX IF NOT EXISTS idx_cv_experiments_tags ON cv_experiments USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_cv_experiment_results_experiment_id ON cv_experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_cv_experiment_results_type ON cv_experiment_results(result_type);

CREATE INDEX IF NOT EXISTS idx_cv_models_status ON cv_models(status);
CREATE INDEX IF NOT EXISTS idx_cv_models_task ON cv_models(task);
CREATE INDEX IF NOT EXISTS idx_cv_models_name_version ON cv_models(name, version);

-- Row Level Security (RLS) Policies
ALTER TABLE cv_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_experiment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_models ENABLE ROW LEVEL SECURITY;

-- cv_experiments policies
CREATE POLICY "Users can view their own experiments"
  ON cv_experiments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own experiments"
  ON cv_experiments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own experiments"
  ON cv_experiments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own experiments"
  ON cv_experiments FOR DELETE
  USING (auth.uid() = user_id);

-- cv_experiment_results policies (inherit from parent experiment)
CREATE POLICY "Users can view results of their experiments"
  ON cv_experiment_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cv_experiments
      WHERE cv_experiments.id = cv_experiment_results.experiment_id
      AND cv_experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert results for their experiments"
  ON cv_experiment_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cv_experiments
      WHERE cv_experiments.id = cv_experiment_results.experiment_id
      AND cv_experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update results of their experiments"
  ON cv_experiment_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cv_experiments
      WHERE cv_experiments.id = cv_experiment_results.experiment_id
      AND cv_experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete results of their experiments"
  ON cv_experiment_results FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cv_experiments
      WHERE cv_experiments.id = cv_experiment_results.experiment_id
      AND cv_experiments.user_id = auth.uid()
    )
  );

-- cv_models policies (models are user-specific)
CREATE POLICY "Users can view all models"
  ON cv_models FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own models"
  ON cv_models FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cv_experiments
      WHERE cv_experiments.id = cv_models.training_experiment_id
      AND cv_experiments.user_id = auth.uid()
    )
    OR training_experiment_id IS NULL
  );

CREATE POLICY "Users can update models from their experiments"
  ON cv_models FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cv_experiments
      WHERE cv_experiments.id = cv_models.training_experiment_id
      AND cv_experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete models from their experiments"
  ON cv_models FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cv_experiments
      WHERE cv_experiments.id = cv_models.training_experiment_id
      AND cv_experiments.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cv_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER cv_experiments_updated_at
  BEFORE UPDATE ON cv_experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_cv_updated_at();

CREATE TRIGGER cv_models_updated_at
  BEFORE UPDATE ON cv_models
  FOR EACH ROW
  EXECUTE FUNCTION update_cv_updated_at();

-- Comments for documentation
COMMENT ON TABLE cv_experiments IS 'Tracks CV/ML experiments for underwater video organism detection';
COMMENT ON TABLE cv_experiment_results IS 'Stores artifacts and results from CV experiments (images, videos, metrics)';
COMMENT ON TABLE cv_models IS 'Registry of trained models with versioning and performance tracking';

COMMENT ON COLUMN cv_experiments.preprocessing_steps IS 'Array of preprocessing operations applied (e.g., [{"op": "clahe", "clip_limit": 2.0}])';
COMMENT ON COLUMN cv_experiments.hyperparameters IS 'Model training hyperparameters (epochs, batch_size, lr, etc.)';
COMMENT ON COLUMN cv_experiments.metrics IS 'Performance metrics (mAP50, mAP50-95, precision, recall, etc.)';
COMMENT ON COLUMN cv_experiments.status IS 'Experiment status: running, completed, failed, cancelled';
COMMENT ON COLUMN cv_experiments.gpu_type IS 'GPU used (e.g., T4, A10G, A100)';
COMMENT ON COLUMN cv_experiments.compute_cost_usd IS 'Cost in USD for GPU time';

COMMENT ON COLUMN cv_models.architecture IS 'Model architecture (yolov8n, yolov8s, yolov8m, yolov8l, yolov8x, custom)';
COMMENT ON COLUMN cv_models.task IS 'Detection task (fish_detection, snail_detection, crab_detection, etc.)';
COMMENT ON COLUMN cv_models.status IS 'Model status: experimental, validated, production, deprecated';
