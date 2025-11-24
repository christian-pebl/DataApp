# Underwater Video CV/ML Experimentation Platform

**Project Start Date:** January 21, 2025
**Author:** Christian Abulhawa
**Status:** Planning & Setup Phase

---

## 📋 Project Overview

### Goal
Build a notebook-style experimentation platform for processing HD 1080p underwater videos to detect and classify marine organisms (fish, snails, crabs, shellfish, etc.) using computer vision and machine learning.

### Key Requirements
- ✅ **Notebook-style experimentation** - Test ideas quickly, save results, iterate
- ✅ **Track all experiments** - Record what was tried, what worked, what didn't
- ✅ **HD video processing** - Handle 1080p underwater footage
- ✅ **Multiple organism detection** - Specialized models for different species
- ✅ **Custom preprocessing** - Underwater color correction, denoising, enhancement
- ✅ **Multi-model pipelines** - Combine multiple detection models
- ✅ **Cost-effective** - Keep cloud costs minimal
- ✅ **Production-ready path** - Easy to deploy validated pipelines

---

## 🏗️ Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: Experimentation                  │
│                  (Jupyter Notebooks - Local PC)              │
│                                                              │
│  - Video preprocessing (OpenCV, color correction)           │
│  - Data exploration and visualization                       │
│  - Algorithm testing and iteration                          │
│  - Results analysis                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓ (GPU-intensive tasks)
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 2: GPU Compute                      │
│                    (Modal.com - Cloud GPU)                   │
│                                                              │
│  - Model training (YOLO, custom models)                     │
│  - Heavy inference (batch video processing)                 │
│  - Parallel experimentation                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓ (log results)
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 3: Tracking & Review                │
│              (Supabase DB + Next.js Web Dashboard)           │
│                                                              │
│  - Experiment history database                              │
│  - Visual comparison dashboard                              │
│  - Model registry and versioning                            │
│  - Team collaboration and sharing                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Technology Stack

### Local Development
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **IDE** | Jupyter Lab | Interactive experimentation environment |
| **Language** | Python 3.11 | All CV/ML code |
| **Video Processing** | OpenCV | Frame extraction, preprocessing, manipulation |
| **ML Framework** | PyTorch + Ultralytics YOLO | Object detection models |
| **Data Science** | Pandas, NumPy, Matplotlib | Data analysis and visualization |
| **Environment** | Conda/Mamba | Dependency management |

### Cloud GPU (Modal.com)
| Feature | Specification | Cost |
|---------|--------------|------|
| **GPU Type** | NVIDIA T4 (16GB VRAM) | $1.44/hour |
| **Billing** | Pay-per-second | Only when running |
| **Integration** | Python SDK | Seamless with Jupyter |
| **Timeout** | Configurable (up to ∞) | No session limits |
| **Parallelization** | Unlimited concurrent jobs | Scale as needed |

### Data & Tracking
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Database** | PostgreSQL (Supabase) | Experiment metadata, results |
| **Storage** | Supabase Storage | Video files, trained models, outputs |
| **Dashboard** | Next.js + React | Experiment visualization |
| **API** | FastAPI (existing) | Backend integrations |

---

## 🖥️ Hardware Specifications

### Local PC (Validated Sufficient)
- **CPU:** AMD Ryzen 7 8745HS (8 cores, 16 threads) ⭐⭐⭐⭐
- **RAM:** 28GB ⭐⭐⭐⭐⭐
- **GPU:** AMD Radeon 780M (4GB VRAM, integrated) ⭐⭐⚠️
- **Storage:** 1.2TB free (C: 613GB, G: 582GB) ⭐⭐⭐⭐

**Local PC Strengths:**
- ✅ Excellent for video preprocessing (8-core CPU)
- ✅ Fast frame extraction and OpenCV operations
- ✅ Can run lightweight inference (YOLOv8n/s on CPU)
- ✅ Plenty of RAM for large datasets
- ✅ Sufficient storage for 100+ hours of 1080p video

**Local PC Limitations:**
- ❌ Not suitable for model training (no CUDA GPU)
- ❌ Slow for heavy inference with large models
- ⚠️ AMD GPU not well-supported by PyTorch/YOLO

**Solution:** Use Modal.com for GPU-intensive tasks

---

## 📊 Workflow

### Daily Experimentation Cycle

```python
# ===== MORNING: Preprocessing (Local PC) =====
# Your Ryzen 7 CPU handles this quickly
video = cv2.VideoCapture("reef_survey_001.mp4")
frames = extract_frames(video)  # ~30-60 seconds for 5-min video

# Try different color correction methods
frames_clahe = apply_clahe(frames, clip_limit=2.0)
frames_retinex = apply_retinex(frames)
frames_white_balance = underwater_color_correct(frames)

# Visualize results immediately
plt.imshow(frames_clahe[0])  # See results in Jupyter


# ===== AFTERNOON: GPU Training (Modal Cloud) =====
# Runs on T4 GPU, costs ~$1.44/hour
@app.function(gpu="T4", timeout=7200)
def train_fish_detector(dataset_path, epochs):
    model = YOLO('yolov8m.pt')
    results = model.train(data=dataset_path, epochs=epochs)
    return results

# Execute on cloud GPU from your notebook
with app.run():
    results = train_fish_detector.remote("fish_dataset.yaml", 100)


# ===== EVENING: Track & Compare (Database + Dashboard) =====
# Log experiment for future reference
tracker.log_experiment(
    name="Fish detection - CLAHE + YOLOv8m",
    preprocessing="clahe_clip_2.0",
    model="yolov8m",
    gpu_time_hours=2.5,
    cost_usd=3.60,
    results={"map50": 0.85, "map50_95": 0.72}
)

# View in web dashboard
# http://localhost:9002/cv-experiments
# Compare all experiments, see what worked best
```

---

## 💰 Cost Analysis

### Monthly Cost Estimates

**Month 1 (Heavy Experimentation):**
- Dataset preparation: Local (free)
- Baseline models (3 models × 2 hours): $8.64
- Experimental models (5 models × 2 hours): $14.40
- Parallel testing (10 hours): $14.40
- Fine-tuning (8 hours): $11.52
- **Total: ~$50-60**

**Month 2+ (Steady State):**
- Weekly training (1-2 models): $2.88-5.76/week
- Monthly inference testing: $5-10
- **Total: ~$15-30/month**

**Comparison:**
- Google Colab Pro: $10/month (session limits, data upload overhead)
- Roboflow: $49-249/month (limited experimentation flexibility)
- Modal: $15-30/month (pay only for GPU time, full flexibility)

**Conclusion:** Modal is cost-effective sweet spot for this workload

---

## 🗂️ Project Structure

### Repository Organization (To Be Created)

```
DataApp/
├── ocean-ml-notebooks/              # Main experimentation directory
│   ├── 01_preprocessing/
│   │   ├── underwater_color_correction.ipynb
│   │   ├── denoising_comparison.ipynb
│   │   ├── contrast_enhancement.ipynb
│   │   └── frame_extraction.ipynb
│   │
│   ├── 02_detection/
│   │   ├── fish_detection_baseline.ipynb
│   │   ├── snail_detection_small_objects.ipynb
│   │   ├── crab_detection.ipynb
│   │   ├── shellfish_detection.ipynb
│   │   └── multi_organism_pipeline.ipynb
│   │
│   ├── 03_training/
│   │   ├── dataset_preparation.ipynb
│   │   ├── yolo_training_fish.ipynb
│   │   ├── yolo_training_snails.ipynb
│   │   ├── model_evaluation.ipynb
│   │   └── hyperparameter_tuning.ipynb
│   │
│   ├── 04_inference/
│   │   ├── batch_video_processing.ipynb
│   │   ├── real_time_detection_test.ipynb
│   │   └── performance_benchmarking.ipynb
│   │
│   ├── 05_pipelines/
│   │   ├── end_to_end_pipeline_v1.ipynb
│   │   ├── multi_model_cascade.ipynb
│   │   └── production_ready_pipeline.ipynb
│   │
│   ├── utils/                        # Reusable Python modules
│   │   ├── __init__.py
│   │   ├── video_utils.py           # Video loading, frame extraction
│   │   ├── preprocessing.py         # Color correction, denoising
│   │   ├── model_utils.py           # Model loading, inference helpers
│   │   ├── experiment_tracker.py    # Database logging
│   │   └── modal_functions.py       # Modal GPU function definitions
│   │
│   ├── datasets/                     # Symlink to video storage
│   │   ├── raw_videos/
│   │   ├── annotated_datasets/
│   │   └── processed_frames/
│   │
│   ├── models/                       # Trained model weights
│   │   ├── fish_detector_v1.pt
│   │   ├── snail_detector_v1.pt
│   │   └── production/
│   │
│   ├── results/                      # Experiment outputs
│   │   ├── 2025-01-21_fish_yolov8m/
│   │   ├── 2025-01-22_preprocessing_comparison/
│   │   └── visualizations/
│   │
│   ├── environment.yml               # Conda environment spec
│   ├── requirements.txt              # Pip dependencies
│   └── README.md                     # Setup instructions
│
├── src/                              # Existing Next.js app
│   ├── app/
│   │   ├── cv-experiments/          # NEW: Experiment dashboard
│   │   │   └── page.tsx
│   │   └── ...
│   ├── components/
│   │   └── cv-experiments/          # NEW: Dashboard components
│   │       ├── ExperimentTable.tsx
│   │       ├── ExperimentDetail.tsx
│   │       ├── ExperimentComparison.tsx
│   │       └── ModelRegistry.tsx
│   └── lib/
│       └── cv-experiment-service.ts # NEW: Database queries
│
├── supabase/
│   └── migrations/
│       └── YYYYMMDD_cv_experiments.sql  # NEW: Database schema
│
└── UNDERWATER_CV_ML_PLATFORM.md     # This document
```

---

## 🗄️ Database Schema

### Experiment Tracking Tables (To Be Implemented)

```sql
-- Core experiments table
CREATE TABLE cv_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users(id),

  -- Input
  video_id TEXT,
  video_filename TEXT,
  video_duration_seconds FLOAT,
  frame_count INTEGER,

  -- Preprocessing
  preprocessing_steps JSONB,
  -- Example: [
  --   {"operation": "clahe", "clip_limit": 2.0},
  --   {"operation": "white_balance", "method": "gray_world"}
  -- ]

  -- Model Configuration
  model_name TEXT,
  model_version TEXT,
  model_architecture TEXT,
  hyperparameters JSONB,
  -- Example: {
  --   "epochs": 100,
  --   "batch_size": 16,
  --   "img_size": 640,
  --   "optimizer": "AdamW",
  --   "lr": 0.001
  -- }

  -- Results
  metrics JSONB,
  -- Example: {
  --   "map50": 0.85,
  --   "map50_95": 0.72,
  --   "precision": 0.88,
  --   "recall": 0.81,
  --   "detections_count": 245
  -- }

  -- Artifacts
  output_model_path TEXT,
  output_images TEXT[],
  output_videos TEXT[],

  -- Execution Metadata
  status TEXT DEFAULT 'completed',
  -- 'running', 'completed', 'failed', 'cancelled'

  gpu_type TEXT,
  gpu_hours FLOAT,
  compute_cost_usd DECIMAL(10, 4),

  duration_seconds FLOAT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Reproducibility
  notebook_path TEXT,
  code_version TEXT,
  git_commit_hash TEXT,
  environment_snapshot JSONB,

  -- Notes
  notes TEXT,
  tags TEXT[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Experiment results/artifacts table
CREATE TABLE cv_experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES cv_experiments(id) ON DELETE CASCADE,

  result_type TEXT NOT NULL,
  -- 'detection_image', 'training_curve', 'confusion_matrix',
  -- 'detection_video', 'metrics_json', 'model_weights'

  file_path TEXT,
  thumbnail_path TEXT,

  metadata JSONB,
  -- Example for detection_image: {
  --   "frame_number": 120,
  --   "detections": 5,
  --   "confidence_avg": 0.78
  -- }

  created_at TIMESTAMP DEFAULT NOW()
);

-- Model registry table
CREATE TABLE cv_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,

  architecture TEXT,
  -- 'yolov8n', 'yolov8s', 'yolov8m', 'yolov8l', 'yolov8x', 'custom'

  task TEXT,
  -- 'fish_detection', 'snail_detection', 'crab_detection', 'multi_organism'

  weights_path TEXT NOT NULL,
  config_path TEXT,

  training_experiment_id UUID REFERENCES cv_experiments(id),

  performance_metrics JSONB,
  -- {
  --   "map50": 0.85,
  --   "map50_95": 0.72,
  --   "inference_time_ms": 45
  -- }

  status TEXT DEFAULT 'experimental',
  -- 'experimental', 'validated', 'production', 'deprecated'

  deployed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(name, version)
);

-- Indexes for performance
CREATE INDEX idx_cv_experiments_user_id ON cv_experiments(user_id);
CREATE INDEX idx_cv_experiments_created_at ON cv_experiments(created_at DESC);
CREATE INDEX idx_cv_experiments_status ON cv_experiments(status);
CREATE INDEX idx_cv_experiments_model_name ON cv_experiments(model_name);
CREATE INDEX idx_cv_experiment_results_experiment_id ON cv_experiment_results(experiment_id);
CREATE INDEX idx_cv_models_status ON cv_models(status);
```

---

## 🚀 Setup Checklist

### Phase 1: Local Environment Setup
- [ ] Install Anaconda/Miniconda
- [ ] Create `oceanml-cv` conda environment
- [ ] Install core dependencies (PyTorch CPU, OpenCV, YOLO, Jupyter)
- [ ] Set up Jupyter Lab
- [ ] Create notebook directory structure
- [ ] Test basic video loading and frame extraction

### Phase 2: Modal.com Integration
- [ ] Create Modal account
- [ ] Install Modal Python SDK
- [ ] Authenticate Modal CLI (`modal token new`)
- [ ] Create test GPU function
- [ ] Test T4 GPU access
- [ ] Create modal_functions.py module
- [ ] Test training function from Jupyter

### Phase 3: Experiment Tracking
- [ ] Create database migration for cv_experiments tables
- [ ] Run migration on Supabase
- [ ] Create ExperimentTracker Python class
- [ ] Test logging experiments to database
- [ ] Create example notebook with tracking

### Phase 4: Web Dashboard
- [ ] Create `/cv-experiments` page in Next.js
- [ ] Build ExperimentTable component
- [ ] Build ExperimentDetail component
- [ ] Build ExperimentComparison component
- [ ] Test viewing experiments from database

### Phase 5: First Experiments
- [ ] Collect sample underwater videos
- [ ] Create preprocessing comparison notebook
- [ ] Test color correction methods
- [ ] Create baseline detection notebook
- [ ] Train first model on Modal GPU
- [ ] Log and compare results

---

## 📝 Development Log

### 2025-01-21 - Project Planning
- ✅ Analyzed system requirements
- ✅ Evaluated local PC specifications (Ryzen 7, 28GB RAM)
- ✅ Compared GPU platforms (Colab vs Modal vs Roboflow)
- ✅ Selected technology stack (Jupyter + Modal + Supabase)
- ✅ Defined architecture (3-layer design)
- ✅ Created project specification document
- **Next:** Begin Phase 1 - Local environment setup

---

## 📚 Resources & References

### Documentation
- [Modal.com Docs](https://modal.com/docs)
- [Ultralytics YOLO](https://docs.ultralytics.com/)
- [OpenCV Python Tutorials](https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html)
- [Underwater Image Enhancement Papers](https://paperswithcode.com/task/underwater-image-enhancement)

### Useful Libraries
- `ultralytics` - YOLO implementation
- `opencv-python` - Computer vision operations
- `modal` - Serverless GPU compute
- `supabase` - Database client
- `pandas`, `numpy`, `matplotlib` - Data science tools

### Community
- Ultralytics Discord
- Modal Community Slack
- r/computervision
- r/MachineLearning

---

## 🎯 Success Metrics

### Short-term (1 Month)
- [ ] Successfully process 10+ underwater videos
- [ ] Train 5+ detection models with different configurations
- [ ] Log 20+ experiments to database
- [ ] Identify best preprocessing approach for underwater footage
- [ ] Achieve >0.7 mAP50 on fish detection

### Medium-term (3 Months)
- [ ] Build multi-organism detection pipeline (fish + snails + crabs)
- [ ] Create 10+ specialized models for different organism types
- [ ] Process 100+ hours of underwater footage
- [ ] Develop production-ready inference pipeline
- [ ] Document best practices for underwater CV

### Long-term (6 Months)
- [ ] Deploy automated video processing system
- [ ] Integrate with existing web dashboard
- [ ] Enable batch processing via API
- [ ] Build model versioning and rollback system
- [ ] Share findings with marine biology community

---

## 🤔 Open Questions

1. **Dataset**: Do we have existing annotated underwater datasets, or do we need to create them?
2. **Annotation Tool**: Which tool for annotating bounding boxes? (CVAT, Labelbox, Roboflow annotator?)
3. **Video Storage**: Where are raw videos stored currently? Need cloud storage?
4. **Team Access**: Will multiple people be running experiments? Need multi-user setup?
5. **Production SLA**: What are latency/throughput requirements for production inference?

---

## 📞 Contact & Support

**Project Owner:** Christian Abulhawa
**Repository:** DataApp (local)
**Documentation:** This file

---

*This document is a living specification and will be updated as the project evolves.*

**Last Updated:** January 21, 2025
