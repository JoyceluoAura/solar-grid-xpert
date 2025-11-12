# Solar Grid Xpert - Backend API

Express/TypeScript backend service that acts as middleware between the React frontend and Python AI service.

## Features

- **Overview API**: Computes site health scores, predicted energy loss, top drivers
- **Insights API**: Generates actionable AI insights from telemetry and image analysis
- **History API**: Provides time series data for trends and KPI calculations

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Server will run on `http://localhost:3001`

## Build

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env` file:

```bash
PORT=3001
AI_SERVICE_URL=http://localhost:8000
```

## API Endpoints

### GET `/health`
Health check endpoint

### GET `/api/ai/overview?site_id={id}`
Get comprehensive overview data including:
- Health score (0-100)
- Predicted 7-day energy loss
- Top performance drivers
- Prioritized action items
- Forecast risk windows

### GET `/api/ai/insights?site_id={id}`
Get AI-generated insight cards:
- Performance issues
- Equipment problems
- Visual defects from images
- Anomaly alerts

### GET `/api/ai/history?site_id={id}&range={7d|30d|90d}`
Get historical trend data:
- Time series (GHI, AC, Modeled, PR)
- Anomaly timeline
- KPIs (MTBF, MTTR, Recovered kWh)

## Project Structure

```
backend/
├── src/
│   ├── server.ts          # Main Express application
│   └── routes/
│       ├── overview.ts    # Overview endpoint logic
│       ├── insights.ts    # Insights endpoint logic
│       └── history.ts     # History endpoint logic
├── package.json
├── tsconfig.json
└── README.md
```

## Integration with AI Service

The backend calls the Python AI service for:
1. Power forecasting (`POST /forecast_power`)
2. Anomaly detection (`POST /detect_anomalies`)
3. Image analysis (`POST /analyze_image`)

Make sure the Python AI service is running before starting this backend.

## Testing

```bash
# Health check
curl http://localhost:3001/health

# Get overview data
curl "http://localhost:3001/api/ai/overview?site_id=default"

# Get insights
curl "http://localhost:3001/api/ai/insights?site_id=default"

# Get history
curl "http://localhost:3001/api/ai/history?site_id=default&range=30d"
```

## Docker

Build and run:

```bash
docker build -t solar-backend-api .
docker run -p 3001:3001 \
  -e AI_SERVICE_URL=http://ai-service:8000 \
  solar-backend-api
```
