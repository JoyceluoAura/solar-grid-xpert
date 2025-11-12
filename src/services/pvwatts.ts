/**
 * PVWatts API Integration Service
 *
 * Uses NREL's PVWatts API to fetch live solar panel performance data
 * Implements caching and automatic refresh
 */

interface PVWattsParams {
  system_capacity: number;  // kW
  module_type?: number;     // 0=Standard, 1=Premium, 2=Thin film
  losses?: number;          // System losses (%)
  array_type?: number;      // 0=Fixed, 1=1-axis, 2=2-axis, 3=Backtracked
  tilt?: number;           // Tilt angle (degrees)
  azimuth?: number;        // Azimuth angle (degrees)
  lat: number;             // Latitude
  lon: number;             // Longitude
}

interface PVWattsResponse {
  outputs: {
    ac_monthly: number[];
    ac_annual: number;
    solrad_monthly: number[];
    solrad_annual: number;
    dc_monthly: number[];
    ac: number[];  // Hourly AC output
    dc: number[];  // Hourly DC output
    dn: number[];  // Hourly direct normal irradiance
    poa: number[]; // Hourly plane of array irradiance
    tamb: number[]; // Hourly ambient temperature
    tcell: number[]; // Hourly cell temperature
  };
  station_info: {
    city: string;
    state: string;
    lat: number;
    lon: number;
    elev: number;
    tz: number;
  };
}

interface SolarDataPoint {
  timestamp: string;
  hour: string;
  ac_output: number;      // AC power output (kW)
  dc_output: number;      // DC power output (kW)
  irradiance: number;     // Plane of array irradiance (W/m²)
  ambient_temp: number;   // Ambient temperature (°C)
  cell_temp: number;      // Cell temperature (°C)
}

interface CachedData {
  data: SolarDataPoint[];
  timestamp: number;
  params: PVWattsParams;
}

class PVWattsService {
  private static instance: PVWattsService;
  private cache: Map<string, CachedData> = new Map();
  private cacheDuration = 10000; // 10 seconds
  private apiKey: string;
  private baseUrl = 'https://developer.nrel.gov/api/pvwatts/v8.json';

  private constructor() {
    // In production, use environment variable
    this.apiKey = import.meta.env.VITE_PVWATTS_API_KEY || 'DEMO_KEY';
  }

  static getInstance(): PVWattsService {
    if (!PVWattsService.instance) {
      PVWattsService.instance = new PVWattsService();
    }
    return PVWattsService.instance;
  }

  /**
   * Get cache key from parameters
   */
  private getCacheKey(params: PVWattsParams): string {
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
   * Fetch hourly solar data from PVWatts API
   */
  async fetchSolarData(params: PVWattsParams): Promise<SolarDataPoint[]> {
    const cacheKey = this.getCacheKey(params);

    // Return cached data if valid
    if (this.isCacheValid(cacheKey)) {
      console.log('✅ Returning cached PVWatts data');
      return this.cache.get(cacheKey)!.data;
    }

    try {
      console.log('🔄 Fetching fresh data from PVWatts API...');

      // Set default parameters
      const queryParams = {
        api_key: this.apiKey,
        system_capacity: params.system_capacity,
        module_type: params.module_type || 0,
        losses: params.losses || 14,
        array_type: params.array_type || 0,
        tilt: params.tilt || 20,
        azimuth: params.azimuth || 180,
        lat: params.lat,
        lon: params.lon,
        timeframe: 'hourly',
      };

      const url = `${this.baseUrl}?${new URLSearchParams(queryParams as any).toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`PVWatts API error: ${response.statusText}`);
      }

      const data: PVWattsResponse = await response.json();

      // Process hourly data (use last 24 hours for live view)
      const now = new Date();
      const hourlyData: SolarDataPoint[] = [];

      // Get last 24 hours of data
      const startIndex = Math.max(0, data.outputs.ac.length - 24);

      for (let i = startIndex; i < data.outputs.ac.length; i++) {
        const hourDate = new Date(now);
        hourDate.setHours(now.getHours() - (data.outputs.ac.length - i - 1));

        hourlyData.push({
          timestamp: hourDate.toISOString(),
          hour: hourDate.getHours().toString().padStart(2, '0') + ':00',
          ac_output: data.outputs.ac[i] / 1000 || 0, // Convert W to kW
          dc_output: data.outputs.dc[i] / 1000 || 0,
          irradiance: data.outputs.poa[i] || 0,
          ambient_temp: data.outputs.tamb[i] || 0,
          cell_temp: data.outputs.tcell[i] || 0,
        });
      }

      // Cache the data
      this.cache.set(cacheKey, {
        data: hourlyData,
        timestamp: Date.now(),
        params,
      });

      console.log(`✅ Fetched ${hourlyData.length} hours of solar data`);
      return hourlyData;

    } catch (error) {
      console.error('❌ PVWatts API error:', error);

      // Return mock data as fallback
      console.log('⚠️ Using mock data as fallback');
      return this.generateMockData();
    }
  }

  /**
   * Generate mock solar data for demo/fallback
   */
  private generateMockData(): SolarDataPoint[] {
    const data: SolarDataPoint[] = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now);
      hourDate.setHours(now.getHours() - i);
      const hour = hourDate.getHours();

      // Simulate solar generation curve (peaks at noon)
      const solarFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
      const baseOutput = 50; // 50 kW base capacity
      const randomVariation = 1 + (Math.random() - 0.5) * 0.2;

      data.push({
        timestamp: hourDate.toISOString(),
        hour: hour.toString().padStart(2, '0') + ':00',
        ac_output: baseOutput * solarFactor * randomVariation,
        dc_output: (baseOutput * solarFactor * randomVariation) / 0.96,
        irradiance: 1000 * solarFactor * randomVariation,
        ambient_temp: 25 + (Math.random() * 10),
        cell_temp: 35 + (solarFactor * 20) + (Math.random() * 5),
      });
    }

    return data;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ PVWatts cache cleared');
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
export const pvWattsService = PVWattsService.getInstance();
export type { PVWattsParams, SolarDataPoint };
