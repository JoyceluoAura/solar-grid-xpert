import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const generateHistoricalData = (days: number = 30) => {
  const series = [];
  const now = new Date();

  for (let i = days * 24; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour = ts.getHours();

    // Solar generation curve
    const solarFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const ghi = 1000 * solarFactor * (0.9 + Math.random() * 0.2);
    const ac_kw = 100 * solarFactor * (0.85 + Math.random() * 0.3);

    // Modeled output (ideal conditions)
    const modeled_kw = 100 * solarFactor * 0.95;

    // Performance ratio
    const pr = ghi > 100 ? (ac_kw / (ghi * 0.1)) : null;

    series.push({
      ts: ts.toISOString(),
      ghi: Math.round(Math.max(0, ghi)),
      ac_kw: Math.round(Math.max(0, ac_kw) * 100) / 100,
      modeled_kw: Math.round(modeled_kw * 100) / 100,
      pr: pr ? Math.round(Math.min(1, Math.max(0, pr)) * 100) / 100 : null
    });
  }

  return series;
};

const generateAnomalies = (series: any[]) => {
  const anomalies = [];

  // Find periods with significant underperformance
  for (let i = 24; i < series.length; i++) {
    const point = series[i];

    if (point.ac_kw > 10 && point.modeled_kw > 0) {
      const ratio = point.ac_kw / point.modeled_kw;

      if (ratio < 0.7) {
        // Underperformance detected
        const score = 1 - ratio;

        anomalies.push({
          start: series[Math.max(0, i - 2)].ts,
          end: series[Math.min(series.length - 1, i + 2)].ts,
          type: 'underperformance',
          score: Math.round(score * 1000) / 1000
        });
      }
    }
  }

  // Merge nearby anomalies
  const merged = [];
  let current = null;

  for (const anomaly of anomalies) {
    if (!current) {
      current = { ...anomaly };
    } else {
      const currentEnd = new Date(current.end);
      const anomalyStart = new Date(anomaly.start);

      // If within 6 hours, merge
      if (anomalyStart.getTime() - currentEnd.getTime() < 6 * 60 * 60 * 1000) {
        current.end = anomaly.end;
        current.score = Math.max(current.score, anomaly.score);
      } else {
        merged.push(current);
        current = { ...anomaly };
      }
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged.slice(0, 20); // Return top 20 anomalies
};

const calculateKPIs = (series: any[], anomalies: any[]) => {
  // MTBF (Mean Time Between Failures) - hours between anomalies
  const mtbf_hours = anomalies.length > 1
    ? ((series.length / anomalies.length) * 1) // Average hours between anomalies
    : 720; // 30 days if no anomalies

  // MTTR (Mean Time To Repair) - mock: 2-4 hours average
  const mttr_hours = 3.2;

  // Recovered kWh in last 30 days - estimate based on fixing anomalies
  const totalLoss = anomalies.reduce((sum, a) => {
    const start = new Date(a.start);
    const end = new Date(a.end);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return sum + (a.score * 50 * durationHours); // Assume 50 kW avg loss
  }, 0);

  const recovered_kwh_30d = Math.round(totalLoss * 0.6); // Assume 60% recovered

  return {
    mtbf_hours: Math.round(mtbf_hours * 10) / 10,
    mttr_hours: Math.round(mttr_hours * 10) / 10,
    recovered_kwh_30d
  };
};

router.get('/history', async (req: Request, res: Response) => {
  try {
    const siteId = req.query.site_id as string || 'default';
    const range = req.query.range as string || '30d';

    console.log(`[History] Fetching history for site: ${siteId}, range: ${range}`);

    // Parse range
    const daysMap: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    };

    const days = daysMap[range] || 30;

    // 1. Generate historical time series data
    const series = generateHistoricalData(days);

    // 2. Detect anomalies in the time series
    const anomalies = generateAnomalies(series);

    // 3. Calculate KPIs
    const kpis = calculateKPIs(series, anomalies);

    // 4. Return response
    res.json({
      series,
      anomalies,
      kpis
    });

  } catch (error: any) {
    console.error('[History] Error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch history',
      message: error.message
    });
  }
});

export default router;
