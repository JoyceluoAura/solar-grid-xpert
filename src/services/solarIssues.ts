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

const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 300;

const buildPanelSvg = ({
  title,
  subtitle,
  accentFrom,
  accentTo,
  overlay,
  glow,
}: {
  title: string;
  subtitle: string;
  accentFrom: string;
  accentTo: string;
  overlay: string;
  glow?: string;
}) => {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}'>
      <defs>
        <linearGradient id='panel-gradient' x1='0%' y1='0%' x2='0%' y2='100%'>
          <stop offset='0%' stop-color='#0f172a'/>
          <stop offset='100%' stop-color='#1e293b'/>
        </linearGradient>
        <linearGradient id='accent-gradient' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stop-color='${accentFrom}' />
          <stop offset='100%' stop-color='${accentTo}' />
        </linearGradient>
      </defs>
      <rect width='${PANEL_WIDTH}' height='${PANEL_HEIGHT}' rx='28' ry='28' fill='url(#accent-gradient)' opacity='0.2'/>
      <g transform='translate(34 36)'>
        <rect width='332' height='210' rx='20' ry='20' fill='url(#panel-gradient)' stroke='rgba(59,130,246,0.35)' stroke-width='8'/>
        <g stroke='rgba(148,163,184,0.35)' stroke-width='2'>
          ${Array.from({ length: 3 })
            .map((_, i) => `<line x1='0' y1='${50 + i * 40}' x2='332' y2='${50 + i * 40}' />`)
            .join('')}
          ${Array.from({ length: 5 })
            .map((_, i) => `<line x1='${55 + i * 55}' y1='0' x2='${55 + i * 55}' y2='210' />`)
            .join('')}
        </g>
        ${glow ?? ''}
        ${overlay}
      </g>
      <rect x='30' y='230' width='340' height='54' rx='16' ry='16' fill='rgba(15,23,42,0.85)' />
      <text x='50' y='260' font-size='26' font-weight='700' fill='white' font-family='Inter, sans-serif'>${title}</text>
      <text x='50' y='285' font-size='18' font-weight='500' fill='rgba(226,232,240,0.9)' font-family='Inter, sans-serif'>${subtitle}</text>
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const createOverlay = (type: IssueType, variant: number) => {
  const seed = variant + 1;
  switch (type) {
    case 'hotspot': {
      const radius = 55 + seed * 6;
      const glow = `
        <defs>
          <radialGradient id='hotspot-${variant}' cx='50%' cy='50%' r='50%'>
            <stop offset='0%' stop-color='rgba(239,68,68,0.95)' />
            <stop offset='50%' stop-color='rgba(249,115,22,0.75)' />
            <stop offset='100%' stop-color='rgba(253,224,71,0.05)' />
          </radialGradient>
        </defs>
        <circle cx='180' cy='110' r='${radius}' fill='url(#hotspot-${variant})'>
          <animate attributeName='r' values='${radius};${radius + 6};${radius}' dur='4s' repeatCount='indefinite' />
        </circle>
      `;
      return { overlay: '', glow };
    }
    case 'crack': {
      const crackPaths = [
        `M40,40 L280,180`,
        `M120,20 L200,200`,
        `M200,60 L320,150`,
      ]
        .slice(0, 2 + (seed % 2))
        .map(
          (d, idx) =>
            `<path d='${d}' stroke='rgba(236,72,153,0.85)' stroke-width='${3 + idx}' stroke-linecap='round' stroke-dasharray='12 ${4 + idx * 2}' />`
        )
        .join('');
      return {
        overlay: `<g>${crackPaths}</g>`,
        glow: `<g opacity='0.18'><rect x='0' y='0' width='332' height='210' fill='rgba(124,58,237,0.4)' /></g>`,
      };
    }
    case 'soiling': {
      const dropShapes = Array.from({ length: 4 + seed }, (_, idx) => {
        const x = 40 + (idx * 60) % 260 + (idx % 2 === 0 ? 12 : -8);
        const y = 80 + (idx % 3) * 30;
        const size = 26 + (idx % 3) * 6;
        return `<path d='M${x} ${y} q10 -18 22 0 q-6 18 -22 24 q-16 -6 -10 -24' fill='rgba(234,179,8,0.85)' stroke='rgba(202,138,4,0.6)' stroke-width='2' />`;
      }).join('');
      return {
        overlay: `<g>${dropShapes}</g>`,
        glow: `<rect x='0' y='120' width='332' height='80' fill='rgba(245,158,11,0.25)' />`,
      };
    }
    case 'delamination': {
      const waves = Array.from({ length: 3 }, (_, idx) => {
        const y = 70 + idx * 40 + variant * 4;
        return `<path d='M30 ${y} q50 -20 100 0 t100 0 t100 0' fill='none' stroke='rgba(14,165,233,0.7)' stroke-width='${3 + idx}' stroke-linecap='round' stroke-dasharray='14 8' />`;
      }).join('');
      return {
        overlay: `<g>${waves}</g>`,
        glow: `<rect x='0' y='0' width='332' height='210' fill='rgba(14,165,233,0.12)' />`,
      };
    }
    case 'shadow': {
      const gradientId = `shadow-${variant}`;
      const offset = 60 + variant * 20;
      const gradient = `
        <defs>
          <linearGradient id='${gradientId}' x1='0%' y1='0%' x2='100%' y2='0%'>
            <stop offset='0%' stop-color='rgba(30,64,175,0.95)' />
            <stop offset='50%' stop-color='rgba(59,130,246,0.35)' />
            <stop offset='100%' stop-color='rgba(125,211,252,0.05)' />
          </linearGradient>
        </defs>
      `;
      return {
        overlay: `${gradient}<rect x='${offset}' y='0' width='220' height='210' fill='url(#${gradientId})' />`,
        glow: `<rect x='0' y='0' width='332' height='210' fill='rgba(37,99,235,0.15)' />`,
      };
    }
    case 'snow': {
      const snowDrifts = Array.from({ length: 3 }, (_, idx) => {
        const y = 160 + idx * 8;
        const opacity = 0.85 - idx * 0.2;
        return `<path d='M-10 ${y} q60 -40 120 0 t120 0 t120 0 t120 0' fill='rgba(255,255,255,${opacity})' />`;
      }).join('');
      const flakes = Array.from({ length: 16 }, (_, idx) => {
        const x = 30 + (idx * 22) % 310;
        const y = 30 + ((idx * 37) % 150);
        const size = 4 + (idx % 3);
        return `<circle cx='${x}' cy='${y}' r='${size / 2}' fill='rgba(255,255,255,0.8)' />`;
      }).join('');
      return {
        overlay: `<g>${snowDrifts}${flakes}</g>`,
        glow: `<rect x='0' y='0' width='332' height='210' fill='rgba(148,163,184,0.18)' />`,
      };
    }
    default: {
      return {
        overlay: `<g opacity='0.25'>
          <circle cx='90' cy='110' r='16' fill='rgba(34,197,94,0.7)' />
          <circle cx='150' cy='140' r='20' fill='rgba(34,197,94,0.5)' />
          <circle cx='240' cy='100' r='18' fill='rgba(34,197,94,0.6)' />
        </g>`,
        glow: `<rect x='0' y='0' width='332' height='210' fill='rgba(34,197,94,0.12)' />`,
      };
    }
  }
};

const createPoster = (title: string, subtitle: string, gradientFrom: string, gradientTo: string) =>
  buildPanelSvg({ title, subtitle, accentFrom: gradientFrom, accentTo: gradientTo, overlay: '', glow: '' });

export interface SolarIssueHistoryFrame {
  timestamp: string;
  label: string;
  imageUrl: string;
  notes: string;
  severity: SeverityLevel;
}

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
  history: SolarIssueHistoryFrame[];

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
  description: string;
  typical_severity: SeverityLevel;
  energy_loss_range: [number, number]; // min, max %
  visual_effect: string;
  recommendations: string[];
  accent: { from: string; to: string };
  historyTimeline: Array<{
    label: string;
    hoursAgo: number;
    notes: string;
    severity?: SeverityLevel;
  }>;
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
      description: 'Thermal anomaly detected - immediate inspection required',
      typical_severity: 'critical',
      energy_loss_range: [15, 35],
      visual_effect: 'Thermal glow pulsing on panel cells',
      recommendations: [
        'Schedule immediate thermal inspection',
        'Check for cell bypass diode failure',
        'Verify string voltage and current',
        'Consider panel replacement if severe'
      ],
      accent: { from: '#f97316', to: '#facc15' },
      historyTimeline: [
        { label: '24h ago', hoursAgo: 24, notes: 'Initial mild heating visible', severity: 'high' },
        { label: '12h ago', hoursAgo: 12, notes: 'Hotspot expanding across cells', severity: 'high' },
        { label: '1h ago', hoursAgo: 1, notes: 'Critical temperature spike detected', severity: 'critical' },
      ],
    },
    crack: {
      type: 'crack',
      videoUrl: 'https://videos.pexels.com/video-files/9604094/9604094-uhd_2560_1440_24fps.mp4',
      posterUrl: createPoster('Cracked Glass', 'Micro-fracture on string', '#7c3aed', '#ec4899'),
      description: 'Physical crack detected on panel surface',
      typical_severity: 'high',
      energy_loss_range: [10, 25],
      visual_effect: 'Micro-crack appearing with reflection',
      recommendations: [
        'Document crack size and location',
        'Monitor for crack expansion',
        'Check warranty coverage',
        'Plan panel replacement'
      ],
      accent: { from: '#7c3aed', to: '#ec4899' },
      historyTimeline: [
        { label: '3d ago', hoursAgo: 72, notes: 'Hairline fracture detected', severity: 'medium' },
        { label: '24h ago', hoursAgo: 24, notes: 'Crack spreading across cells', severity: 'high' },
        { label: 'Now', hoursAgo: 0.5, notes: 'Structural integrity compromised', severity: 'high' },
      ],
    },
    soiling: {
      type: 'soiling',
      videoUrl: 'https://videos.pexels.com/video-files/6076970/6076970-uhd_3840_2160_25fps.mp4',
      posterUrl: createPoster('Bird Droppings', 'Soiling across cells', '#ca8a04', '#facc15'),
      description: 'Heavy dust accumulation reducing efficiency',
      typical_severity: 'medium',
      energy_loss_range: [5, 15],
      visual_effect: 'Dust layer reducing shine',
      recommendations: [
        'Schedule cleaning service',
        'Consider automated cleaning system',
        'Check local weather patterns',
        'Implement preventive maintenance'
      ],
      accent: { from: '#b45309', to: '#f59e0b' },
      historyTimeline: [
        { label: '7d ago', hoursAgo: 168, notes: 'Light debris detected on upper cells', severity: 'low' },
        { label: '2d ago', hoursAgo: 48, notes: 'Bird droppings covering cell junction', severity: 'medium' },
        { label: 'Today', hoursAgo: 2, notes: 'Generation loss exceeds 12%', severity: 'medium' },
      ],
    },
    delamination: {
      type: 'delamination',
      videoUrl: 'https://videos.pexels.com/video-files/4496260/4496260-uhd_3840_2160_24fps.mp4',
      posterUrl: createPoster('Delamination', 'Encapsulant bubbling', '#0ea5e9', '#22d3ee'),
      description: 'Layer separation detected - monitor closely',
      typical_severity: 'high',
      energy_loss_range: [12, 30],
      visual_effect: 'Film bubble growth',
      recommendations: [
        'Inspect for water ingress',
        'Check warranty status',
        'Monitor progression rate',
        'Plan panel replacement'
      ],
      accent: { from: '#0ea5e9', to: '#22d3ee' },
      historyTimeline: [
        { label: '10d ago', hoursAgo: 240, notes: 'Minor delamination around edges', severity: 'medium' },
        { label: '3d ago', hoursAgo: 72, notes: 'Encapsulant bubbling expanding', severity: 'high' },
        { label: 'Now', hoursAgo: 1, notes: 'Moisture ingress imminent', severity: 'high' },
      ],
    },
    shadow: {
      type: 'shadow',
      videoUrl: 'https://videos.pexels.com/video-files/6077448/6077448-uhd_3840_2160_25fps.mp4',
      posterUrl: createPoster('Cloud Shading', 'Passing cumulus cover', '#1d4ed8', '#0ea5e9'),
      description: 'Shading detected affecting output',
      typical_severity: 'medium',
      energy_loss_range: [20, 50],
      visual_effect: 'Dynamic shade from nearby object',
      recommendations: [
        'Identify shading source',
        'Trim vegetation if applicable',
        'Consider panel relocation',
        'Install bypass diodes'
      ],
      accent: { from: '#1d4ed8', to: '#0ea5e9' },
      historyTimeline: [
        { label: '2d ago', hoursAgo: 48, notes: 'Morning shading from tree growth', severity: 'medium' },
        { label: '12h ago', hoursAgo: 12, notes: 'Cloud bank causes intermittent losses', severity: 'medium' },
        { label: 'Now', hoursAgo: 0.5, notes: 'Heavy shading reducing string output', severity: 'medium' },
      ],
    },
    snow: {
      type: 'snow',
      videoUrl: 'https://videos.pexels.com/video-files/2675514/2675514-uhd_2560_1440_25fps.mp4',
      posterUrl: createPoster('Snow Cover', 'Panels partially buried', '#94a3b8', '#38bdf8'),
      description: 'Snow coverage affecting generation',
      typical_severity: 'low',
      energy_loss_range: [80, 100],
      visual_effect: 'Snow layer on panel surface',
      recommendations: [
        'Monitor for natural snow melt',
        'Consider snow removal if urgent',
        'Check tilt angle optimization',
        'Install heating elements for frequent snow'
      ],
      accent: { from: '#94a3b8', to: '#38bdf8' },
      historyTimeline: [
        { label: '18h ago', hoursAgo: 18, notes: 'Light dusting accumulating', severity: 'low' },
        { label: '6h ago', hoursAgo: 6, notes: 'Partial snow cover on lower string', severity: 'medium' },
        { label: 'Now', hoursAgo: 0.5, notes: 'Thick snow layer blocking output', severity: 'medium' },
      ],
    },
    none: {
      type: 'none',
      videoUrl: 'https://videos.pexels.com/video-files/2611250/2611250-uhd_2560_1440_30fps.mp4',
      posterUrl: createPoster('All Clear', 'No issues detected', '#4ade80', '#22c55e'),
      description: 'All panels operating within normal parameters',
      typical_severity: 'info',
      energy_loss_range: [0, 2],
      visual_effect: 'Normal operation',
      recommendations: [
        'Continue monitoring',
        'Maintain regular cleaning schedule',
        'Keep up preventive maintenance',
        'Review performance quarterly'
      ],
      accent: { from: '#22c55e', to: '#4ade80' },
      historyTimeline: [
        { label: '7d ago', hoursAgo: 168, notes: 'All strings nominal', severity: 'info' },
        { label: '24h ago', hoursAgo: 24, notes: 'Healthy production trend', severity: 'info' },
        { label: 'Now', hoursAgo: 0.5, notes: 'No alerts detected', severity: 'info' },
      ],
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

    const { overlay: liveOverlay, glow: liveGlow } = createOverlay(issueType, 0);
    const imageUrl = buildPanelSvg({
      title: mapping.visual_effect,
      subtitle: `${location} • ${mapping.description}`,
      accentFrom: mapping.accent.from,
      accentTo: mapping.accent.to,
      overlay: liveOverlay,
      glow: liveGlow,
    });

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
      imageUrl,
      history: mapping.historyTimeline.map((entry, idx) => {
        const { overlay, glow } = createOverlay(issueType, idx + 1);
        const timestamp = new Date(detectedAt.getTime() - entry.hoursAgo * 60 * 60 * 1000);
        return {
          timestamp: timestamp.toISOString(),
          label: entry.label,
          notes: entry.notes,
          severity: entry.severity ?? mapping.typical_severity,
          imageUrl: buildPanelSvg({
            title: mapping.visual_effect,
            subtitle: entry.notes,
            accentFrom: mapping.accent.from,
            accentTo: mapping.accent.to,
            overlay,
            glow,
          }),
        };
      }),
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
