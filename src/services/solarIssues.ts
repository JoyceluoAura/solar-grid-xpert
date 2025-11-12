/**
 * Solar Issue Detection and Video Mapping Service
 *
 * Maps detected solar panel issues to realistic video clips and provides
 * AI-powered insights, confidence scores, and recommendations
 */

import { SolarWeatherData } from './nasaPower';

export type IssueType =
  | 'hotspot'
  | 'crack'
  | 'soiling'
  | 'delamination'
  | 'shadow'
  | 'snow'
  | 'none';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SolarIssue {
  id: string;
  site_id: string;
  panel_id: string;
  type: IssueType;
  severity: SeverityLevel;
  name: string;
  description: string;
  location: string;

  // Video and visual
  videoUrl: string;
  posterUrl: string;

  // AI metrics
  confidence: number;           // 0-1 confidence score
  energy_loss_percent: number;  // % energy loss
  predicted_kwh_loss: number;   // kWh loss per day

  // Sensor data
  sensor_data: {
    panel_temp: number;         // °C
    ambient_temp: number;       // °C
    irradiance: number;         // W/m²
    voltage: number;            // V
    current: number;            // A
    power_output: number;       // W
  };

  // Timestamps
  detected_at: string;          // ISO timestamp
  is_live: boolean;             // < 10 minutes old

  // Actions
  recommended_actions: string[];
  dispatch_priority: 'immediate' | 'urgent' | 'scheduled' | 'monitor';
}

interface IssueMapping {
  type: IssueType;
  videoUrl: string;
  posterUrl: string;
  description: string;
  typical_severity: SeverityLevel;
  energy_loss_range: [number, number]; // min, max %
  visual_effect: string;
  recommendations: string[];
}

class SolarIssueService {
  private static instance: SolarIssueService;

  // Issue type to video mapping with realistic URLs
  private issueMapping: Record<IssueType, IssueMapping> = {
    hotspot: {
      type: 'hotspot',
      videoUrl: 'https://videos.pexels.com/video-files/4509544/4509544-uhd_2560_1440_25fps.mp4',
      posterUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&h=300&fit=crop',
      description: 'Thermal anomaly detected - immediate inspection required',
      typical_severity: 'critical',
      energy_loss_range: [15, 35],
      visual_effect: 'Thermal glow pulsing on panel cells',
      recommendations: [
        'Schedule immediate thermal inspection',
        'Check for cell bypass diode failure',
        'Verify string voltage and current',
        'Consider panel replacement if severe'
      ]
    },
    crack: {
      type: 'crack',
      videoUrl: 'https://videos.pexels.com/video-files/8953563/8953563-uhd_2560_1440_25fps.mp4',
      posterUrl: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=400&h=300&fit=crop',
      description: 'Physical crack detected on panel surface',
      typical_severity: 'high',
      energy_loss_range: [10, 25],
      visual_effect: 'Micro-crack appearing with reflection',
      recommendations: [
        'Document crack size and location',
        'Monitor for crack expansion',
        'Check warranty coverage',
        'Plan panel replacement'
      ]
    },
    soiling: {
      type: 'soiling',
      videoUrl: 'https://videos.pexels.com/video-files/2278095/2278095-uhd_2560_1440_30fps.mp4',
      posterUrl: 'https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=400&h=300&fit=crop',
      description: 'Heavy dust accumulation reducing efficiency',
      typical_severity: 'medium',
      energy_loss_range: [5, 15],
      visual_effect: 'Dust layer reducing shine',
      recommendations: [
        'Schedule cleaning service',
        'Consider automated cleaning system',
        'Check local weather patterns',
        'Implement preventive maintenance'
      ]
    },
    delamination: {
      type: 'delamination',
      videoUrl: 'https://videos.pexels.com/video-files/9648835/9648835-uhd_2560_1440_30fps.mp4',
      posterUrl: 'https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?w=400&h=300&fit=crop',
      description: 'Layer separation detected - monitor closely',
      typical_severity: 'high',
      energy_loss_range: [12, 30],
      visual_effect: 'Film bubble growth',
      recommendations: [
        'Inspect for water ingress',
        'Check warranty status',
        'Monitor progression rate',
        'Plan panel replacement'
      ]
    },
    shadow: {
      type: 'shadow',
      videoUrl: 'https://videos.pexels.com/video-files/7235122/7235122-uhd_2560_1440_30fps.mp4',
      posterUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop',
      description: 'Shading detected affecting output',
      typical_severity: 'medium',
      energy_loss_range: [20, 50],
      visual_effect: 'Dynamic shade from nearby object',
      recommendations: [
        'Identify shading source',
        'Trim vegetation if applicable',
        'Consider panel relocation',
        'Install bypass diodes'
      ]
    },
    snow: {
      type: 'snow',
      videoUrl: 'https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4',
      posterUrl: 'https://images.unsplash.com/photo-1509390144881-c8fc18f5a628?w=400&h=300&fit=crop',
      description: 'Snow coverage affecting generation',
      typical_severity: 'low',
      energy_loss_range: [80, 100],
      visual_effect: 'Snow layer on panel surface',
      recommendations: [
        'Monitor for natural snow melt',
        'Consider snow removal if urgent',
        'Check tilt angle optimization',
        'Install heating elements for frequent snow'
      ]
    },
    none: {
      type: 'none',
      videoUrl: 'https://videos.pexels.com/video-files/7235122/7235122-uhd_2560_1440_30fps.mp4',
      posterUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop',
      description: 'All panels operating within normal parameters',
      typical_severity: 'info',
      energy_loss_range: [0, 2],
      visual_effect: 'Normal operation',
      recommendations: [
        'Continue monitoring',
        'Maintain regular cleaning schedule',
        'Keep up preventive maintenance',
        'Review performance quarterly'
      ]
    }
  };

  private constructor() {}

  static getInstance(): SolarIssueService {
    if (!SolarIssueService.instance) {
      SolarIssueService.instance = new SolarIssueService();
    }
    return SolarIssueService.instance;
  }

  /**
   * Generate solar issue with AI insights based on weather context
   */
  generateIssue(
    issueType: IssueType,
    panelId: string,
    location: string,
    weatherData: SolarWeatherData,
    siteId: string = 'SGX-IND-001'
  ): SolarIssue {
    const mapping = this.issueMapping[issueType];
    const detectedAt = new Date();

    // Calculate if issue is "live" (< 10 minutes old)
    const isLive = true; // For demo, always live

    // AI confidence score (90-99% for demo)
    const confidence = 0.90 + Math.random() * 0.09;

    // Energy loss calculation based on issue type and weather
    const energyLossBase = (mapping.energy_loss_range[0] + mapping.energy_loss_range[1]) / 2;
    const energyLossVariation = (Math.random() - 0.5) * 5;
    const energyLoss = Math.max(0, Math.min(100, energyLossBase + energyLossVariation));

    // Calculate predicted kWh loss (assuming 5 kW panel capacity)
    const panelCapacity = 5; // kW
    const normalDailyGeneration = panelCapacity * 4.5; // kWh/day (avg 4.5 peak sun hours)
    const predictedKwhLoss = (normalDailyGeneration * energyLoss) / 100;

    // Generate sensor data with weather context
    const panelTemp = this.calculatePanelTemp(weatherData.temperature, weatherData.irradiance);
    const expectedPower = this.calculateExpectedPower(
      panelCapacity,
      weatherData.irradiance,
      panelTemp,
      energyLoss
    );

    // Determine dispatch priority
    let dispatchPriority: 'immediate' | 'urgent' | 'scheduled' | 'monitor';
    switch (mapping.typical_severity) {
      case 'critical':
        dispatchPriority = 'immediate';
        break;
      case 'high':
        dispatchPriority = 'urgent';
        break;
      case 'medium':
        dispatchPriority = 'scheduled';
        break;
      default:
        dispatchPriority = 'monitor';
    }

    return {
      id: `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      site_id: siteId,
      panel_id: panelId,
      type: issueType,
      severity: mapping.typical_severity,
      name: `Panel ${panelId} - ${this.formatIssueType(issueType)} Detection`,
      description: mapping.description,
      location,
      videoUrl: mapping.videoUrl,
      posterUrl: mapping.posterUrl,
      confidence,
      energy_loss_percent: Math.round(energyLoss * 10) / 10,
      predicted_kwh_loss: Math.round(predictedKwhLoss * 10) / 10,
      sensor_data: {
        panel_temp: Math.round(panelTemp * 10) / 10,
        ambient_temp: Math.round(weatherData.temperature * 10) / 10,
        irradiance: Math.round(weatherData.irradiance),
        voltage: Math.round((30 + Math.random() * 5) * 10) / 10,
        current: Math.round((8 + Math.random() * 2) * 10) / 10,
        power_output: Math.round(expectedPower),
      },
      detected_at: detectedAt.toISOString(),
      is_live: isLive,
      recommended_actions: mapping.recommendations,
      dispatch_priority: dispatchPriority,
    };
  }

  /**
   * Calculate panel temperature based on ambient temp and irradiance
   */
  private calculatePanelTemp(ambientTemp: number, irradiance: number): number {
    // Typical panel temp = ambient + (irradiance * 0.03)
    // Panels typically run 20-30°C above ambient under full sun
    return ambientTemp + (irradiance / 1000) * 25 + (Math.random() * 5);
  }

  /**
   * Calculate expected power output
   */
  private calculateExpectedPower(
    capacity: number,
    irradiance: number,
    panelTemp: number,
    energyLoss: number
  ): number {
    // Simple power calculation
    const irradianceFactor = irradiance / 1000;
    const tempLoss = (panelTemp - 25) * 0.004; // -0.4% per °C above 25°C
    const tempFactor = 1 - tempLoss;
    const issueFactor = 1 - (energyLoss / 100);

    return capacity * 1000 * irradianceFactor * tempFactor * issueFactor;
  }

  /**
   * Format issue type for display
   */
  private formatIssueType(type: IssueType): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Get issue mapping
   */
  getIssueMapping(type: IssueType): IssueMapping {
    return this.issueMapping[type];
  }

  /**
   * Generate multiple issues for a site
   */
  generateSiteIssues(
    siteId: string,
    weatherData: SolarWeatherData,
    issueCount: number = 6
  ): SolarIssue[] {
    const issues: SolarIssue[] = [];
    const issueTypes: IssueType[] = ['hotspot', 'crack', 'soiling', 'delamination', 'shadow', 'none'];

    for (let i = 0; i < issueCount; i++) {
      const issueType = issueTypes[i];
      const panelId = `Array-${String.fromCharCode(65 + i)}-${i + 1}`;
      const location = `Row ${i + 1}, Panel ${(i % 5) + 1}`;

      issues.push(this.generateIssue(issueType, panelId, location, weatherData, siteId));
    }

    return issues;
  }
}

// Export singleton instance
export const solarIssueService = SolarIssueService.getInstance();
