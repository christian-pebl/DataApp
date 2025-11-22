# CV/ML Experiments Platform - Progress Notes

## Session Date: January 2025

---

## Overview

This session focused on setting up underwater computer vision capabilities for analyzing benthic monitoring videos from the Algapelago seaweed farm in Lyme Bay, UK.

**Primary Goal:** Identify and test open-source pretrained models for fish, crab, and shellfish detection in underwater benthic footage.

**Outcome:** Successfully completed baseline testing, documented model limitations, and identified path forward with specialized underwater models.

---

## Session Timeline

### 1. Research Phase (30 minutes)
**Task:** Online research to identify available open-source CV/ML models for underwater detection

**Method:**
- Conducted 5 targeted web searches
- Focused on: underwater fish detection, benthic monitoring, YOLOv8 variants, marine datasets

**Key Findings:**
- **Models Identified:** YOLO-Fish, FathomNet, Marine-Detect, multiple YOLOv8 variants
- **Datasets Found:** Brackish (perfect match), DeepFish, FathomNet, BenthicNet, SUIM
- **Critical Insight:** Brackish dataset is ideal for our use case (coastal, fixed camera, includes crabs and fish)

**Output:** Created `UNDERWATER_CV_ML_RESOURCES.md` (487 lines, comprehensive guide)

### 2. Environment Setup (15 minutes)
**Task:** Install dependencies and prepare for model testing

**Actions:**
```bash
pip install ultralytics torch torchvision opencv-python
```

**Packages Installed:**
- ultralytics (YOLOv8 framework)
- torch + torchvision (PyTorch 2.x)
- opencv-python (video processing)

**Verification:** Successfully imported YOLO, confirmed CUDA not available (CPU mode)

### 3. Repository Exploration (10 minutes)
**Task:** Clone YOLO-Fish repository and assess setup complexity

**Discovery:**
- YOLO-Fish uses older Darknet framework
- Requires manual compilation and weight downloads
- Complex setup process for Windows

**Decision:** Pivot to modern YOLOv8 approach for baseline testing

### 4. Baseline Test Development (20 minutes)
**Task:** Create test script to establish baseline with standard YOLOv8

**Output:** `test_yolov8_underwater.py` (166 lines)

**Features:**
- Frame-by-frame video processing
- Comprehensive statistics collection
- JSON output for results
- Support for multiple videos
- Detailed progress reporting

**Test Configuration:**
- Model: YOLOv8n (nano - fastest variant)
- Videos: 3 Algapelago samples (morning, midday, afternoon)
- Confidence threshold: 0.25 (lowered for underwater)
- Processing: CPU-only, local execution

### 5. Baseline Testing (30 minutes)
**Task:** Run YOLOv8n (COCO pretrained) on Algapelago videos

**Test Videos:**
1. algapelago_1_2025-06-20_14-00-48.mp4 (14:00 - Afternoon)
2. algapelago_1_2025-06-25_10-00-48.mp4 (10:00 - Morning)
3. algapelago_1_2025-06-25_12-00-48.mp4 (12:00 - Midday)

**Test Parameters:**
- Frames per video: 2,883 (~5 minutes @ 10 FPS)
- Total frames tested: 8,649
- Processing speed: 26-30ms per frame
- Average FPS: 33-38 frames/second

**Results:**
```
Total Detections: 0
Frames with Detections: 0
Detection Rate: 0.0%
Classes Detected: (none)
```

**Critical Discovery:** YOLOv8 COCO dataset contains NO fish class
- 80 total classes
- Closest match: "bird" (class 14)
- No marine organisms whatsoever

### 6. Analysis and Documentation (25 minutes)
**Task:** Analyze baseline results and document findings

**Output:** `YOLOV8_BASELINE_TEST_REPORT.md` (500+ lines)

**Report Sections:**
- Executive summary
- Test configuration
- Detailed results per video
- Analysis of why zero detections
- COCO class limitations
- Domain shift (terrestrial → underwater)
- Performance metrics
- Validation of research findings
- Recommendations for next steps

**Key Insights:**
- Standard COCO-trained models fundamentally unsuitable
- Specialized underwater models essential
- Baseline (0% detection) establishes clear improvement metric
- Next phase: Test FathomNet, Marine-Detect, or YOLO-Fish

---

## Files Created

### 1. UNDERWATER_CV_ML_RESOURCES.md
**Size:** 487 lines
**Purpose:** Comprehensive research guide

**Contents:**
- Your video characteristics (84 videos, 3x daily, benthic monitoring)
- 6 ready-to-use pretrained models with download links
- 5 datasets for fine-tuning (Brackish, FathomNet, DeepFish, etc.)
- Phased implementation approach (4 phases, 6-8 weeks to production)
- Quick start commands
- Expected performance metrics
- Model recommendations per experiment type

**Key Sections:**
- Ready-to-Use Models (YOLO-Fish, FathomNet, Marine-Detect)
- Datasets (Brackish as perfect match)
- 5-Phase Implementation Roadmap
- Expected Timeline & Performance

### 2. test_yolov8_underwater.py
**Size:** 166 lines
**Purpose:** Baseline testing framework

**Features:**
- Video processing with statistics collection
- Frame-by-frame detection logging
- Class distribution tracking
- Confidence score analysis
- JSON output for integration
- Progress reporting
- Error handling

**Reusability:** Can be adapted for specialized models (FathomNet, Marine-Detect)

### 3. YOLOV8_BASELINE_TEST_REPORT.md
**Size:** 500+ lines
**Purpose:** Document baseline failure and validate research

**Contents:**
- Executive summary
- Test configuration and parameters
- Detailed results (3 videos, 8,649 frames)
- Analysis: Why zero detections?
- COCO dataset limitations (full class list)
- Domain shift explanation
- Performance metrics
- Validation of research findings
- Recommendations for next steps
- Appendix: All 80 COCO classes

**Use Cases:**
- Research documentation
- Grant proposals
- Stakeholder reports
- Baseline comparison for future tests

### 4. CV_ML_PROGRESS_NOTES.md (This File)
**Purpose:** Comprehensive session summary for GitHub commit

---

## Technical Discoveries

### Discovery 1: COCO Dataset Limitations
**Finding:** YOLOv8 pretrained on COCO has no fish or marine organism classes

**Impact:**
- Explains why standard models fail on underwater footage
- Validates need for specialized models
- Provides clear justification for using FathomNet, YOLO-Fish, or Marine-Detect

**Classes Missing:**
- Fish (all species)
- Crabs
- Shellfish
- Jellyfish
- Any aquatic life

**Closest Match:** "bird" (class 14) - fundamentally different from fish

### Discovery 2: Domain Shift (Terrestrial → Underwater)
**Finding:** Underwater imagery has fundamentally different visual characteristics

**Differences:**
| COCO Training | Algapelago Videos |
|--------------|-------------------|
| Clear lighting | Variable underwater lighting |
| Sharp contrast | Turbidity reduces contrast |
| Distinct boundaries | Seaweed occlusion |
| Static objects | Fast-moving fish |
| RGB accuracy | Blue-green dominance |

**Impact:** Even if COCO had a "fish" class, the feature extractors are trained on terrestrial statistics and would perform poorly.

### Discovery 3: Inference Speed Acceptable
**Finding:** CPU-only inference at 26-30ms per frame (33-38 FPS)

**Implication:**
- Speed is not a bottleneck
- Problem is model capability, not performance
- Can proceed with CPU testing before GPU deployment
- Real-time processing feasible for production

### Discovery 4: Brackish Dataset Perfect Match
**Finding:** Brackish dataset closely matches Algapelago environment

**Similarities:**
- Fixed benthic camera (same perspective)
- Coastal shallow water (similar to Lyme Bay)
- Includes target organisms (crabs, fish)
- 25,613 annotations across 14,674 images
- From Limfjords bridge, Denmark (similar latitude)

**Recommendation:** Use Brackish as fine-tuning dataset after initial specialized model testing

---

## Next Steps (Prioritized)

### Phase 1: Specialized Model Testing (1-2 days)
**Goal:** Establish realistic performance baseline with underwater-trained models

**Options:**
1. **FathomNet Model (Recommended - Easiest)**
   - Download from Hugging Face
   - Modern PyTorch implementation
   - Trained on 1.3M seafloor images
   - Covers 1000+ marine species
   - Expected mAP50: 75-80%

2. **Marine-Detect (Alternative - Industrial Grade)**
   - Clone from GitHub
   - Ready-to-use prediction scripts
   - Fish + invertebrates detector
   - Orange OpenSource (well-maintained)
   - Expected mAP50: 75-80%

3. **YOLO-Fish (Complex - Best for Fish)**
   - Download weights from Google Drive
   - Requires Darknet compilation
   - Trained on DeepFish + OzFish
   - Expected mAP50: 70-75%

**Action Items:**
- [ ] Download FathomNet model from Hugging Face
- [ ] Test on same 3 Algapelago videos
- [ ] Compare results with baseline (0% detection)
- [ ] Measure: detection rate, precision, recall, class distribution
- [ ] Document results in new report

**Expected Outcome:**
- Detection rate: 40-60% of frames
- Fish detected: High confidence
- Crabs/shellfish: Lower confidence (may need fine-tuning)
- Clear improvement over 0% baseline

### Phase 2: Dataset Preparation (1 week)
**Goal:** Prepare data for fine-tuning

**Action Items:**
- [ ] Download Brackish dataset from Roboflow
- [ ] Set up Roboflow account for annotation
- [ ] Annotate 200-500 Algapelago frames
  - Sample across all time periods (10:00, 12:00, 14:00)
  - Include diverse conditions (lighting, turbidity)
  - Label: fish, crabs, shellfish, other organisms
- [ ] Export in YOLOv8 format
- [ ] Combine Brackish + Algapelago into training dataset

**Expected Outcome:**
- 14,674 Brackish images + 200-500 Algapelago frames
- Custom dataset tailored to Lyme Bay environment
- Ready for fine-tuning

### Phase 3: Fine-Tuning (2-3 weeks)
**Goal:** Train Algapelago-specific model

**Action Items:**
- [ ] Fine-tune best-performing model (FathomNet or Marine-Detect)
- [ ] Training config: 100 epochs, batch=16, img=640
- [ ] Early stopping with patience=20
- [ ] Track mAP50, precision, recall
- [ ] Save best weights

**Expected Outcome:**
- mAP50: 85-90% on Algapelago-specific footage
- Improved crab/shellfish detection
- Time-of-day robustness (morning/midday/afternoon)

### Phase 4: Preprocessing Pipeline (1 week)
**Goal:** Improve detection through image enhancement

**Action Items:**
- [ ] Implement CLAHE (Contrast Limited Adaptive Histogram Equalization)
- [ ] Add denoising (fastNlMeansDenoisingColored)
- [ ] A/B test: with/without preprocessing
- [ ] Measure mAP50 improvement

**Expected Outcome:**
- +10-15% mAP50 improvement (research shows +12.6%)
- Better low-light performance
- Reduced turbidity impact

### Phase 5: Architecture Comparison (1 week)
**Goal:** Optimize speed vs accuracy tradeoff

**Action Items:**
- [ ] Test YOLOv8n, YOLOv8s, YOLOv8m on same videos
- [ ] Measure: inference time, mAP50, precision, recall
- [ ] Compare model sizes and memory usage
- [ ] Select production model

**Expected Results:**
- YOLOv8n: ~12ms, 80% mAP50 (fastest)
- YOLOv8s: ~19ms, 85% mAP50 (balanced)
- YOLOv8m: ~31ms, 88% mAP50 (most accurate)

### Phase 6: Batch Processing (1 week)
**Goal:** Process all 84 Algapelago videos

**Action Items:**
- [ ] Deploy to Modal GPU for faster processing
- [ ] Create batch processing script
- [ ] Process all videos (10:00, 12:00, 14:00 × 28 days)
- [ ] Save results to cv_experiments table
- [ ] Generate detection statistics

**Expected Outcome:**
- All 84 videos processed
- Detection data in database
- Temporal analysis of fish activity
- Ready for visualization in CV dashboard

---

## Database Integration Plan

### Tables Already Created
From previous session with simulated data:

**cv_experiments table:**
- 9 experiment records (Exp 1-5, baseline/multi-organism/temporal/architecture)
- Sample metrics: mAP50, precision, recall, detections_count
- Links to video files, preprocessing steps, hyperparameters

**cv_models table:**
- 4 model records (Baseline, Multi-Organism, Enhanced, High Accuracy)
- Version tracking, performance metrics
- Deployment status (experimental, validated, production)

### Next Steps for Real Data
Once specialized models tested:

**1. Create New Experiments:**
```sql
INSERT INTO cv_experiments (
  name, description, video_filename,
  model_name, model_version,
  metrics, tags
) VALUES (
  'FathomNet Baseline Test',
  'Initial test of FathomNet pretrained model on Algapelago footage',
  'algapelago_1_2025-06-20_14-00-48.mp4',
  'fathomnet-baseline',
  'v1.0',
  '{"map50": 0.78, "detections_count": 1523, ...}'::jsonb,
  '{underwater, fish, baseline, fathomnet}'::text[]
);
```

**2. Create Model Records:**
```sql
INSERT INTO cv_models (
  name, version, architecture,
  weights_path, performance_metrics,
  status
) VALUES (
  'FathomNet Benthic Detector',
  'v1.0-pretrained',
  'fathomnet-yolov8',
  '/models/fathomnet_benthic_v1.pt',
  '{"map50": 0.78, "precision": 0.82, ...}'::jsonb,
  'validated'
);
```

**3. Link Experiments to Dashboard:**
- Display in CV Experiments page
- Filter by tags (underwater, fish, temporal, etc.)
- Compare across models
- Track improvement over baseline

---

## Repository Structure

```
DataApp/
├── YOLO-Fish/                          # Cloned repository (Darknet-based)
├── test_yolov8_underwater.py           # Baseline test script
├── UNDERWATER_CV_ML_RESOURCES.md       # Comprehensive research guide
├── YOLOV8_BASELINE_TEST_REPORT.md      # Baseline test results
├── CV_ML_PROGRESS_NOTES.md             # This file - session summary
├── algapelago_full_dataset.sql         # Sample experiment data
├── create_algapelago_models.sql        # Sample model data
├── populate-algapelago-data.js         # Previous data population script
└── yolov8_test_results/                # Test output directory
    └── (empty - baseline had zero detections)
```

---

## Key Metrics

### Baseline Test Statistics
- **Videos Tested:** 3
- **Total Frames:** 8,649
- **Frames with Detections:** 0
- **Detection Rate:** 0.0%
- **Processing Time:** ~225 seconds total
- **Average Speed:** 26-30ms per frame
- **Average FPS:** 33-38 frames/second

### Model Information
- **Model:** YOLOv8n
- **Weights:** COCO pretrained (yolov8n.pt)
- **Size:** 6.2MB
- **Classes:** 80 (none marine-related)
- **Framework:** Ultralytics (PyTorch)

### Environment
- **Platform:** Windows 11
- **Processor:** CPU-only (no CUDA)
- **Python:** 3.x
- **PyTorch:** 2.x
- **Execution:** Local machine (not Modal GPUs)

---

## Success Criteria Met

✅ **Research Completed:** Identified 6+ specialized underwater models and 5 datasets
✅ **Environment Set Up:** Installed dependencies, configured local testing
✅ **Baseline Established:** Documented 0% detection rate with standard model
✅ **Failure Analysis:** Comprehensive report on why COCO models don't work
✅ **Path Forward Defined:** Clear 6-phase roadmap to production model
✅ **Documentation:** 3 comprehensive markdown files for reference

---

## Lessons Learned

### 1. Domain Specificity Matters
Standard computer vision models trained on terrestrial datasets cannot be directly applied to underwater marine monitoring. The visual characteristics are fundamentally different.

### 2. Class Availability is Critical
Even high-performing models fail completely if they lack the relevant object classes. COCO's 80 classes, while comprehensive for everyday objects, have zero coverage of marine organisms.

### 3. Specialized Datasets Exist
The underwater CV community has created excellent datasets (FathomNet, Brackish, DeepFish) specifically for marine applications. These should be the starting point.

### 4. Transfer Learning is Essential
Rather than training from scratch, using pretrained weights from underwater datasets (FathomNet, YOLO-Fish) provides a strong starting point for fine-tuning.

### 5. Brackish Dataset is a Perfect Match
Among all datasets researched, Brackish most closely matches the Algapelago environment (coastal, fixed camera, includes target organisms).

### 6. CPU Inference is Viable
At 26-30ms per frame, CPU-only inference is fast enough for production use. GPU will speed this up but is not strictly necessary.

### 7. Baseline Testing is Valuable
Even when the expected result is "zero detections," running baseline tests provides:
- Proof that specialized models are needed
- Clear improvement metric (0% → XX%)
- Validation of research findings
- Documentation for stakeholders

---

## Questions Answered

**Q: Is this running locally or on Modal GPUs?**
**A:** Running locally on Windows CPU. No GPU acceleration currently, but CPU performance (26-30ms/frame) is acceptable. Modal GPU deployment planned for Phase 6 (batch processing of all 84 videos).

**Q: What pretrained models are available?**
**A:** 6+ specialized underwater models identified:
1. YOLO-Fish (DeepFish/OzFish trained)
2. FathomNet models (1.3M seafloor images)
3. Marine-Detect (Orange OpenSource)
4. Multiple YOLOv8 variants (Keypoint, Underwater-Animal-Detection, etc.)

**Q: Which dataset should we use for fine-tuning?**
**A:** Brackish dataset is the best match (coastal, fixed camera, includes crabs and fish, 25,613 annotations). Combine with 200-500 annotated Algapelago frames for custom training.

---

## Time Investment

### Today's Session Breakdown
- Research: 30 minutes
- Environment setup: 15 minutes
- Repository exploration: 10 minutes
- Script development: 20 minutes
- Baseline testing: 30 minutes
- Analysis & documentation: 25 minutes
- **Total:** ~2.5 hours

### Expected Timeline to Production
- **Phase 1** (Specialized model test): 1-2 days
- **Phase 2** (Dataset prep): 1 week
- **Phase 3** (Fine-tuning): 2-3 weeks
- **Phase 4** (Preprocessing): 1 week
- **Phase 5** (Architecture comparison): 1 week
- **Phase 6** (Batch processing): 1 week
- **Total:** 6-8 weeks to production-ready model

---

## Risks and Mitigation

### Risk 1: Specialized Models Perform Poorly
**Likelihood:** Low (research shows 70-80% mAP50)
**Impact:** High (would require training from scratch)
**Mitigation:** Test multiple models (FathomNet, Marine-Detect, YOLO-Fish) before committing to one

### Risk 2: Algapelago Footage Too Different
**Likelihood:** Medium (UK vs tropical datasets)
**Impact:** Medium (lower accuracy without fine-tuning)
**Mitigation:** Use Brackish dataset (similar coastal environment) + annotate Algapelago frames for fine-tuning

### Risk 3: Crab/Shellfish Detection Poor
**Likelihood:** Medium (smaller organisms, more occlusion)
**Impact:** Medium (incomplete organism counts)
**Mitigation:** Fine-tune on Brackish (includes crabs) + Marine-Detect (invertebrate specialist)

### Risk 4: Temporal Variation Affects Performance
**Likelihood:** Low (preprocessing should handle)
**Impact:** Low (model should generalize)
**Mitigation:** Train on samples from all time periods (10:00, 12:00, 14:00) + CLAHE preprocessing

---

## Next Session Preparation

### Before Next Session:
1. Review `UNDERWATER_CV_ML_RESOURCES.md` to choose model
2. Decide between FathomNet, Marine-Detect, or YOLO-Fish for Phase 1
3. (Optional) Set up Roboflow account for annotation
4. (Optional) Download Brackish dataset to review annotations

### First Task Next Session:
Download and test FathomNet model (recommended) or Marine-Detect on same 3 Algapelago videos to establish realistic baseline.

---

## Commit Message (Suggested)

```
Add underwater CV/ML baseline testing and research

Phase 1: Baseline Testing & Model Research
- Comprehensive research on underwater detection models
- Created UNDERWATER_CV_ML_RESOURCES.md with 6+ models, 5 datasets
- Developed test_yolov8_underwater.py for baseline testing
- Tested YOLOv8n (COCO) on 3 Algapelago videos (8,649 frames)
- Result: 0% detection (expected - validates need for specialized models)
- Documented findings in YOLOV8_BASELINE_TEST_REPORT.md

Key Findings:
- Standard COCO models unsuitable (no fish/marine classes)
- Brackish dataset perfect match for Lyme Bay environment
- FathomNet, Marine-Detect, YOLO-Fish identified for next phase
- CPU inference acceptable (26-30ms/frame, 33-38 FPS)

Next Steps:
- Phase 2: Test FathomNet or Marine-Detect models
- Expected improvement: 0% → 75-80% mAP50
- Fine-tuning on Brackish + Algapelago for 85-90% mAP50

Files:
+ UNDERWATER_CV_ML_RESOURCES.md (487 lines - model/dataset guide)
+ test_yolov8_underwater.py (166 lines - test framework)
+ YOLOV8_BASELINE_TEST_REPORT.md (500+ lines - baseline analysis)
+ CV_ML_PROGRESS_NOTES.md (this file - session summary)
+ YOLO-Fish/ (cloned repo, not used - Darknet complexity)
```

---

**Session Status:** ✅ Complete
**Documentation:** ✅ Comprehensive
**Next Phase:** Ready to begin specialized model testing
**Estimated Progress:** 10% of total pipeline (baseline established)
