# Solar AI Service

FastAPI-based microservice for AI-powered solar analytics.

## Features

- **Power Forecasting**: 7-day ahead power generation forecasting
- **Anomaly Detection**: Statistical outlier detection in power generation
- **Image Analysis**: Solar panel defect detection (shading, soiling, cracks)

## Endpoints

### POST /forecast_power
Forecast power generation for the next 7 days.

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

### POST /detect_anomalies
Detect anomalies in power generation.

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

### POST /analyze_image
Analyze solar panel images for defects.

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

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run the service
python main.py
```

Service will be available at http://localhost:8000

## Running with Docker

```bash
# Build the image
docker build -t solar-ai-service .

# Run the container
docker run -p 8000:8000 solar-ai-service
```

## Environment Variables

- `HF_TOKEN`: Hugging Face API token (optional, for advanced models)
- `LOG_LEVEL`: Logging level (default: INFO)

## Model Upgrades

The current implementation uses lightweight fallback models. To enable advanced ML models:

1. Uncomment dependencies in `requirements.txt`
2. Update model loading code in `main.py`
3. Add model files or download from Hugging Face

### Chronos-T5 (Time Series Forecasting)
```python
from transformers import pipeline
forecaster = pipeline("time-series-forecasting", model="amazon/chronos-t5-tiny")
```

### PyOD (Anomaly Detection)
```python
from pyod.models.iforest import IForest
from pyod.models.auto_encoder import AutoEncoder
```

### DETR (Object Detection)
```python
from transformers import DetrImageProcessor, DetrForObjectDetection
```
