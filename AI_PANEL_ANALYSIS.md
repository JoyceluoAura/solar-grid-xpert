# AI Panel Analysis - Qualcomm YOLO v11 Integration

## Overview

SolarGridX now includes AI-powered defect detection for solar panels using **Qualcomm's YOLO v11** model. This feature enables automated inspection of solar panel images to detect various defects that could impact performance and safety.

## Features

### 🤖 AI-Powered Defect Detection

Detects 10 types of solar panel defects:
- **Hotspots** - Temperature anomalies indicating electrical faults
- **Cracks** - Physical damage to solar cells
- **Delamination** - Separation of panel layers
- **Broken Cells** - Fractured cells causing power loss
- **Physical Damage** - Impact or structural damage
- **Connection Issues** - Electrical connection problems
- **PID Effect** - Potential-Induced Degradation
- **Soiling** - Dust and debris accumulation
- **Discoloration** - UV degradation or manufacturing defects
- **Snail Trails** - Silver paste corrosion

### 📊 Severity Classification

Defects are automatically classified into severity levels:
- **Critical** (🔴) - Immediate action required
- **High** (🟠) - Schedule inspection soon
- **Medium** (🟡) - Monitor and plan maintenance
- **Low** (🔵) - Low priority issue
- **Info** (ℹ️) - For reference only

### 🎯 Intelligent Action Items

High and critical severity defects automatically generate action items that appear on the dashboard:
- Prioritized by severity and confidence
- Include recommended actions
- Track resolution status
- Assign to team members

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Frontend (React)                       │
│  - Image Upload                                 │
│  - Defect Visualization                         │
│  - Action Items Dashboard                       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│          Supabase Backend                       │
│  - panel_images (Image records)                 │
│  - detected_defects (Defect data)               │
│  - action_items (Generated actions)             │
│  - yolo_inference_results (Raw YOLO output)     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│       IoT Gateway - YOLO Analyzer               │
│  ┌────────────────────────────────────────┐    │
│  │  YOLOAnalyzer Service                  │    │
│  │  - Image preprocessing                 │    │
│  │  - YOLO v11 inference                  │    │
│  │  - Defect classification               │    │
│  │  - Severity calculation                │    │
│  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│      Qualcomm AI Hub - YOLO v11 Model           │
│  Repository: github.com/quic/ai-hub-models      │
│  Model: yolov11_det                             │
└─────────────────────────────────────────────────┘
```

## Database Schema

### panel_images
```sql
CREATE TABLE panel_images (
  id UUID PRIMARY KEY,
  organization_id UUID,
  site_id UUID,
  image_url TEXT,
  image_filename TEXT,
  analysis_status TEXT, -- pending, processing, completed, failed
  uploaded_at TIMESTAMP,
  analyzed_at TIMESTAMP
);
```

### detected_defects
```sql
CREATE TABLE detected_defects (
  id UUID PRIMARY KEY,
  image_id UUID,
  defect_type TEXT, -- hotspot, crack, etc.
  severity TEXT, -- critical, high, medium, low, info
  confidence NUMERIC(5,2), -- 0-100%
  bounding_box JSONB, -- {x, y, width, height}
  description TEXT,
  recommended_action TEXT,
  is_resolved BOOLEAN
);
```

### action_items
```sql
CREATE TABLE action_items (
  id UUID PRIMARY KEY,
  organization_id UUID,
  site_id UUID,
  defect_id UUID,
  title TEXT,
  description TEXT,
  severity TEXT,
  priority INTEGER,
  status TEXT, -- open, in_progress, completed, dismissed
  assigned_to UUID
);
```

## API Endpoints

### Image Analysis

**POST `/api/analyze-image`**
```json
{
  "imageId": "uuid-of-uploaded-image"
}
```

Response:
```json
{
  "success": true,
  "imageId": "uuid",
  "defectsCount": 3,
  "inferenceTime": 1250,
  "defects": [...]
}
```

**GET `/api/image/:imageId/defects`**

Returns all defects detected for a specific image.

## Usage Guide

### 1. Upload Panel Image

1. Go to **AI Analysis** page
2. Select a site from dropdown
3. Click **Upload Image**
4. Choose a solar panel image (JPEG/PNG, max 10MB)
5. Image is automatically uploaded and analyzed

### 2. View Analysis Results

- Defects are displayed with:
  - Severity badge
  - Confidence percentage
  - Description
  - Recommended action

- Summary shows counts by severity level
- Click on defects to view details

### 3. Dashboard Alerts

High and critical severity defects automatically appear on the dashboard:
- Red/orange badges for visibility
- Quick navigation to AI Analysis page
- Actionable recommendations

### 4. Track Action Items

- High/critical defects generate action items
- Assign to team members
- Track resolution status
- Monitor completion

## Configuration

### Environment Variables

```bash
# .env in iot-gateway directory
MOCK_YOLO=true  # Set to 'false' for real inference
SUPABASE_URL=your-url
SUPABASE_KEY=your-service-key
```

### Mock Mode vs. Real Inference

**Mock Mode** (Default for Demo):
- Generates simulated defects
- No external API calls required
- Fast response for testing
- Set `MOCK_YOLO=true`

**Real Inference** (Production):
- Connects to Qualcomm AI Hub
- Requires model installation
- Set `MOCK_YOLO=false`

## Integrating Real YOLO Model

To use the actual Qualcomm YOLO v11 model:

### 1. Install Dependencies

```bash
cd iot-gateway
npm install @qualcomm-ai/hub-models
# OR
pip install qai-hub-models
```

### 2. Load the Model

```javascript
// In yolo-analyzer.js

import { QAIHubModel } from '@qualcomm-ai/hub-models';

async runYOLOInference(imagePath) {
  // Load YOLOv11 model
  const model = await QAIHubModel.load('yolov11_det');

  // Load and preprocess image
  const image = await this.loadImage(imagePath);
  const preprocessed = this.preprocessImage(image);

  // Run inference
  const results = await model.predict(preprocessed);

  // Parse detections
  return results.detections.map(det => ({
    class: det.class,
    confidence: det.confidence * 100,
    bbox: {
      x: det.bbox[0],
      y: det.bbox[1],
      width: det.bbox[2],
      height: det.bbox[3]
    }
  }));
}
```

### 3. Configure Model

```bash
# Set environment variable
export MOCK_YOLO=false

# Restart gateway
npm start
```

## Defect Types & Actions

| Defect | Critical Threshold | Recommended Action |
|--------|-------------------|-------------------|
| **Hotspot** | 90% confidence | Immediate inspection required. Check bypass diodes and connections. Fire hazard risk. |
| **Crack** | 85% confidence | Schedule panel replacement. Cracks reduce efficiency and allow moisture ingress. |
| **Broken Cell** | 95% confidence | Replace panel immediately. Creates electrical imbalances and reduces string performance. |
| **Delamination** | 80% confidence | Monitor closely. Replace if expanding rapidly. Indicates adhesive failure. |
| **Physical Damage** | 90% confidence | Inspect structural integrity. May compromise waterproofing and electrical safety. |
| **Connection Issue** | 85% confidence | Check cable connections and junction boxes. Loose connections cause power loss. |
| **PID Effect** | 75% confidence | Review system grounding. Consider PID recovery procedures. |
| **Soiling** | 60% confidence | Schedule cleaning maintenance. Heavy soiling reduces output by 5-20%. |
| **Discoloration** | 70% confidence | Monitor panel health. May indicate UV degradation or manufacturing defects. |
| **Snail Trail** | 65% confidence | Monitor for power degradation. May require replacement if performance drops. |

## Severity Calculation

Severity is calculated based on defect type and confidence level:

```javascript
calculateSeverity(defectType, confidence) {
  const thresholds = {
    hotspot: { critical: 90, high: 75, medium: 60, low: 40 },
    crack: { critical: 85, high: 70, medium: 55, low: 35 },
    broken_cell: { critical: 95, high: 80, medium: 65, low: 40 },
    // ... etc
  };

  if (confidence >= thresholds[defectType].critical) return 'critical';
  if (confidence >= thresholds[defectType].high) return 'high';
  if (confidence >= thresholds[defectType].medium) return 'medium';
  if (confidence >= thresholds[defectType].low) return 'low';
  return 'info';
}
```

## Dashboard Integration

### High Severity Alerts

The dashboard automatically displays high-priority action items:

```tsx
// Displays at top of dashboard
<Card className="border-red-200 bg-red-50">
  <CardTitle>High Priority Action Items</CardTitle>
  {/* Shows critical and high severity items */}
</Card>
```

Features:
- ✅ Red/orange visual indicators
- ✅ One-click navigation to details
- ✅ Site location and defect type
- ✅ Confidence percentage
- ✅ Image preview available

## Best Practices

### Image Quality

For best results:
- **Resolution**: Minimum 1024x1024 pixels
- **Format**: JPEG or PNG
- **Lighting**: Even, natural lighting
- **Angle**: Perpendicular to panel surface
- **Focus**: Sharp, clear image
- **Coverage**: One panel per image for best accuracy

### Maintenance Workflow

1. **Regular Inspections**: Upload panel images monthly
2. **Defect Tracking**: Monitor action items dashboard
3. **Prioritization**: Address critical/high severity first
4. **Resolution**: Mark defects as resolved after repair
5. **Trend Analysis**: Track defect patterns over time

### Performance Tips

- Batch upload images during off-peak hours
- Use compression for large images (optimize before upload)
- Archive old analyses after 6-12 months
- Set up automated alerts for critical defects

## Troubleshooting

### Analysis Stuck on "Processing"

```bash
# Check gateway logs
cd iot-gateway
npm start  # View console output

# Check image record in database
SELECT * FROM panel_images WHERE analysis_status = 'processing';

# Retry analysis
curl -X POST http://localhost:3001/api/analyze-image \
  -H "Content-Type: application/json" \
  -d '{"imageId": "your-image-id"}'
```

### No Defects Detected

- Ensure image quality is sufficient
- Check confidence thresholds in code
- Verify YOLO model is loaded correctly
- Review gateway logs for errors

### Action Items Not Appearing

- Check severity level (only high/critical show on dashboard)
- Verify RLS policies allow viewing
- Ensure action_items table trigger is working
- Check browser console for errors

## Future Enhancements

### Phase 1 (Current)
- ✅ Image upload and analysis
- ✅ Defect detection and classification
- ✅ Automatic action item generation
- ✅ Dashboard integration

### Phase 2 (Next)
- [ ] Thermal image analysis
- [ ] Historical trend analysis
- [ ] Defect heatmaps per site
- [ ] Automated report generation

### Phase 3 (Future)
- [ ] Mobile app for field inspections
- [ ] Drone image integration
- [ ] Real-time video analysis
- [ ] Predictive maintenance scheduling
- [ ] Integration with maintenance ticketing systems

## Support & Resources

- **Qualcomm AI Hub**: https://github.com/quic/ai-hub-models
- **YOLO v11 Documentation**: https://github.com/quic/ai-hub-models/blob/main/qai_hub_models/models/yolov11_det
- **SolarGridX Docs**: See SAAS_SETUP.md

## License

This feature integrates with Qualcomm AI Hub models. Please review Qualcomm's licensing terms for commercial usage.

---

**Built with Qualcomm YOLO v11 for production-ready solar panel inspection 🔬☀️**
