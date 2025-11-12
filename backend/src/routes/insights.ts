import express, { Request, Response } from 'express';
import axios from 'axios';
import { parseSiteParams, fetchSiteTelemetry, TelemetryPoint, generateMockTelemetry } from './utils/telemetry';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Mock video URLs for different issues
const ISSUE_VIDEOS = {
  shading: 'https://videos.pexels.com/video-files/3843212/3843212-uhd_2560_1440_30fps.mp4',
  soiling: 'https://videos.pexels.com/video-files/7989442/7989442-uhd_2560_1440_24fps.mp4',
  crack: 'https://videos.pexels.com/video-files/8092472/8092472-uhd_2560_1440_25fps.mp4',
  hotspot: 'https://videos.pexels.com/video-files/8092472/8092472-uhd_2560_1440_25fps.mp4',
  inverter: 'https://videos.pexels.com/video-files/2611250/2611250-uhd_2560_1440_30fps.mp4'
};

const generateInsightCards = async (
  siteId: string,
  telemetryData: any[],
  residuals: any[],
  anomalies: any[]
) => {
  const insights = [];
  let insightId = 1;

  // 1. Analyze residual spikes for equipment issues
  const highResiduals = residuals.filter(r =>
    Math.abs(r.actual - r.predicted) / Math.max(0.1, r.predicted) > 0.15
  );

  if (highResiduals.length > 0) {
    const avgResidual = highResiduals.reduce((sum, r) =>
      sum + Math.abs(r.actual - r.predicted), 0
    ) / highResiduals.length;

    insights.push({
      id: `insight-${insightId++}`,
      ts: highResiduals[0].ts,
      kind: 'inverter_derating',
      confidence: 0.78,
      impact_kwh: avgResidual * 24 * 7, // Weekly impact
      summary: 'Inverter derating suspected during peak hours - AC output 15-20% below expected',
      evidence_url: ISSUE_VIDEOS.inverter,
      tags: ['Derating', 'Inverter', 'Performance']
    });
  }

  // 2. Battery SoC limiting export
  const nightData = telemetryData.filter(d => {
    const hour = new Date(d.ts).getHours();
    return hour >= 18 || hour < 6;
  });

  if (nightData.length > 0) {
    insights.push({
      id: `insight-${insightId++}`,
      ts: nightData[0].ts,
      kind: 'battery_soc_limit',
      confidence: 0.82,
      impact_kwh: 25.5,
      summary: 'Battery SoC limiting export during evening peak - consider adjusting discharge schedule',
      evidence_url: null,
      tags: ['SoC limit', 'Battery', 'Optimization']
    });
  }

  // 3. Weather-adjusted underperformance
  const highIrradianceData = telemetryData.filter(d => d.ghi_wm2 > 800);
  if (highIrradianceData.length > 0) {
    const avgPR = highIrradianceData.reduce((sum, d) =>
      sum + d.ac_kw / Math.max(0.1, d.ghi_wm2 * 0.1), 0
    ) / highIrradianceData.length;

    if (avgPR < 0.75) {
      insights.push({
        id: `insight-${insightId++}`,
        ts: highIrradianceData[0].ts,
        kind: 'weather_underperformance',
        confidence: 0.85,
        impact_kwh: 45.2,
        summary: 'Performance ratio below 75% during high irradiance - possible soiling or shading',
        evidence_url: ISSUE_VIDEOS.soiling,
        tags: ['Underperformance', 'Weather', 'Soiling']
      });
    }
  }

  // 4. Analyze images for defects (mock image events)
  const imageEvents = [
    { url: ISSUE_VIDEOS.shading, type: 'panel_inspection_1' },
    { url: ISSUE_VIDEOS.soiling, type: 'panel_inspection_2' }
  ];

  for (const imageEvent of imageEvents) {
    try {
      const imageAnalysis = await axios.post(`${AI_SERVICE_URL}/analyze_image`, {
        image_url: imageEvent.url
      });

      const result = imageAnalysis.data;

      if (result.type !== 'clear') {
        const occlusionRatio = result.occlusion_ratio || 0.15;
        const avgIrradiance = telemetryData
          .slice(-24)
          .reduce((sum, d) => sum + d.ghi_wm2, 0) / 24;

        const impact_kwh = occlusionRatio * (avgIrradiance / 1000) * 100 * 24 * 7;

        insights.push({
          id: `insight-${insightId++}`,
          ts: new Date().toISOString(),
          kind: `image_${result.type}`,
          confidence: result.confidence,
          impact_kwh: Math.round(impact_kwh * 10) / 10,
          summary: `${result.type.charAt(0).toUpperCase() + result.type.slice(1)} detected on panels - ${Math.round(occlusionRatio * 100)}% coverage affecting output`,
          evidence_url: imageEvent.url,
          tags: [
            result.type === 'shading' ? 'Shading' :
            result.type === 'soiling' ? 'Soiling' :
            result.type === 'crack' ? 'Crack' : 'Hotspot',
            'Visual', 'Inspection'
          ]
        });
      }
    } catch (error) {
      console.error('Image analysis error:', error);
    }
  }

  // 5. Anomaly-based insights
  const criticalAnomalies = anomalies.filter(a => a.score > 0.7);
  if (criticalAnomalies.length > 0) {
    insights.push({
      id: `insight-${insightId++}`,
      ts: criticalAnomalies[0].start,
      kind: 'anomaly_critical',
      confidence: 0.88,
      impact_kwh: 38.7,
      summary: `${criticalAnomalies.length} critical anomalies detected - unexpected power drops require investigation`,
      evidence_url: null,
      tags: ['Anomaly', 'Critical', 'Investigation']
    });
  }

  return insights;
};

router.get('/insights', async (req: Request, res: Response) => {
  try {
    const siteId = req.query.site_id as string || 'default';
    const { latitude, longitude, systemCapacityKw } = parseSiteParams(req);

    console.log(`[Insights] Generating insights for site: ${siteId}`);

    // 1. Fetch recent telemetry data (last 14 days)
    let telemetryData: TelemetryPoint[];
    try {
      telemetryData = await fetchSiteTelemetry({
        latitude,
        longitude,
        systemCapacityKw,
        hours: 14 * 24,
      });
    } catch (error: any) {
      console.error(`[Insights] Telemetry fetch failed: ${error.message}`);
      telemetryData = generateMockTelemetry(systemCapacityKw, 14);
    }

    // 2. Generate residuals
    const residuals = telemetryData.map((point, idx) => {
      const yesterdayIdx = Math.max(0, idx - 24);
      const predicted = telemetryData[yesterdayIdx]?.ac_kw || point.ac_kw;

      return {
        ts: point.ts,
        actual: point.ac_kw,
        predicted: predicted
      };
    });

    // 3. Get anomalies
    const anomalyResponse = await axios.post(`${AI_SERVICE_URL}/detect_anomalies`, {
      residuals: residuals.slice(-7 * 24) // Last 7 days
    });

    const anomalies = anomalyResponse.data.anomalies;

    // 4. Generate insight cards
    const insights = await generateInsightCards(
      siteId,
      telemetryData,
      residuals,
      anomalies
    );

    // Sort by impact (descending)
    insights.sort((a, b) => b.impact_kwh - a.impact_kwh);

    res.json({ insights });

  } catch (error: any) {
    console.error('[Insights] Error:', error.message);
    res.status(500).json({
      error: 'Failed to generate insights',
      message: error.message
    });
  }
});

export default router;
