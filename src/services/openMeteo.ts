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

export interface DailySolarDataPoint {
  date: string;
  ac_output: number;      // Daily AC energy (kWh)
  dc_output: number;      // Daily DC energy (kWh)
  irradiance: number;     // Daily irradiance sum (Wh/m²)
  ambient_temp: number;   // Mean ambient temperature (°C)
  cell_temp: number;      // Estimated mean cell temperature (°C)
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
  private archiveUrl = 'https://archive-api.open-meteo.com/v1/archive';

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
   * Fetch hourly solar data from Open-Meteo APIs
   * Uses archive API for historical data when satellite API is unavailable
   */
  async fetchSolarData(params: OpenMeteoParams): Promise<SolarDataPoint[]> {
    const cacheKey = this.getCacheKey(params);

    // Return cached data if valid
    if (this.isCacheValid(cacheKey)) {
      console.log('✅ Returning cached Open-Meteo data');
      return this.cache.get(cacheKey)!.data;
    }

    try {
      console.log('🔄 Fetching fresh data from Open-Meteo APIs...');

      const now = new Date();
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setHours(startDate.getHours() - 23); // Last 24 hours including current

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const currentHour = now.getHours();

      // Always try to fetch both archive (yesterday's complete data) and forecast (today's data including current hour)
      const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Fetch archive data for yesterday and forecast data for today (includes current hour)
      const archiveUrl = `${this.archiveUrl}?latitude=${params.lat}&longitude=${params.lon}&start_date=${yesterdayStr}&end_date=${yesterdayStr}&hourly=shortwave_radiation&timezone=auto`;
      const forecastUrl = `${this.weatherUrl}?latitude=${params.lat}&longitude=${params.lon}&hourly=shortwave_radiation,temperature_2m&forecast_days=1&timezone=auto`;

      const [archiveResponse, forecastResponse] = await Promise.all([
        fetch(archiveUrl).catch(() => null),
        fetch(forecastUrl)
      ]);

      let hourlyData: SolarDataPoint[] = [];

      // Get yesterday's data from archive
      if (archiveResponse && archiveResponse.ok) {
        const archiveData = await archiveResponse.json();
        const dataLength = archiveData.hourly?.time?.length || 0;
        
        for (let i = 0; i < dataLength; i++) {
          const timestamp = archiveData.hourly.time[i];
          const date = new Date(timestamp);
          const hourMatch = timestamp.match(/T(\d{2}):/);
          const localHour = hourMatch ? hourMatch[1] + ':00' : date.getHours().toString().padStart(2, '0') + ':00';
          
          const irradiance = archiveData.hourly.shortwave_radiation?.[i] || 0;
          const ambientTemp = 25; // Default temp
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
      }

      // Get today's data including current hour from forecast API
      if (forecastResponse.ok) {
        const forecastData: OpenMeteoResponse = await forecastResponse.json();
        const dataLength = forecastData.hourly?.time?.length || 0;
        
        // Only process up to current hour for today
        for (let i = 0; i <= currentHour && i < dataLength; i++) {
          const timestamp = forecastData.hourly.time[i];
          const date = new Date(timestamp);
          
          // Only include today's data
          if (date.toISOString().split('T')[0] !== endDateStr) continue;
          
          const hourMatch = timestamp.match(/T(\d{2}):/);
          const localHour = hourMatch ? hourMatch[1] + ':00' : date.getHours().toString().padStart(2, '0') + ':00';
          
          const irradiance = forecastData.hourly.shortwave_radiation?.[i] || 0;
          const ambientTemp = forecastData.hourly.temperature_2m?.[i] || 25;
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
      }

      // Keep only last 24 hours
      hourlyData = hourlyData.slice(-24);
      
      console.log(`✅ Fetched ${hourlyData.length} hours (${hourlyData.length > 0 ? hourlyData[0].hour : '?'} to ${hourlyData.length > 0 ? hourlyData[hourlyData.length - 1].hour : '?'})`);

      // Cache the data
      this.cache.set(cacheKey, {
        data: hourlyData,
        timestamp: Date.now(),
        params,
      });

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

  /**
   * Fetch daily aggregated solar data for extended historical analysis
   */
  async fetchHistoricalDailyData(
    params: OpenMeteoParams,
    startDate: string,
    endDate: string
  ): Promise<DailySolarDataPoint[]> {
    try {
      // Fixed API call - removed invalid parameter 'direct_radiation_sum'
      const url = `${this.archiveUrl}?latitude=${params.lat}&longitude=${params.lon}` +
        `&start_date=${startDate}&end_date=${endDate}` +
        `&daily=shortwave_radiation_sum,temperature_2m_mean,temperature_2m_max` +
        `&timezone=auto`;

      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`Archive API error: ${response.statusText}, using mock historical data`);
        return this.generateMockHistoricalData(params, startDate, endDate);
      }

      const data = await response.json();

      const days: DailySolarDataPoint[] = [];
      const shortwave: number[] = data.daily?.shortwave_radiation_sum || [];
      const tempMean: number[] = data.daily?.temperature_2m_mean || [];
      const tempMax: number[] = data.daily?.temperature_2m_max || [];

      const totalCapacity = params.system_capacity;

      for (let i = 0; i < (data.daily?.time?.length || 0); i++) {
        const date = data.daily.time[i];
        const irradianceWh = shortwave[i] ?? 0;
        const meanTemp = tempMean[i] ?? 26;
        const maxTemp = tempMax[i] ?? (meanTemp + 4);

        const irradianceKwhM2 = irradianceWh / 1000;

        const cellTemp = this.calculateCellTemperature(meanTemp, irradianceKwhM2 * 1000 / 24);

        const dcEnergyKwh = Math.max(0, totalCapacity * irradianceKwhM2 * 0.24);
        const acEnergyKwh = this.calculateACPower(dcEnergyKwh);

        days.push({
          date,
          ac_output: Number(acEnergyKwh.toFixed(2)),
          dc_output: Number(dcEnergyKwh.toFixed(2)),
          irradiance: Math.round(irradianceWh),
          ambient_temp: Number(meanTemp.toFixed(1)),
          cell_temp: Number(((cellTemp + maxTemp) / 2).toFixed(1)),
        });
      }

      console.log(`✅ Fetched ${days.length} days of historical data`);
      return days;
    } catch (error) {
      console.error('❌ Historical data fetch error:', error);
      console.log('⚠️ Using mock historical data as fallback');
      return this.generateMockHistoricalData(params, startDate, endDate);
    }
  }

  /**
   * Fetch forecast data (7 days ahead) using historical patterns
   */
  async fetchForecastData(params: OpenMeteoParams): Promise<DailySolarDataPoint[]> {
    try {
      // Get historical data for the same week from previous years to establish patterns
      const today = new Date();
      const lastYear = new Date(today);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      
      const twoYearsAgo = new Date(today);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      // Fetch historical radiation data to establish baseline patterns
      const historicalUrl = `${this.archiveUrl}?latitude=${params.lat}&longitude=${params.lon}` +
        `&start_date=${twoYearsAgo.toISOString().split('T')[0]}` +
        `&end_date=${lastYear.toISOString().split('T')[0]}` +
        `&daily=shortwave_radiation_sum,temperature_2m_mean&timezone=auto`;
      
      // Fetch weather forecast
      const forecastUrl = `${this.weatherUrl}?latitude=${params.lat}&longitude=${params.lon}` +
        `&daily=temperature_2m_mean,temperature_2m_max,cloud_cover_mean&forecast_days=7&timezone=auto`;

      const [historicalResponse, forecastResponse] = await Promise.all([
        fetch(historicalUrl).catch(() => null),
        fetch(forecastUrl)
      ]);

      if (!forecastResponse.ok) {
        console.warn(`Forecast API error: ${forecastResponse.statusText}, using mock forecast`);
        return this.generateMockForecastData(params);
      }

      const forecastData = await forecastResponse.json();
      
      // Calculate historical average irradiance by month
      const monthlyAvgIrradiance = new Map<number, number>();
      if (historicalResponse && historicalResponse.ok) {
        const historicalData = await historicalResponse.json();
        const monthGroups = new Map<number, number[]>();
        
        for (let i = 0; i < (historicalData.daily?.time?.length || 0); i++) {
          const date = new Date(historicalData.daily.time[i]);
          const month = date.getMonth();
          const irradiance = historicalData.daily.shortwave_radiation_sum[i];
          
          if (!monthGroups.has(month)) {
            monthGroups.set(month, []);
          }
          monthGroups.get(month)!.push(irradiance);
        }
        
        // Calculate averages
        monthGroups.forEach((values, month) => {
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
          monthlyAvgIrradiance.set(month, avg);
        });
      }

      const days: DailySolarDataPoint[] = [];
      const tempMean: number[] = forecastData.daily?.temperature_2m_mean || [];
      const tempMax: number[] = forecastData.daily?.temperature_2m_max || [];
      const cloudCover: number[] = forecastData.daily?.cloud_cover_mean || [];

      const totalCapacity = params.system_capacity;

      for (let i = 0; i < (forecastData.daily?.time?.length || 0); i++) {
        const date = forecastData.daily.time[i];
        const forecastDate = new Date(date);
        const month = forecastDate.getMonth();
        const meanTemp = tempMean[i] ?? 26;
        const maxTemp = tempMax[i] ?? (meanTemp + 4);
        const clouds = cloudCover[i] ?? 40; // Default 40% cloud cover

        // Use historical average for this month, or fall back to temperature-based estimate
        let baseIrradiance = monthlyAvgIrradiance.get(month) || (5000 + (meanTemp - 20) * 100);
        
        // Adjust for cloud cover (more clouds = less irradiance)
        const cloudFactor = 1 - (clouds / 200); // 0% clouds = 1.0, 100% clouds = 0.5
        const estimatedIrradiance = Math.max(1000, baseIrradiance * cloudFactor);
        
        const irradianceKwhM2 = estimatedIrradiance / 1000;

        const cellTemp = this.calculateCellTemperature(meanTemp, irradianceKwhM2 * 1000 / 24);

        // Use more conservative efficiency for forecasts
        const dcEnergyKwh = Math.max(0, totalCapacity * irradianceKwhM2 * 0.20);
        const acEnergyKwh = this.calculateACPower(dcEnergyKwh);

        days.push({
          date,
          ac_output: Number(acEnergyKwh.toFixed(2)),
          dc_output: Number(dcEnergyKwh.toFixed(2)),
          irradiance: Math.round(estimatedIrradiance),
          ambient_temp: Number(meanTemp.toFixed(1)),
          cell_temp: Number(((cellTemp + maxTemp) / 2).toFixed(1)),
        });
      }

      console.log(`✅ Fetched ${days.length} days of forecast data (based on historical patterns)`);
      return days;
    } catch (error) {
      console.error('❌ Forecast data fetch error:', error);
      console.log('⚠️ Using mock forecast data as fallback');
      return this.generateMockForecastData(params);
    }
  }

  /**
   * Generate mock historical data
   */
  private generateMockHistoricalData(
    params: OpenMeteoParams,
    startDate: string,
    endDate: string
  ): DailySolarDataPoint[] {
    const days: DailySolarDataPoint[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= dayCount; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const randomVariation = 0.85 + Math.random() * 0.3;
      const irradiance = Math.round(5500 * randomVariation);
      const meanTemp = 27 + Math.random() * 5;
      const cellTemp = this.calculateCellTemperature(meanTemp, irradiance / 24);

      const dcEnergy = params.system_capacity * (irradiance / 1000) * 0.24;
      const acEnergy = this.calculateACPower(dcEnergy);

      days.push({
        date: dateStr,
        ac_output: Number(acEnergy.toFixed(2)),
        dc_output: Number(dcEnergy.toFixed(2)),
        irradiance: irradiance,
        ambient_temp: Number(meanTemp.toFixed(1)),
        cell_temp: Number(cellTemp.toFixed(1)),
      });
    }

    return days;
  }

  /**
   * Generate mock forecast data
   */
  private generateMockForecastData(params: OpenMeteoParams): DailySolarDataPoint[] {
    const days: DailySolarDataPoint[] = [];
    const today = new Date();

    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const randomVariation = 0.9 + Math.random() * 0.2;
      const irradiance = Math.round(5300 * randomVariation);
      const meanTemp = 26 + Math.random() * 6;
      const cellTemp = this.calculateCellTemperature(meanTemp, irradiance / 24);

      const dcEnergy = params.system_capacity * (irradiance / 1000) * 0.22;
      const acEnergy = this.calculateACPower(dcEnergy);

      days.push({
        date: dateStr,
        ac_output: Number(acEnergy.toFixed(2)),
        dc_output: Number(dcEnergy.toFixed(2)),
        irradiance: irradiance,
        ambient_temp: Number(meanTemp.toFixed(1)),
        cell_temp: Number(cellTemp.toFixed(1)),
      });
    }

    return days;
  }
}

// Export singleton instance
export const openMeteoService = OpenMeteoService.getInstance();
export type { OpenMeteoParams };
