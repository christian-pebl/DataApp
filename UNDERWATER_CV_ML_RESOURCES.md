# Underwater CV/ML Resources for Algapelago Benthic Monitoring

## 📹 Your Video Characteristics

**Dataset:** Algapelago Seaweed Farm - Benthic Monitoring (Q3 2025)
- **Location:** Lyme Bay, UK
- **Videos:** 84 MP4 files spanning June 20 - July 4, 2025
- **Frequency:** 3 recordings per day (10:00, 12:00, 14:00)
- **Type:** Fixed benthic (seafloor) camera monitoring
- **Environment:** Shallow coastal waters, seaweed farm
- **Target Organisms:** Fish, crabs, shellfish, other benthic fauna
- **Challenges:**
  - Variable lighting (time of day)
  - Water turbidity
  - Algae/seaweed occlusion
  - Small organisms in complex background

---

## 🤖 Ready-to-Use Pretrained Models

### **1. YOLO-Fish (Recommended for Quick Start)**
**GitHub:** https://github.com/tamim662/YOLO-Fish

**Features:**
- Robust fish detection in realistic underwater environments
- Trained on DeepFish, OzFish datasets
- Pretrained weights available via Google Drive
- Real-time detection capability
- **Use Case:** Best for general fish counting and activity monitoring

**Advantages:**
- ✅ Well-documented
- ✅ Pretrained on diverse underwater footage
- ✅ Good for temporal activity analysis (your Experiment 4)

---

### **2. FathomNet Models (Best for Marine Biodiversity)**
**Hugging Face:** https://huggingface.co/FathomNet

**Features:**
- Baseline object detectors for broad use cases
- Trained on FathomNet database (11.4M seafloor images)
- Periodically retrained by MBARI team
- Covers 1000+ marine species
- **Use Case:** Best for multi-organism detection (fish, crabs, shellfish)

**Advantages:**
- ✅ Largest marine dataset (1.3M curated images)
- ✅ Scientific-grade annotations
- ✅ Covers benthic organisms specifically
- ✅ Perfect for your Experiment 2 (multi-organism detection)

**Dataset Access:** https://fathomnet.org/

---

### **3. Marine-Detect (Orange OpenSource)**
**GitHub:** https://github.com/Orange-OpenSource/marine-detect

**Features:**
- Two models:
  1. **Fish & Invertebrates Detector**
  2. **MegaFauna & Rare Species Detector**
- Python functions for video processing
- Ready-to-use prediction scripts
- **Use Case:** Best for invertebrate detection (crabs, shellfish)

**Advantages:**
- ✅ Specifically includes invertebrates (crabs, shellfish)
- ✅ Industrial-grade (maintained by Orange)
- ✅ Video processing out-of-the-box

---

### **4. YOLOv8 Underwater Variants (Best for Customization)**

#### **4a. Keypoint_YOLOv8_Fish_Detection**
**GitHub:** https://github.com/sahanasree23/Keypoint_YOLOv8_Fish_Detection

**Features:**
- YOLOv8 with keypoint detection
- Roboflow integration for custom datasets
- Fine-tuning scripts included
- **Use Case:** If you want to track fish movement patterns

#### **4b. Underwater-object-detection-using-yolov8**
**GitHub:** https://github.com/ShahidHasib586/Underwater-object-detection-using-yolov8

**Features:**
- Detects: fish, jellyfish, penguin, puffin, shark, starfish, stingray
- 7-class detector
- Saves best weights automatically
- **Use Case:** Multi-class baseline

#### **4c. Underwater-Animal-Detection (High Accuracy)**
**GitHub:** https://github.com/HarishValliappan/Underwater-Animal-Detection

**Features:**
- **97.12% accuracy** on 7 animal classes
- Latest YOLOv8 implementation
- **Use Case:** When you need maximum accuracy (your Experiment 5c)

---

### **5. DeepSee Model (Best for Deep/Low-Light Environments)**
**Research:** "Detecting and quantifying deep sea benthic life" (Frontiers 2024)

**Features:**
- YOLOv8 architecture optimized for challenging conditions
- Handles:
  - Variation in lighting ✅ (your 10:00 vs 14:00 videos)
  - Object occlusion ✅ (seaweed)
  - Different imaging equipment ✅
- **Use Case:** Best for low-visibility, turbid water

**Status:** Check FathomNet or BenthicNet for implementation

---

### **6. FishDetector (WHOI - Woods Hole)**
**GitHub:** https://github.com/WHOIGit/FishDetector

**Features:**
- Pretrained weights (162MB) available
- Maintained by Woods Hole Oceanographic Institution
- Scientific research-grade
- **Use Case:** Academic/research applications

---

## 📊 Datasets Available for Fine-Tuning

### **1. Brackish Dataset (Most Similar to Your Use Case)**
**Roboflow:** https://public.roboflow.com/object-detection/brackish-underwater

**Details:**
- **25,613 annotations** across 6 categories:
  - Big fish
  - Small fish
  - Crab ✅
  - Jellyfish
  - Shrimp
  - Starfish
- **14,674 images** from fixed underwater camera
- **Location:** Limfjords bridge, Denmark (coastal, similar to Lyme Bay)
- **Camera:** 9 meters below surface

**Why This is Perfect for You:**
- ✅ Fixed camera (like yours)
- ✅ Coastal shallow water (like Lyme Bay)
- ✅ Includes crabs and fish (your target organisms)
- ✅ Similar environmental conditions

**Recommendation:** Use for fine-tuning on your Algapelago videos

---

### **2. FathomNet**
**Website:** https://fathomnet.org/

**Details:**
- **11.4M seafloor images** (1.3M curated subset)
- 1000+ marine species
- Expert annotations from MBARI
- Global coverage (20+ habitats)

**Use Case:**
- Pretrain on FathomNet
- Fine-tune on Brackish dataset
- Final fine-tune on your Algapelago videos

---

### **3. DeepFish**
**Details:**
- **40,000 images** from 20 tropical Australian habitats
- Benchmark dataset for underwater CV
- Multiple annotation types (bounding boxes, segmentation, localization)

**Use Case:** Good baseline for fish detection, less similar to UK waters

---

### **4. BenthicNet**
**Details:**
- **11.4M seafloor images** compiled globally
- Designed for large-scale image recognition
- Diverse seafloor environments

**Use Case:** Transfer learning baseline for benthic organisms

---

### **5. SUIM (Semantic Underwater Image Segmentation)**
**Details:**
- **1,500 images** with pixel-level annotations
- 8 categories:
  - Fish (vertebrates)
  - Reefs (invertebrates)
  - Aquatic plants ✅ (seaweed)
  - Wrecks/ruins
  - Human divers
  - Robots
  - Sea-floor

**Use Case:** If you want to segment seaweed vs organisms

---

## 🎯 Recommended Approach for Your Project

### **Phase 1: Quick Validation (1-2 days)**

1. **Download YOLO-Fish weights**
   ```bash
   git clone https://github.com/tamim662/YOLO-Fish
   cd YOLO-Fish
   # Download weights from Google Drive link in repo
   ```

2. **Run on sample Algapelago videos**
   ```python
   from ultralytics import YOLO

   model = YOLO('yolofish_deepfish.pt')
   results = model.predict('algapelago_1_2025-06-20_14-00-48.mp4',
                          save=True,
                          conf=0.5)
   ```

3. **Evaluate results:**
   - Does it detect fish accurately?
   - Are crabs/shellfish missed?
   - How does it handle seaweed occlusion?

**Expected Outcome:** Baseline performance (~70-75% mAP50)

---

### **Phase 2: Multi-Organism Detection (1 week)**

1. **Download FathomNet pretrained weights**
   ```python
   from huggingface_hub import hf_hub_download

   model_path = hf_hub_download(
       repo_id="FathomNet/[model-name]",
       filename="model.pt"
   )
   ```

2. **Test on your videos**
   - Evaluate fish, crab, shellfish detection
   - Compare with YOLO-Fish results

3. **Use Marine-Detect for invertebrates**
   ```bash
   git clone https://github.com/Orange-OpenSource/marine-detect
   cd marine-detect
   python predict_video.py --video algapelago_1_2025-06-20_14-00-48.mp4
   ```

**Expected Outcome:** Improved crab/shellfish detection (~75-80% mAP50)

---

### **Phase 3: Fine-Tuning (2-3 weeks)**

1. **Annotate ~500 frames from Algapelago videos**
   - Use Roboflow for labeling: https://roboflow.com/
   - Focus on:
     - Fish (multiple sizes)
     - Crabs
     - Shellfish
     - Any other organisms seen

2. **Download Brackish dataset**
   ```python
   from roboflow import Roboflow

   rf = Roboflow(api_key="YOUR_API_KEY")
   project = rf.workspace().project("brackish-underwater")
   dataset = project.version(1).download("yolov8")
   ```

3. **Fine-tune YOLOv8**
   ```python
   from ultralytics import YOLO

   # Start with YOLO-Fish weights
   model = YOLO('yolofish_deepfish.pt')

   # Fine-tune on Brackish + Algapelago
   results = model.train(
       data='brackish_algapelago.yaml',
       epochs=100,
       imgsz=640,
       batch=16,
       patience=20
   )
   ```

**Expected Outcome:** Algapelago-specific model (~85-90% mAP50)

---

### **Phase 4: Preprocessing Pipeline (1 week)**

1. **Implement CLAHE for underwater visibility**
   ```python
   import cv2

   def preprocess_underwater(frame):
       # CLAHE for contrast enhancement
       lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
       l, a, b = cv2.split(lab)
       clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
       l = clahe.apply(l)
       enhanced = cv2.merge([l, a, b])
       enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

       # Denoising
       denoised = cv2.fastNlMeansDenoisingColored(enhanced, None, 10, 10, 7, 21)

       return denoised
   ```

2. **Test preprocessing impact**
   - Run detection with/without preprocessing
   - Measure mAP50 improvement

**Expected Outcome:** +10-15% mAP50 improvement (your Experiment 3 shows +12.6%)

---

### **Phase 5: Architecture Comparison (1 week)**

Test different YOLOv8 sizes on your videos:

```python
models = {
    'yolov8n': YOLO('yolov8n.pt'),  # Fastest
    'yolov8s': YOLO('yolov8s.pt'),  # Balanced
    'yolov8m': YOLO('yolov8m.pt'),  # Best accuracy
}

for name, model in models.items():
    results = model.predict(
        'algapelago_1_2025-06-27_12-00-48.mp4',
        save=True
    )
    # Measure inference time and accuracy
```

**Expected Outcome:**
- YOLOv8n: ~12ms, 80% mAP50
- YOLOv8s: ~19ms, 85% mAP50
- YOLOv8m: ~31ms, 88% mAP50

(Matches your Experiment 5 results)

---

## 🛠️ Implementation Priority

### **High Priority (Start Immediately):**

1. ✅ **YOLO-Fish** - Download and test on 3-5 sample videos
2. ✅ **Brackish Dataset** - Review annotations to see organism similarity
3. ✅ **FathomNet Models** - Test multi-organism detection

### **Medium Priority (Week 2-3):**

4. ✅ **Marine-Detect** - Test crab/shellfish specific detection
5. ✅ **Annotation Pipeline** - Set up Roboflow, label 200 frames
6. ✅ **CLAHE Preprocessing** - Implement and test

### **Low Priority (Month 2):**

7. ✅ **Fine-tuning** - Train custom Algapelago model
8. ✅ **Architecture Comparison** - Benchmark YOLOv8 variants
9. ✅ **Temporal Analysis** - Track activity patterns across time

---

## 📝 Specific Model Recommendations for Your Experiments

### **Experiment 1: Baseline**
- **Model:** YOLO-Fish (DeepFish weights)
- **Download:** https://github.com/tamim662/YOLO-Fish
- **Expected mAP50:** 70-75%

### **Experiment 2: Multi-Organism**
- **Model:** FathomNet baseline or Marine-Detect
- **Download:** https://huggingface.co/FathomNet or https://github.com/Orange-OpenSource/marine-detect
- **Expected mAP50:** 75-80%

### **Experiment 3: Preprocessing**
- **Model:** YOLO-Fish + CLAHE preprocessing
- **Expected mAP50 improvement:** +10-15%

### **Experiment 4: Temporal Analysis**
- **Model:** Fine-tuned YOLOv8n on Algapelago data
- **Purpose:** Count detections across 10:00, 12:00, 14:00 videos
- **Expected:** Morning/afternoon higher activity than midday

### **Experiment 5: Architecture Comparison**
- **Models:** YOLOv8n, YOLOv8s, YOLOv8m (Ultralytics)
- **Download:** Automatically via `ultralytics` pip package
- **Benchmark:** Inference time vs accuracy tradeoff

---

## 💡 Key Insights from Research

### **What Works Well for Benthic Monitoring:**

1. **YOLOv8 is the current state-of-the-art** for underwater detection (2024-2025)
2. **Preprocessing is critical** - CLAHE improves performance by 10-15%
3. **Transfer learning is essential** - Don't train from scratch
4. **Brackish dataset is your best match** - Similar environment to Lyme Bay

### **Common Challenges (and Solutions):**

| Challenge | Solution |
|-----------|----------|
| Variable lighting | CLAHE preprocessing + fine-tune on your time-of-day videos |
| Water turbidity | YOLOv8 with SPD-Conv or BiFormer attention modules |
| Small organisms | Add 160×160 detection layer (BSSFISH-YOLOv8) |
| Seaweed occlusion | Fine-tune on Algapelago-specific footage |
| Class imbalance | Use class-aware loss function (YOLOv8-TF approach) |

---

## 🚀 Quick Start Commands

```bash
# Install dependencies
pip install ultralytics roboflow opencv-python

# Download YOLO-Fish
git clone https://github.com/tamim662/YOLO-Fish
cd YOLO-Fish

# Download weights (follow repo instructions)

# Test on your video
python detect.py --source "G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\Alga\2025 Q3\Subcam_Alga_Farm_L_2506-2508-benthic\algapelago_1_2025-06-20_14-00-48.mp4" --weights yolofish_deepfish.pt --conf 0.5 --save-txt --save-conf

# Results will be saved in runs/detect/
```

---

## 📚 Additional Resources

### **Papers to Read:**
1. "YOLOv8-TF: Transformer-Enhanced YOLOv8 for Underwater Fish Species Recognition" (2025)
2. "Detecting and quantifying deep sea benthic life using advanced object detection" (Frontiers 2024)
3. "FathomNet: A global image database for enabling artificial intelligence in the ocean" (Nature 2022)

### **Datasets to Explore:**
- FathomNet: https://fathomnet.org/
- Brackish: https://public.roboflow.com/object-detection/brackish-underwater
- DeepFish: https://alzayats.github.io/DeepFish/
- BenthicNet: https://www.nature.com/articles/s41597-025-04491-1

### **Communities:**
- Ultralytics YOLOv8 Discussions: https://github.com/ultralytics/ultralytics/discussions
- FathomNet Community: https://fathomnet.org/community
- Roboflow Universe: https://universe.roboflow.com/

---

## ✅ Next Steps

1. **TODAY:** Download YOLO-Fish and test on 1 Algapelago video
2. **THIS WEEK:** Evaluate 3 different pretrained models (YOLO-Fish, FathomNet, Marine-Detect)
3. **WEEK 2:** Annotate 200 frames of Algapelago footage
4. **WEEK 3-4:** Fine-tune best-performing model on your data
5. **MONTH 2:** Full pipeline with preprocessing and architecture comparison

**Expected Timeline to Production Model:** 6-8 weeks
**Expected Final mAP50:** 85-90% on Algapelago-specific footage
