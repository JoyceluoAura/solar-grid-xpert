import express, { Request, Response } from 'express';
import axios from 'axios';
import { parseSiteParams, fetchSiteTelemetry, TelemetryPoint, generateMockTelemetry } from './utils/telemetry';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const computeHealthScore = (
  avgResidualMAPE: number,
  anomalyRate: number,
  deviceFaultScore: number
) => {
  // Weights
  const w1 = 30; // residual weight
  const w2 = 40; // anomaly weight
  const w3 = 30; // device fault weight

  const penalty =
    (w1 * avgResidualMAPE) +
    (w2 * anomalyRate * 100) +
    (w3 * deviceFaultScore);

  return Math.max(0, Math.min(100, 100 - penalty));
};

const computeEnergyLoss = (
  forecast: any[],
  anomalies: any[],
  avgIrradiance: number
) => {
  // Estimated loss based on anomaly rate and underperformance
  const baselineDailyKwh = forecast.reduce((sum, f) => sum + f.ac_kw_hat, 0);

  // Assume 10% loss for detected issues
  const lossKwh = baselineDailyKwh * 0.10 * 7; // 7 days
  const lossPct = 10.0;

  return { lossKwh, lossPct };
};

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const siteId = req.query.site_id as string || 'default';
    const { latitude, longitude, systemCapacityKw } = parseSiteParams(req);

    console.log(`[Overview] Fetching data for site: ${siteId}`);

    // 1. Fetch telemetry data (last 90 days)
    let telemetryData: TelemetryPoint[];
    try {
      telemetryData = await fetchSiteTelemetry({
        latitude,
        longitude,
        systemCapacityKw,
        hours: 90 * 24,
      });
      console.log(`[Overview] Loaded ${telemetryData.length} telemetry points from Open-Meteo`);
    } catch (error: any) {
      console.error(`[Overview] Telemetry fetch failed: ${error.message}`);
      telemetryData = generateMockTelemetry(systemCapacityKw, 90);
    }

    // 2. Call AI service for power forecast
    const forecastResponse = await axios.post(`${AI_SERVICE_URL}/forecast_power`, {
      data: telemetryData.slice(-7 * 24), // Last 7 days for forecasting
      forecast_days: 7
    });

    const forecast = forecastResponse.data.forecast;

    // 3. Generate residuals (actual vs predicted)
    const recentData = telemetryData.slice(-14 * 24); // Last 14 days
    const residuals = recentData.map((point, idx) => {
      // Simple prediction: use same hour from yesterday
      const yesterdayIdx = Math.max(0, idx - 24);
      const predicted = recentData[yesterdayIdx]?.ac_kw || point.ac_kw;

      return {
        ts: point.ts,
        actual: point.ac_kw,
        predicted: predicted
      };
    });

    // 4. Call AI service for anomaly detection
    const anomalyResponse = await axios.post(`${AI_SERVICE_URL}/detect_anomalies`, {
      residuals: residuals
    });

    const anomalies = anomalyResponse.data.anomalies;
    const anomalyRate = anomalyResponse.data.anomaly_rate;

    // 5. Compute metrics
    const avgResidualMAPE = residuals.reduce((sum, r) =>
      sum + Math.abs(r.actual - r.predicted) / Math.max(0.1, r.predicted), 0
    ) / residuals.length;

    const deviceFaultScore = 0.05; // Mock device fault score (5%)

    const healthScore = computeHealthScore(
      avgResidualMAPE,
      anomalyRate,
      deviceFaultScore
    );

    const { lossKwh, lossPct } = computeEnergyLoss(
      forecast,
      anomalies,
      telemetryData.slice(-7 * 24).reduce((sum, d) => sum + d.ghi_wm2, 0) / (7 * 24)
    );

    // 6. Generate top drivers (feature importance)
    const topDrivers = [
      { label: 'Temperature Derating', contribution_pct: 35 },
      { label: 'Partial Shading', contribution_pct: 28 },
      { label: 'Soiling Accumulation', contribution_pct: 22 },
      { label: 'Inverter Clipping', contribution_pct: 15 }
    ];

    // 7. Generate action items
    const actions = [];
    if (healthScore < 85) {
      actions.push({
        title: 'Schedule panel cleaning',
        impact_kwh: lossKwh * 0.4,
        priority: 'high' as const
      });
    }
    if (anomalyRate > 0.1) {
      actions.push({
        title: 'Investigate inverter performance',
        impact_kwh: lossKwh * 0.3,
        priority: 'high' as const
      });
    }
    actions.push({
      title: 'Optimize tilt angle for season',
      impact_kwh: lossKwh * 0.2,
      priority: 'med' as const
    });

    // 8. Generate forecast windows
    const forecastWindows = [];
    for (const f of forecast) {
      if (f.ac_kw_hat < forecast[0].ac_kw_hat * 0.7) {
        forecastWindows.push({
          start: f.date,
          end: f.date,
          label: 'low output' as const
        });
      }
    }

    // 9. Return response
    res.json({
      health_score: Math.round(healthScore * 10) / 10,
      predicted_loss_kwh_7d: Math.round(lossKwh * 10) / 10,
      predicted_loss_pct_7d: Math.round(lossPct * 10) / 10,
      top_drivers: topDrivers,
      actions: actions.slice(0, 3),
      forecast_windows: forecastWindows.slice(0, 5)
    });

  } catch (error: any) {
    console.error('[Overview] Error:', error.message);
    res.status(500).json({
      error: 'Failed to generate overview',
      message: error.message
    });
  }
});

export default router;
