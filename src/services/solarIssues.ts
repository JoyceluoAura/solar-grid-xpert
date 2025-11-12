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

const createPoster = (title: string, subtitle: string, gradientFrom: string, gradientTo: string) => {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>
      <defs>
        <linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stop-color='${gradientFrom}' />
          <stop offset='100%' stop-color='${gradientTo}' />
        </linearGradient>
      </defs>
      <rect width='400' height='300' fill='url(#grad)' rx='24' ry='24'/>
      <g fill='rgba(255,255,255,0.85)'>
        <text x='32' y='150' font-size='42' font-weight='700' font-family='Inter,sans-serif'>${title}</text>
        <text x='32' y='198' font-size='22' font-weight='500' font-family='Inter,sans-serif'>${subtitle}</text>
      </g>
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

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
  imageUrl: string;
  imageAlt: string;
  imageLocation: string;

  // AI metrics
  confidence: number;           // 0-1 confidence score
  energy_loss_percent: number;  // % energy loss
  predicted_kwh_loss: number;   // kWh loss per day

  // Validation and errors
  has_sensor_error: boolean;    // True if sensor data is invalid
  needs_recheck: boolean;       // True if confidence < 70%
  error_message?: string;       // Error description if any

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
  imageUrl: string;
  imageAlt: string;
  imageLocation: string;
  description: string;
  typical_severity: SeverityLevel;
  energy_loss_range: [number, number]; // min, max %
  visual_effect: string;
  recommendations: string[];
}

class SolarIssueService {
  private static instance: SolarIssueService;

  // Issue type to video mapping with realistic solar panel URLs
  // Using actual solar panel inspection and monitoring videos
  private issueMapping: Record<IssueType, IssueMapping> = {
    hotspot: {
      type: 'hotspot',
      videoUrl: 'https://videos.pexels.com/video-files/8092472/8092472-uhd_2560_1440_25fps.mp4',
      posterUrl: createPoster('Hotspot Detected', 'Cell overheating pattern', '#ef4444', '#f97316'),
      imageUrl: '/images/visual/panel-hotspot.svg',
      imageAlt: 'Infrared visualization of thermal hotspot on Batam industrial solar array in Indonesia',
      imageLocation: 'Batam Industrial Park, Riau Islands',
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
      videoUrl: 'https://videos.pexels.com/video-files/9604094/9604094-uhd_2560_1440_24fps.mp4',
      posterUrl: createPoster('Cracked Glass', 'Micro-fracture on string', '#7c3aed', '#ec4899'),
      imageUrl: '/images/visual/panel-cracks.svg',
      imageAlt: 'Cracked solar module on Bandung rooftop installation after hail event in Indonesia',
      imageLocation: 'Bandung Textile Warehouse, West Java',
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
      videoUrl: 'https://videos.pexels.com/video-files/6076970/6076970-uhd_3840_2160_25fps.mp4',
      posterUrl: createPoster('Bird Droppings', 'Soiling across cells', '#ca8a04', '#facc15'),
      imageUrl: '/images/visual/panel-bird-droppings.svg',
      imageAlt: 'Bird droppings across Surabaya port warehouse solar rooftop in Indonesia',
      imageLocation: 'Surabaya Port Logistics Rooftop, East Java',
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
      videoUrl: 'https://videos.pexels.com/video-files/4496260/4496260-uhd_3840_2160_24fps.mp4',
      posterUrl: createPoster('Delamination', 'Encapsulant bubbling', '#0ea5e9', '#22d3ee'),
      imageUrl: '/images/visual/panel-delamination.svg',
      imageAlt: 'Encapsulant delamination bubbles on Sleman community solar project in Yogyakarta, Indonesia',
      imageLocation: 'Sleman Community Solar, Special Region of Yogyakarta',
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
      videoUrl: 'https://videos.pexels.com/video-files/6077448/6077448-uhd_3840_2160_25fps.mp4',
      posterUrl: createPoster('Cloud Shading', 'Passing cumulus cover', '#1d4ed8', '#0ea5e9'),
      imageUrl: '/images/visual/panel-shadow.svg',
      imageAlt: 'Jakarta central business district rooftop solar array under drifting cloud shadows',
      imageLocation: 'Jakarta CBD Rooftop, DKI Jakarta',
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
      videoUrl: 'https://videos.pexels.com/video-files/2675514/2675514-uhd_2560_1440_25fps.mp4',
      posterUrl: createPoster('Snow Cover', 'Panels partially buried', '#94a3b8', '#38bdf8'),
      imageUrl: '/images/visual/panel-monsoon.svg',
      imageAlt: 'Monsoon rainfall pooling on Bekasi industrial rooftop solar array in Indonesia',
      imageLocation: 'Bekasi Industrial Estate, West Java',
      description: 'Heavy monsoon rainwater pooling reduces irradiance and increases PID risk',
      typical_severity: 'medium',
      energy_loss_range: [18, 35],
      visual_effect: 'Surface water reflecting sky and diffusing irradiance',
      recommendations: [
        'Verify drainage paths and tilt angles after downpours',
        'Schedule post-rain inspection for potential PID hotspots',
        'Install guttering to divert roof runoff away from arrays',
        'Log rainfall intensity to correlate with output recovery'
      ]
    },
    none: {
      type: 'none',
      videoUrl: 'https://videos.pexels.com/video-files/2611250/2611250-uhd_2560_1440_30fps.mp4',
      posterUrl: createPoster('All Clear', 'No issues detected', '#4ade80', '#22c55e'),
      imageUrl: '/images/visual/panel-perfect.svg',
      imageAlt: 'Floating solar array on Cirata Reservoir operating at peak performance in Indonesia',
      imageLocation: 'Cirata Floating Solar Park, West Java',
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
   * Validate sensor data
   */
  private validateSensorData(
    irradiance: number,
    panelTemp: number,
    ambientTemp: number
  ): { isValid: boolean; errorMessage?: string } {
    // Check for invalid irradiance
    if (irradiance < 0) {
      return {
        isValid: false,
        errorMessage: 'Sensor Error: Negative irradiance value detected'
      };
    }

    // Check for invalid panel temperature
    if (panelTemp < -50) {
      return {
        isValid: false,
        errorMessage: 'Sensor Error: Panel temperature below -50°C (sensor malfunction)'
      };
    }

    // Check for invalid ambient temperature
    if (ambientTemp < -50 || ambientTemp > 60) {
      return {
        isValid: false,
        errorMessage: 'Sensor Error: Ambient temperature out of range'
      };
    }

    // Check for unrealistic temperature difference
    if (panelTemp < ambientTemp - 5) {
      return {
        isValid: false,
        errorMessage: 'Sensor Error: Panel temp lower than ambient (sensor drift)'
      };
    }

    return { isValid: true };
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

    // AI confidence score (varies between 65-99% for realism)
    // Some issues will have low confidence requiring re-check
    const confidenceBase = issueType === 'none' ? 0.95 : 0.85;
    const confidenceVariation = (Math.random() - 0.3) * 0.25; // Can go below 0.70
    const confidence = Math.max(0.65, Math.min(0.99, confidenceBase + confidenceVariation));

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

    // Validate sensor data
    const validation = this.validateSensorData(
      weatherData.irradiance,
      panelTemp,
      weatherData.temperature
    );

    // Check if AI needs re-check (confidence < 70%)
    const needsRecheck = confidence < 0.70;

    // Determine dispatch priority
    let dispatchPriority: 'immediate' | 'urgent' | 'scheduled' | 'monitor';
    if (!validation.isValid) {
      dispatchPriority = 'immediate'; // Sensor errors are critical
    } else {
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
    }

    // Adjust recommendations if validation fails or needs recheck
    let recommendations = [...mapping.recommendations];
    if (!validation.isValid) {
      recommendations = [
        'URGENT: Check sensor calibration',
        'Verify sensor wiring and connections',
        'Replace faulty sensor if needed',
        'Review recent maintenance logs'
      ];
    } else if (needsRecheck) {
      recommendations = [
        'AI Confidence Low: Re-check camera feed',
        'Verify detection with manual inspection',
        ...mapping.recommendations.slice(0, 2)
      ];
    }

    return {
      id: `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      site_id: siteId,
      panel_id: panelId,
      type: issueType,
      severity: !validation.isValid ? 'critical' : mapping.typical_severity,
      name: !validation.isValid
        ? `Panel ${panelId} - Sensor Error Detected`
        : `Panel ${panelId} - ${this.formatIssueType(issueType)} Detection`,
      description: validation.errorMessage || mapping.description,
      location,
      videoUrl: mapping.videoUrl,
      posterUrl: mapping.posterUrl,
      imageUrl: mapping.imageUrl,
      imageAlt: mapping.imageAlt,
      imageLocation: mapping.imageLocation,
      confidence,
      energy_loss_percent: Math.round(energyLoss * 10) / 10,
      predicted_kwh_loss: Math.round(predictedKwhLoss * 10) / 10,
      has_sensor_error: !validation.isValid,
      needs_recheck: needsRecheck,
      error_message: validation.errorMessage,
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
      recommended_actions: recommendations,
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
    const scenes: Array<{ type: IssueType; panelId: string; location: string }> = [
      { type: 'hotspot', panelId: 'Batam-A1', location: this.issueMapping.hotspot.imageLocation },
      { type: 'crack', panelId: 'Bandung-C2', location: this.issueMapping.crack.imageLocation },
      { type: 'soiling', panelId: 'Surabaya-B3', location: this.issueMapping.soiling.imageLocation },
      { type: 'delamination', panelId: 'Sleman-D4', location: this.issueMapping.delamination.imageLocation },
      { type: 'shadow', panelId: 'Jakarta-E5', location: this.issueMapping.shadow.imageLocation },
      { type: 'none', panelId: 'Cirata-F6', location: this.issueMapping.none.imageLocation },
    ];

    const issues: SolarIssue[] = [];
    for (let i = 0; i < Math.min(issueCount, scenes.length); i++) {
      const scene = scenes[i];
      issues.push(this.generateIssue(scene.type, scene.panelId, scene.location, weatherData, siteId));
    }

    return issues;
  }
}

// Export singleton instance
export const solarIssueService = SolarIssueService.getInstance();
