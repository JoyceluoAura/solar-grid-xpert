/**
 * Open-Meteo Satellite Radiation API Integration Service
 *
 * Uses Open-Meteo's free Satellite Radiation API with Himawari satellite data
 * for accurate solar radiation data in Jakarta/Singapore region
 *
 * API Docs: https://open-meteo.com/en/docs/satellite-radiation-api
 * Coverage: 10-minute updates with 20-minute latency for Asia region
 * Data source: JMA JAXA Himawari-8/9 satellites
 */

interface OpenMeteoParams {
  system_capacity: number;  // kW - for power calculations
  lat: number;              // Latitude
  lon: number;              // Longitude
  tilt?: number;            // Tilt angle (degrees)
  azimuth?: number;         // Azimuth angle (degrees)
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  hourly: {
    time: string[];
    shortwave_radiation: number[];
    direct_radiation: number[];
    diffuse_radiation: number[];
    temperature_2m?: number[];
  };
}

export interface SolarDataPoint {
  timestamp: string;
  hour: string;
  ac_output: number;      // AC power output (kW)
  dc_output: number;      // DC power output (kW)
  irradiance: number;     // Global horizontal irradiance (W/m²)
  ambient_temp: number;   // Ambient temperature (°C)
  cell_temp: number;      // Cell temperature (°C)
}

interface CachedData {
  data: SolarDataPoint[];
  timestamp: number;
  params: OpenMeteoParams;
}

class OpenMeteoService {
  private static instance: OpenMeteoService;
  private cache: Map<string, CachedData> = new Map();
  private cacheDuration = 10000; // 10 seconds
  private baseUrl = 'https://satellite-api.open-meteo.com/v1/forecast';
  private weatherUrl = 'https://api.open-meteo.com/v1/forecast';

  private constructor() {}

  static getInstance(): OpenMeteoService {
    if (!OpenMeteoService.instance) {
      OpenMeteoService.instance = new OpenMeteoService();
    }
    return OpenMeteoService.instance;
  }

  /**
   * Get cache key from parameters
   */
  private getCacheKey(params: OpenMeteoParams): string {
    return `${params.lat}_${params.lon}_${params.system_capacity}_${params.tilt}_${params.azimuth}`;
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;

    const now = Date.now();
    return (now - cached.timestamp) < this.cacheDuration;
  }

  /**
   * Calculate cell temperature from ambient temperature and irradiance
   * Using NOCT (Nominal Operating Cell Temperature) formula
   */
  private calculateCellTemperature(ambientTemp: number, irradiance: number): number {
    const NOCT = 45; // Nominal Operating Cell Temperature (°C)
    const standardIrradiance = 800; // W/m²
    const standardTemp = 20; // °C

    // Cell temp = Ambient temp + (NOCT - 20) * (Irradiance / 800)
    const cellTemp = ambientTemp + ((NOCT - standardTemp) * (irradiance / standardIrradiance));
    return cellTemp;
  }

  /**
   * Calculate DC power output from irradiance
   * Accounting for temperature losses and system efficiency
   */
  private calculateDCPower(
    irradiance: number,
    systemCapacity: number,
    cellTemp: number
  ): number {
    const standardIrradiance = 1000; // W/m²
    const standardTemp = 25; // °C
    const tempCoefficient = -0.004; // Power loss per °C above 25°C

    // Temperature derating
    const tempDerate = 1 + (tempCoefficient * (cellTemp - standardTemp));

    // DC power = System capacity * (Irradiance / 1000) * Temperature derating
    const dcPower = systemCapacity * (irradiance / standardIrradiance) * tempDerate;

    return Math.max(0, dcPower);
  }

  /**
   * Calculate AC power output from DC power
   * Accounting for inverter efficiency
   */
  private calculateACPower(dcPower: number): number {
    const inverterEfficiency = 0.96; // 96% inverter efficiency
    return dcPower * inverterEfficiency;
  }

  /**
   * Fetch hourly solar data from Open-Meteo Satellite Radiation API
   */
  async fetchSolarData(params: OpenMeteoParams): Promise<SolarDataPoint[]> {
    const cacheKey = this.getCacheKey(params);

    // Return cached data if valid
    if (this.isCacheValid(cacheKey)) {
      console.log('✅ Returning cached Open-Meteo data');
      return this.cache.get(cacheKey)!.data;
    }

    try {
      console.log('🔄 Fetching fresh data from Open-Meteo Satellite API...');

      // Get current date and 24 hours ago
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setHours(startDate.getHours() - 24);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Fetch satellite radiation data
      const radiationUrl = `${this.baseUrl}?latitude=${params.lat}&longitude=${params.lon}&hourly=shortwave_radiation,direct_radiation,diffuse_radiation&forecast_days=1&past_days=1&timezone=auto`;

      // Fetch weather data (for temperature)
      const weatherUrl = `${this.weatherUrl}?latitude=${params.lat}&longitude=${params.lon}&hourly=temperature_2m&forecast_days=1&past_days=1&timezone=auto`;

      const [radiationResponse, weatherResponse] = await Promise.all([
        fetch(radiationUrl),
        fetch(weatherUrl)
      ]);

      if (!radiationResponse.ok) {
        throw new Error(`Open-Meteo Satellite API error: ${radiationResponse.statusText}`);
      }

      const radiationData: OpenMeteoResponse = await radiationResponse.json();
      const weatherData: OpenMeteoResponse = weatherResponse.ok
        ? await weatherResponse.json()
        : null;

      // Process hourly data (last 24 hours)
      const hourlyData: SolarDataPoint[] = [];
      const dataLength = radiationData.hourly.time.length;
      const startIndex = Math.max(0, dataLength - 24);

      for (let i = startIndex; i < dataLength; i++) {
        const timestamp = radiationData.hourly.time[i];
        const date = new Date(timestamp);

        // Extract hour from timestamp string (Open-Meteo returns local time with timezone=auto)
        // Format: "2025-01-12T14:00" - extract the hour part
        const hourMatch = timestamp.match(/T(\d{2}):/);
        const localHour = hourMatch ? hourMatch[1] + ':00' : date.getHours().toString().padStart(2, '0') + ':00';

        const irradiance = radiationData.hourly.shortwave_radiation[i] || 0;
        const ambientTemp = weatherData?.hourly.temperature_2m?.[i] || 25;
        const cellTemp = this.calculateCellTemperature(ambientTemp, irradiance);

        const dcPower = this.calculateDCPower(irradiance, params.system_capacity, cellTemp);
        const acPower = this.calculateACPower(dcPower);

        hourlyData.push({
          timestamp: date.toISOString(),
          hour: localHour,
          ac_output: acPower,
          dc_output: dcPower,
          irradiance: irradiance,
          ambient_temp: ambientTemp,
          cell_temp: cellTemp,
        });
      }

      // Cache the data
      this.cache.set(cacheKey, {
        data: hourlyData,
        timestamp: Date.now(),
        params,
      });

      console.log(`✅ Fetched ${hourlyData.length} hours of solar data from Open-Meteo (Himawari satellite)`);
      return hourlyData;

    } catch (error) {
      console.error('❌ Open-Meteo API error:', error);
      console.log('⚠️ Using mock data as fallback');
      return this.generateMockData(params);
    }
  }

  /**
   * Generate mock solar data for demo/fallback
   */
  private generateMockData(params: OpenMeteoParams): SolarDataPoint[] {
    const data: SolarDataPoint[] = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now);
      hourDate.setHours(now.getHours() - i);

      // Get Jakarta local hour (UTC+7)
      const utcHour = hourDate.getUTCHours();
      const jakartaHour = (utcHour + 7) % 24;

      // Simulate solar generation curve (peaks at noon local time)
      const solarFactor = Math.max(0, Math.sin(((jakartaHour - 6) / 12) * Math.PI));
      const baseCapacity = params.system_capacity;
      const randomVariation = 1 + (Math.random() - 0.5) * 0.15;

      // More realistic values for Jakarta
      const irradiance = Math.max(0, Math.round(1000 * solarFactor * randomVariation));
      const ambientTemp = Math.round((27 + (solarFactor * 6) + (Math.random() * 3)) * 10) / 10; // 27-36°C range
      const cellTemp = this.calculateCellTemperature(ambientTemp, irradiance);
      const dcPower = this.calculateDCPower(irradiance, baseCapacity, cellTemp);
      const acPower = this.calculateACPower(dcPower);

      data.push({
        timestamp: hourDate.toISOString(),
        hour: jakartaHour.toString().padStart(2, '0') + ':00',
        ac_output: acPower,
        dc_output: dcPower,
        irradiance: irradiance,
        ambient_temp: ambientTemp,
        cell_temp: cellTemp,
      });
    }

    return data;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Open-Meteo cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const openMeteoService = OpenMeteoService.getInstance();
export type { OpenMeteoParams };
