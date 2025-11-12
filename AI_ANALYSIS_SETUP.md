# AI Analysis Module - Setup Guide

Complete AI-powered solar analytics with forecasting, anomaly detection, and image analysis.

## Architecture Overview

```
┌─────────────────┐
│   React/Vite    │
│   Frontend      │
└────────┬────────┘
         │
         │ HTTP REST
         │
┌────────▼────────┐
│  Node.js/Express│
│  Backend API    │  ← Computes health scores, insights, history
└────────┬────────┘
         │
         │ HTTP REST
         │
┌────────▼────────┐
│ Python FastAPI  │
│  AI Service     │  ← ML models (forecasting, anomaly detection, image analysis)
└─────────────────┘
```

## Features

### 1. Overview Tab
- **Site Health Score**: 0-100 rating based on performance, anomalies, and faults
- **Predicted Energy Loss**: 7-day forecast with kWh and % loss
- **Top Drivers**: Bar chart showing key performance factors
- **Action Queue**: Prioritized recommendations with estimated impact
- **Forecast Windows**: Risk periods visualization

### 2. AI Insights Tab
- **Insight Cards**: Actionable issues with evidence, impact, and confidence
- **Filtering**: By tags (Shading, Soiling, Derating, Inverter, Battery)
- **Sorting**: By impact (kWh), confidence, or date
- **Evidence**: Video/image evidence for visual issues
- **Tags**: Categorization for quick filtering

### 3. History Trends Tab
- **KPI Tiles**: MTBF, MTTR, Recovered Energy
- **Chart 1**: GHI vs AC Output vs Modeled (multi-axis line chart)
- **Chart 2**: Performance Ratio (PR) trend with area chart
- **Chart 3**: Anomaly timeline with severity badges
- **Range Selector**: 7d, 30d, 90d views

## Installation

### 1. Python AI Service

```bash
cd ai

# Install dependencies
pip install -r requirements.txt

# Run the service
python main.py
```

Service will be available at `http://localhost:8000`

#### Using Docker

```bash
cd ai
docker build -t solar-ai-service .
docker run -p 8000:8000 solar-ai-service
```

### 2. Node.js Backend API

```bash
cd backend

# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

Service will be available at `http://localhost:3001`

### 3. Frontend Configuration

Add to your `.env` file:

```bash
VITE_BACKEND_URL=http://localhost:3001
```

## API Endpoints

### Python AI Service

#### POST `/forecast_power`
Forecast 7-day power generation

**Request:**
```json
{
  "data": [
    {
      "ts": "2025-01-12T00:00:00Z",
      "ghi_wm2": 800,
      "air_temp_c": 28.5,
      "wind_ms": 2.3,
      "ac_kw": 85.2
    }
  ],
  "forecast_days": 7
}
```

**Response:**
```json
{
  "forecast": [
    {
      "date": "2025-01-13",
      "ac_kw_hat": 92.5,
      "lower_bound": 78.6,
      "upper_bound": 106.4
    }
  ],
  "confidence": 0.78,
  "model_used": "seasonal_pattern"
}
```

#### POST `/detect_anomalies`
Detect anomalies in residuals

**Request:**
```json
{
  "residuals": [
    {
      "ts": "2025-01-12T12:00:00Z",
      "actual": 85.2,
      "predicted": 90.0
    }
  ]
}
```

**Response:**
```json
{
  "anomalies": [
    {
      "start": "2025-01-12T12:00:00Z",
      "end": "2025-01-12T12:00:00Z",
      "score": 0.85,
      "type": "statistical_outlier",
      "magnitude": 15.2
    }
  ],
  "anomaly_rate": 0.12,
  "method": "iqr_statistical"
}
```

#### POST `/analyze_image`
Analyze panel images for defects

**Request:**
```json
{
  "image_url": "https://example.com/panel.jpg"
}
```

**Response:**
```json
{
  "type": "shading",
  "confidence": 0.82,
  "occlusion_ratio": 0.25,
  "detected_objects": [
    {
      "class": "shadow",
      "confidence": 0.82,
      "area_ratio": 0.25
    }
  ],
  "mask_url": null
}
```

### Node.js Backend API

#### GET `/api/ai/overview?site_id={id}`
Get comprehensive overview data

**Response:**
```json
{
  "health_score": 87.5,
  "predicted_loss_kwh_7d": 125.4,
  "predicted_loss_pct_7d": 8.2,
  "top_drivers": [
    {
      "label": "Temperature Derating",
      "contribution_pct": 35
    }
  ],
  "actions": [
    {
      "title": "Schedule panel cleaning",
      "impact_kwh": 50.2,
      "priority": "high"
    }
  ],
  "forecast_windows": []
}
```

#### GET `/api/ai/insights?site_id={id}`
Get actionable AI insights

**Response:**
```json
{
  "insights": [
    {
      "id": "1",
      "ts": "2025-01-12T10:00:00Z",
      "kind": "soiling",
      "confidence": 0.85,
      "impact_kwh": 45.2,
      "summary": "Heavy dust accumulation detected",
      "evidence_url": "https://example.com/video.mp4",
      "tags": ["Soiling", "Visual", "Inspection"]
    }
  ]
}
```

#### GET `/api/ai/history?site_id={id}&range={7d|30d|90d}`
Get historical trends

**Response:**
```json
{
  "series": [
    {
      "ts": "2025-01-12T00:00:00Z",
      "ghi": 800,
      "ac_kw": 85.2,
      "modeled_kw": 90.0,
      "pr": 0.92
    }
  ],
  "anomalies": [
    {
      "start": "2025-01-12T12:00:00Z",
      "end": "2025-01-12T14:00:00Z",
      "type": "underperformance",
      "score": 0.85
    }
  ],
  "kpis": {
    "mtbf_hours": 150.5,
    "mttr_hours": 3.2,
    "recovered_kwh_30d": 245
  }
}
```

## Health Score Calculation

```
Health Score = 100 - (w1 * avg_residual_MAPE + w2 * anomaly_rate * 100 + w3 * device_fault_score)

where:
  w1 = 30  (residual weight)
  w2 = 40  (anomaly weight)
  w3 = 30  (device fault weight)
```

**Example:**
- avg_residual_MAPE = 0.12 (12%)
- anomaly_rate = 0.08 (8%)
- device_fault_score = 0.05 (5%)

Health Score = 100 - (30 * 0.12 + 40 * 0.08 + 30 * 0.05) = 100 - (3.6 + 3.2 + 1.5) = 91.7

## Upgrading to Advanced Models

The current implementation uses lightweight statistical methods and seasonal patterns. To enable advanced ML models:

### 1. Chronos-T5 (Time Series Forecasting)

Uncomment in `ai/requirements.txt`:
```
torch==2.1.2
transformers==4.36.2
```

Update `ai/main.py`:
```python
from transformers import pipeline

forecaster = pipeline("time-series-forecasting", model="amazon/chronos-t5-tiny")

def forecast_with_chronos(data, forecast_days):
    # Convert data to tensor format
    values = torch.tensor([p.ac_kw for p in data])

    # Generate forecast
    predictions = forecaster(values, prediction_length=forecast_days * 24)

    return predictions
```

### 2. PyOD (Anomaly Detection)

Uncomment in `ai/requirements.txt`:
```
pyod==1.1.3
```

Update `ai/main.py`:
```python
from pyod.models.iforest import IForest
from pyod.models.auto_encoder import AutoEncoder

def detect_with_pyod(residuals):
    X = np.array([[r.actual - r.predicted] for r in residuals])

    # IsolationForest
    clf = IForest(contamination=0.1)
    clf.fit(X)

    # Get anomaly scores
    scores = clf.decision_function(X)
    labels = clf.predict(X)  # 0 = normal, 1 = anomaly

    return labels, scores
```

### 3. DETR (Object Detection)

Uncomment in `ai/requirements.txt`:
```
torch==2.1.2
transformers==4.36.2
Pillow==10.2.0
```

Update `ai/main.py`:
```python
from transformers import DetrImageProcessor, DetrForObjectDetection
from PIL import Image
import requests

processor = DetrImageProcessor.from_pretrained("facebook/detr-resnet-50")
model = DetrForObjectDetection.from_pretrained("facebook/detr-resnet-50")

def analyze_with_detr(image_url):
    image = Image.open(requests.get(image_url, stream=True).raw)

    inputs = processor(images=image, return_tensors="pt")
    outputs = model(**inputs)

    # Post-process outputs
    target_sizes = torch.tensor([image.size[::-1]])
    results = processor.post_process_object_detection(outputs, target_sizes=target_sizes)[0]

    detected_objects = []
    for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
        if score > 0.7:
            detected_objects.append({
                "class": model.config.id2label[label.item()],
                "confidence": score.item(),
                "box": box.tolist()
            })

    return detected_objects
```

## Testing

### 1. Test Python AI Service

```bash
# Health check
curl http://localhost:8000/health

# Test forecast endpoint
curl -X POST http://localhost:8000/forecast_power \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{"ts": "2025-01-12T00:00:00Z", "ghi_wm2": 800, "air_temp_c": 28, "wind_ms": 2, "ac_kw": 85}],
    "forecast_days": 7
  }'
```

### 2. Test Node.js Backend

```bash
# Health check
curl http://localhost:3001/health

# Test overview endpoint
curl http://localhost:3001/api/ai/overview?site_id=default

# Test insights endpoint
curl http://localhost:3001/api/ai/insights?site_id=default

# Test history endpoint
curl http://localhost:3001/api/ai/history?site_id=default&range=30d
```

### 3. Test Frontend

1. Start all services (Python AI, Node.js Backend, React Frontend)
2. Navigate to `/ai-analysis` in the browser
3. Check that all three tabs load without errors
4. Verify mock fallback data is displayed
5. Check browser console for any errors

## Troubleshooting

### Issue: CORS errors in browser

**Solution**: Ensure CORS is properly configured in both Python and Node.js services.

Python (`ai/main.py`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Node.js (`backend/src/server.ts`):
```typescript
app.use(cors());
```

### Issue: Connection refused to AI service

**Solution**: Check that Python service is running on port 8000.

```bash
# Check if port 8000 is in use
lsof -i :8000

# If not running, start it
cd ai && python main.py
```

### Issue: Module import errors in Python

**Solution**: Install all dependencies:

```bash
cd ai
pip install -r requirements.txt
```

### Issue: TypeScript compilation errors

**Solution**: Install TypeScript dependencies:

```bash
cd backend
npm install
```

## Production Deployment

### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  ai-service:
    build: ./ai
    ports:
      - "8000:8000"
    environment:
      - LOG_LEVEL=INFO
    restart: unless-stopped

  backend-api:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - AI_SERVICE_URL=http://ai-service:8000
      - PORT=3001
    depends_on:
      - ai-service
    restart: unless-stopped

  frontend:
    build: .
    ports:
      - "5173:5173"
    environment:
      - VITE_BACKEND_URL=http://localhost:3001
    depends_on:
      - backend-api
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## Performance Optimization

1. **Caching**: Implement Redis caching for forecast and anomaly results
2. **Batch Processing**: Process multiple sites in parallel
3. **Model Quantization**: Use quantized models for faster inference
4. **CDN**: Serve video evidence through a CDN
5. **Database Indexing**: Add indexes on timestamp and site_id columns

## Next Steps

1. Connect to real Supabase tables for telemetry data
2. Integrate with real camera feeds for image analysis
3. Implement WebSocket for real-time updates
4. Add user authentication and authorization
5. Set up monitoring and alerting (Prometheus, Grafana)
6. Implement model retraining pipeline
7. Add A/B testing for different model configurations

## Support

For issues or questions:
- Check the README files in `ai/` and `backend/` directories
- Review API endpoint documentation above
- Check browser console and server logs for errors
