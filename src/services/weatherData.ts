/**
 * Weather Data Service with Solcast and NSRDB Integration
 *
 * Provides normalized solar radiation and temperature data
 * Primary: Solcast estimated_actuals
 * Fallback: NREL NSRDB PSM3
 */

export type WeatherSource = 'Solcast' | 'NSRDB' | 'Mock';

export interface SolarSample {
  ts: string;           // ISO timestamp
  ghi_wm2: number;     // Global Horizontal Irradiance (W/m²)
  dni_wm2: number;     // Direct Normal Irradiance (W/m²)
  dhi_wm2: number;     // Diffuse Horizontal Irradiance (W/m²)
  air_temp_c: number;  // Air temperature (°C)
  wind_ms?: number;    // Wind speed (m/s)
  source: WeatherSource;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  severity: 'ok' | 'warning' | 'critical';
}

interface SolcastResponse {
  estimated_actuals: Array<{
    period_end: string;
    ghi: number;
    dni: number;
    dhi: number;
    air_temp?: number;
    wind_speed_10m?: number;
  }>;
}

interface NSRDBDataPoint {
  Year: number;
  Month: number;
  Day: number;
  Hour: number;
  Minute: number;
  GHI: number;
  DNI: number;
  DHI: number;
  Temperature: number;
  'Wind Speed': number;
}

class WeatherDataService {
  private static instance: WeatherDataService;
  private cache: Map<string, { data: SolarSample[]; timestamp: number }> = new Map();
  private cacheDuration = 300000; // 5 minutes

  private readonly REALISTIC_RANGES = {
    ghi: { min: 0, max: 1400 },      // W/m²
    dni: { min: 0, max: 1100 },      // W/m²
    dhi: { min: 0, max: 800 },       // W/m²
    temp: { min: -40, max: 85 },     // °C
    wind: { min: 0, max: 80 },       // m/s
  };

  private constructor() {}

  static getInstance(): WeatherDataService {
    if (!WeatherDataService.instance) {
      WeatherDataService.instance = new WeatherDataService();
    }
    return WeatherDataService.instance;
  }

  /**
   * Normalize raw weather data from any source
   * Converts null/-999/negative to null, clamps to realistic ranges
   */
  private normalize(raw: any, source: WeatherSource): SolarSample {
    const clamp = (value: number | null | undefined, min: number, max: number): number => {
      if (value === null || value === undefined || value < 0 || value === -999) {
        return 0; // Use 0 instead of null for display purposes
      }
      return Math.max(min, Math.min(max, value));
    };

    if (source === 'Solcast') {
      return {
        ts: raw.period_end,
        ghi_wm2: clamp(raw.ghi, this.REALISTIC_RANGES.ghi.min, this.REALISTIC_RANGES.ghi.max),
        dni_wm2: clamp(raw.dni, this.REALISTIC_RANGES.dni.min, this.REALISTIC_RANGES.dni.max),
        dhi_wm2: clamp(raw.dhi, this.REALISTIC_RANGES.dhi.min, this.REALISTIC_RANGES.dhi.max),
        air_temp_c: clamp(raw.air_temp || 25, this.REALISTIC_RANGES.temp.min, this.REALISTIC_RANGES.temp.max),
        wind_ms: clamp(raw.wind_speed_10m, this.REALISTIC_RANGES.wind.min, this.REALISTIC_RANGES.wind.max),
        source: 'Solcast',
      };
    } else if (source === 'NSRDB') {
      // NSRDB format
      const year = raw.Year || new Date().getFullYear();
      const month = (raw.Month || 1).toString().padStart(2, '0');
      const day = (raw.Day || 1).toString().padStart(2, '0');
      const hour = (raw.Hour || 0).toString().padStart(2, '0');
      const minute = (raw.Minute || 0).toString().padStart(2, '0');
      const ts = `${year}-${month}-${day}T${hour}:${minute}:00Z`;

      return {
        ts,
        ghi_wm2: clamp(raw.GHI, this.REALISTIC_RANGES.ghi.min, this.REALISTIC_RANGES.ghi.max),
        dni_wm2: clamp(raw.DNI, this.REALISTIC_RANGES.dni.min, this.REALISTIC_RANGES.dni.max),
        dhi_wm2: clamp(raw.DHI, this.REALISTIC_RANGES.dhi.min, this.REALISTIC_RANGES.dhi.max),
        air_temp_c: clamp(raw.Temperature, this.REALISTIC_RANGES.temp.min, this.REALISTIC_RANGES.temp.max),
        wind_ms: clamp(raw['Wind Speed'], this.REALISTIC_RANGES.wind.min, this.REALISTIC_RANGES.wind.max),
        source: 'NSRDB',
      };
    }

    // Default/Mock data
    return {
      ts: new Date().toISOString(),
      ghi_wm2: 0,
      dni_wm2: 0,
      dhi_wm2: 0,
      air_temp_c: 25,
      wind_ms: 2,
      source: 'Mock',
    };
  }

  /**
   * Validate solar sample for common issues
   */
  validate(sample: SolarSample, expectedPowerKw?: number): ValidationResult {
    const issues: string[] = [];
    let severity: 'ok' | 'warning' | 'critical' = 'ok';

    const sampleDate = new Date(sample.ts);
    const hour = sampleDate.getUTCHours();
    const isDaytime = hour >= 6 && hour <= 18;

    // Flag daytime GHI=0 as cover/fault
    if (isDaytime && sample.ghi_wm2 === 0) {
      issues.push('Daytime irradiance is zero - possible panel cover or sensor fault');
      severity = 'critical';
    }

    // Check for unrealistic GHI vs DNI+DHI relationship
    // GHI should approximately equal DNI*cos(zenith) + DHI
    const calculatedGHI = sample.dni_wm2 * 0.7 + sample.dhi_wm2; // Simplified
    const ghiDifference = Math.abs(sample.ghi_wm2 - calculatedGHI);
    if (ghiDifference > 200 && sample.ghi_wm2 > 100) {
      issues.push('GHI/DNI/DHI relationship inconsistent - sensor drift possible');
      severity = severity === 'critical' ? 'critical' : 'warning';
    }

    // Check if PV power is unexpectedly low
    if (expectedPowerKw && sample.ghi_wm2 > 800) {
      const expectedPowerAtHighIrradiance = expectedPowerKw * (sample.ghi_wm2 / 1000) * 0.75; // Assuming 75% PR
      const threshold = expectedPowerAtHighIrradiance * 0.2; // 20% of expected
      if (expectedPowerKw < threshold) {
        issues.push(`PV output (${expectedPowerKw.toFixed(1)}kW) is <20% of expected under high irradiance`);
        severity = 'critical';
      }
    }

    // Check for sensor errors based on temperature
    if (sample.air_temp_c < -20 || sample.air_temp_c > 60) {
      issues.push(`Air temperature (${sample.air_temp_c.toFixed(1)}°C) is outside typical range`);
      severity = severity === 'critical' ? 'critical' : 'warning';
    }

    return {
      isValid: issues.length === 0,
      issues,
      severity,
    };
  }

  /**
   * Fetch weather data from Solcast (primary) or NSRDB (fallback)
   */
  async fetchWeatherData(
    latitude: number,
    longitude: number,
    hoursBack: number = 24
  ): Promise<SolarSample[]> {
    const cacheKey = `${latitude},${longitude},${hoursBack}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log('✅ Returning cached weather data');
      return cached.data;
    }

    // Try Solcast first
    try {
      console.log('🔄 Fetching from Solcast API...');
      const samples = await this.fetchFromSolcast(latitude, longitude, hoursBack);
      this.cache.set(cacheKey, { data: samples, timestamp: Date.now() });
      return samples;
    } catch (error) {
      console.warn('⚠️ Solcast API failed, trying NSRDB...', error);
    }

    // Fallback to NSRDB
    try {
      console.log('🔄 Fetching from NSRDB API...');
      const samples = await this.fetchFromNSRDB(latitude, longitude, hoursBack);
      this.cache.set(cacheKey, { data: samples, timestamp: Date.now() });
      return samples;
    } catch (error) {
      console.warn('⚠️ NSRDB API failed, using mock data...', error);
    }

    // Final fallback: generate mock data
    return this.generateMockData(latitude, longitude, hoursBack);
  }

  /**
   * Fetch from Solcast estimated_actuals API
   */
  private async fetchFromSolcast(
    latitude: number,
    longitude: number,
    hoursBack: number
  ): Promise<SolarSample[]> {
    const apiKey = import.meta.env.VITE_SOLCAST_KEY;
    if (!apiKey || apiKey === 'DEMO_KEY') {
      throw new Error('Solcast API key not configured');
    }

    const url = `https://api.solcast.com.au/world_radiation/estimated_actuals?latitude=${latitude}&longitude=${longitude}&hours=${hoursBack}&format=json&api_key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Solcast API error: ${response.statusText}`);
    }

    const data: SolcastResponse = await response.json();
    return data.estimated_actuals.map(item => this.normalize(item, 'Solcast'));
  }

  /**
   * Fetch from NREL NSRDB PSM3 API
   */
  private async fetchFromNSRDB(
    latitude: number,
    longitude: number,
    hoursBack: number
  ): Promise<SolarSample[]> {
    const apiKey = import.meta.env.VITE_NSRDB_KEY;
    if (!apiKey || apiKey === 'DEMO_KEY') {
      throw new Error('NSRDB API key not configured');
    }

    // NSRDB requires year range
    const now = new Date();
    const year = now.getFullYear();

    const url = `https://developer.nrel.gov/api/nsrdb/v2/solar/psm3-download.csv?api_key=${apiKey}&wkt=POINT(${longitude}%20${latitude})&names=${year}&leap_day=false&interval=60&utc=false&email=user@example.com&attributes=ghi,dni,dhi,wind_speed,air_temperature`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NSRDB API error: ${response.statusText}`);
    }

    const csvText = await response.text();
    // Parse CSV (simplified - in production use a proper CSV parser)
    const lines = csvText.split('\n').slice(3); // Skip header rows
    const samples: SolarSample[] = [];

    for (const line of lines.slice(-hoursBack)) {
      const [year, month, day, hour, minute, ghi, dni, dhi, temp, wind] = line.split(',');
      if (!year) continue;

      const raw: NSRDBDataPoint = {
        Year: parseInt(year),
        Month: parseInt(month),
        Day: parseInt(day),
        Hour: parseInt(hour),
        Minute: parseInt(minute),
        GHI: parseFloat(ghi),
        DNI: parseFloat(dni),
        DHI: parseFloat(dhi),
        Temperature: parseFloat(temp),
        'Wind Speed': parseFloat(wind),
      };

      samples.push(this.normalize(raw, 'NSRDB'));
    }

    return samples;
  }

  /**
   * Generate mock data for demonstration
   */
  private generateMockData(latitude: number, longitude: number, hoursBack: number): SolarSample[] {
    const samples: SolarSample[] = [];
    const now = new Date();

    for (let i = hoursBack; i >= 0; i--) {
      const ts = new Date(now.getTime() - i * 3600000);
      const hour = ts.getHours();

      // Simulate solar curve (peaks at noon)
      const solarFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
      const cloudFactor = 0.7 + Math.random() * 0.3;

      samples.push({
        ts: ts.toISOString(),
        ghi_wm2: Math.round(1000 * solarFactor * cloudFactor),
        dni_wm2: Math.round(900 * solarFactor * cloudFactor),
        dhi_wm2: Math.round(100 * solarFactor),
        air_temp_c: Math.round((25 + solarFactor * 10 + Math.random() * 5) * 10) / 10,
        wind_ms: Math.round((2 + Math.random() * 3) * 10) / 10,
        source: 'Mock',
      });
    }

    return samples;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const weatherDataService = WeatherDataService.getInstance();
