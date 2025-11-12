# AI Analysis Service

ML-powered solar panel performance prediction and anomaly detection service.

## Features

- **Performance Prediction**: Predicts expected solar output based on environmental and system parameters
- **Anomaly Detection**: Identifies performance deviations and calculates fault probability
- **Smart Recommendations**: Generates prioritized action items based on AI analysis
- **Weather Impact Analysis**: Scores weather impact on system performance
- **Battery Health Monitoring**: Tracks battery health and optimal charging conditions
- **Feature Importance**: Identifies top factors affecting performance

## Technology Stack

- **Python 3.9+**
- **Flask**: Web framework
- **scikit-learn**: Machine learning (Random Forest Regressor)
- **NumPy & Pandas**: Data processing

## Installation

```bash
cd ai-analysis-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
```

## Running the Service

```bash
# Development mode
python app.py

# Production mode
export DEBUG=False
gunicorn -w 4 -b 0.0.0.0:5001 app:app
```

The service will run on `http://localhost:5001`

## API Endpoints

### Health Check
```bash
GET /health
```

### Analyze Performance
```bash
POST /api/ai_analysis
Content-Type: application/json

{
  "site_id": "SGX-ID-123",
  "inputs": {
    "irradiance": 915,
    "ambient_temp": 32,
    "panel_temp": 48,
    "battery_soc": 72,
    "inverter_eff": 96.4,
    "soiling_index": 3.1,
    "tilt": 30,
    "azimuth": 180,
    "wind_speed": 2.3,
    "pr_baseline": 0.80,
    "system_capacity": 100,
    "actual_output": 62.4
  }
}
```

**Response:**
```json
{
  "site_id": "SGX-ID-123",
  "predicted_output": 68.2,
  "actual_output": 62.4,
  "deviation": -8.5,
  "fault_prob": 0.12,
  "top_factors": ["irradiance", "panel_temp", "inverter_eff"],
  "weather_impact_score": 85.3,
  "battery_health_score": 92.0,
  "performance_metrics": {
    "temp_correction": 0.908,
    "soiling_factor": 0.969,
    "inverter_factor": 0.964,
    "irradiance_factor": 0.915
  },
  "recommendations": [
    {
      "priority": "High",
      "msg": "Panel temperature elevated (48°C vs ambient 32°C)",
      "action": "Check for adequate airflow, clean panels if soiled"
    }
  ]
}
```

### Batch Analysis
```bash
POST /api/batch_analysis
Content-Type: application/json

{
  "sites": [
    {
      "site_id": "SGX-ID-123",
      "inputs": { ... }
    },
    {
      "site_id": "SGX-ID-456",
      "inputs": { ... }
    }
  ]
}
```

### Model Information
```bash
GET /api/model_info
```

## ML Model Details

### Input Features

| Feature | Unit | Description |
|---------|------|-------------|
| irradiance | W/m² | Solar irradiance |
| ambient_temp | °C | Ambient temperature |
| panel_temp | °C | Panel surface temperature |
| battery_soc | % | Battery State of Charge |
| inverter_eff | % | Inverter efficiency |
| soiling_index | % | Soiling loss percentage |
| tilt | degrees | Panel tilt angle |
| azimuth | degrees | Panel azimuth |
| wind_speed | m/s | Wind speed |
| pr_baseline | - | Performance Ratio baseline |
| system_capacity | kWp | System capacity |

### Feature Importance

1. **Irradiance** (35%): Primary driver of solar output
2. **Panel Temperature** (22%): Affects conversion efficiency
3. **Inverter Efficiency** (15%): Conversion losses
4. **Soiling** (12%): Dirt/dust accumulation losses
5. **Battery SoC** (8%): Storage availability

### Thresholds

```python
{
    'panel_temp_high': 65°C,
    'panel_temp_critical': 75°C,
    'soiling_critical': 8.0%,
    'inverter_eff_low': 94.0%,
    'battery_soc_low': 20%,
    'deviation_warning': 10%,
    'deviation_critical': 20%
}
```

## Performance Calculation

```python
predicted_output = (
    system_capacity *
    (irradiance / 1000) *
    pr_baseline *
    temperature_correction *
    (1 - soiling_loss) *
    (inverter_eff / 100)
)
```

## Docker Deployment

```bash
# Build image
docker build -t solar-ai-service .

# Run container
docker run -p 5001:5001 solar-ai-service
```

## Integration with Frontend

The frontend can call this service at `/api/ai_analysis`:

```typescript
const response = await fetch('http://localhost:5001/api/ai_analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    site_id: siteId,
    inputs: {
      irradiance: 915,
      // ... other parameters
    }
  })
});
const analysis = await response.json();
```

## Future Enhancements

- [ ] LSTM model for time-series forecasting
- [ ] SHAP values for model explainability
- [ ] Historical trend analysis
- [ ] Automated report generation (PDF)
- [ ] WebSocket support for real-time streaming
- [ ] Integration with Qualcomm AI Hub for edge deployment

## License

MIT
