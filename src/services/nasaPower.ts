/**
 * NASA POWER API Integration Service
 *
 * Uses NASA's POWER (Prediction Of Worldwide Energy Resources) API
 * to fetch real-time and historical solar irradiance, temperature, and weather data
 *
 * API Docs: https://power.larc.nasa.gov/docs/services/api/
 */

interface WeatherParams {
  latitude: number;
  longitude: number;
  date?: string; // YYYYMMDD format
}

interface SolarWeatherData {
  irradiance: number;      // W/m² - Global Horizontal Irradiance
  temperature: number;     // °C - Air Temperature at 2 Meters
  humidity: number;        // % - Relative Humidity
  wind_speed: number;      // m/s - Wind Speed at 10 Meters
  cloud_cover: number;     // % - Cloud Amount
  pressure: number;        // kPa - Surface Pressure
  timestamp: string;       // ISO timestamp
}

interface CachedWeatherData {
  data: SolarWeatherData;
  timestamp: number;
  params: WeatherParams;
}

class NASAPowerService {
  private static instance: NASAPowerService;
  private cache: Map<string, CachedWeatherData> = new Map();
  private cacheDuration = 300000; // 5 minutes (NASA data updates hourly)
  private baseUrl = 'https://power.larc.nasa.gov/api/temporal/hourly/point';

  private constructor() {}

  static getInstance(): NASAPowerService {
    if (!NASAPowerService.instance) {
      NASAPowerService.instance = new NASAPowerService();
    }
    return NASAPowerService.instance;
  }

  /**
   * Get cache key from parameters
   */
  private getCacheKey(params: WeatherParams): string {
    return `${params.latitude.toFixed(2)}_${params.longitude.toFixed(2)}`;
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
   * Fetch current solar and weather data from NASA POWER API
   */
  async fetchWeatherData(params: WeatherParams): Promise<SolarWeatherData> {
    const cacheKey = this.getCacheKey(params);

    // Return cached data if valid
    if (this.isCacheValid(cacheKey)) {
      console.log('✅ Returning cached NASA POWER data');
      return this.cache.get(cacheKey)!.data;
    }

    try {
      console.log('🔄 Fetching fresh data from NASA POWER API...');

      // Get current date if not provided
      const date = params.date || new Date().toISOString().split('T')[0].replace(/-/g, '');

      // Parameters for NASA POWER API
      const parameters = [
        'ALLSKY_SFC_SW_DWN',  // Solar Irradiance (W/m²)
        'T2M',                 // Temperature at 2 Meters (°C)
        'RH2M',                // Relative Humidity (%)
        'WS10M',               // Wind Speed at 10 Meters (m/s)
        'CLOUD_AMT',           // Cloud Amount (%)
        'PS'                   // Surface Pressure (kPa)
      ].join(',');

      const url = `${this.baseUrl}?parameters=${parameters}&community=RE&longitude=${params.longitude}&latitude=${params.latitude}&start=${date}&end=${date}&format=JSON`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`NASA POWER API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract latest hour data
      const properties = data.properties.parameter;
      const latestHour = this.getLatestHourKey(properties.ALLSKY_SFC_SW_DWN);

      const weatherData: SolarWeatherData = {
        irradiance: properties.ALLSKY_SFC_SW_DWN[latestHour] || 0,
        temperature: properties.T2M[latestHour] || 25,
        humidity: properties.RH2M[latestHour] || 50,
        wind_speed: properties.WS10M[latestHour] || 2,
        cloud_cover: properties.CLOUD_AMT[latestHour] || 20,
        pressure: properties.PS[latestHour] || 101.3,
        timestamp: new Date().toISOString(),
      };

      // Cache the data
      this.cache.set(cacheKey, {
        data: weatherData,
        timestamp: Date.now(),
        params,
      });

      console.log(`✅ Fetched NASA POWER data - Irradiance: ${weatherData.irradiance} W/m², Temp: ${weatherData.temperature}°C`);
      return weatherData;

    } catch (error) {
      console.error('❌ NASA POWER API error:', error);
      console.log('⚠️ Using mock weather data as fallback');
      return this.generateMockWeatherData();
    }
  }

  /**
   * Get the latest hour key from the data object
   */
  private getLatestHourKey(dataObj: any): string {
    const keys = Object.keys(dataObj);
    return keys[keys.length - 1];
  }

  /**
   * Generate mock weather data for demo/fallback
   */
  private generateMockWeatherData(): SolarWeatherData {
    const hour = new Date().getHours();

    // Simulate solar generation curve (peaks at noon)
    const solarFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));

    return {
      irradiance: Math.round(1000 * solarFactor + Math.random() * 50),
      temperature: Math.round(25 + (solarFactor * 10) + (Math.random() * 5)),
      humidity: Math.round(40 + (Math.random() * 30)),
      wind_speed: Math.round((2 + Math.random() * 3) * 10) / 10,
      cloud_cover: Math.round((1 - solarFactor) * 50 + (Math.random() * 20)),
      pressure: Math.round((101 + Math.random() * 2) * 10) / 10,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ NASA POWER cache cleared');
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
export const nasaPowerService = NASAPowerService.getInstance();
export type { WeatherParams, SolarWeatherData };
