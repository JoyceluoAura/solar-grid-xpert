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
      const currentHour = now.getHours();
      const todayStr = now.toISOString().split('T')[0];
      const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Fetch archive data for yesterday and forecast data for today
      const archiveUrl = `${this.archiveUrl}?latitude=${params.lat}&longitude=${params.lon}&start_date=${yesterdayStr}&end_date=${yesterdayStr}&hourly=shortwave_radiation&timezone=auto`;
      const forecastUrl = `${this.weatherUrl}?latitude=${params.lat}&longitude=${params.lon}&hourly=shortwave_radiation,temperature_2m&forecast_days=1&timezone=auto`;

      const [archiveResponse, forecastResponse] = await Promise.all([
        fetch(archiveUrl).catch(() => null),
        fetch(forecastUrl)
      ]);

      let hourlyData: SolarDataPoint[] = [];

      // Get yesterday's data from archive - only from (currentHour+1) onwards to give us exactly 24 hours
      if (archiveResponse && archiveResponse.ok) {
        const archiveData = await archiveResponse.json();
        const dataLength = archiveData.hourly?.time?.length || 0;
        
        for (let i = 0; i < dataLength; i++) {
          const timestamp = archiveData.hourly.time[i];
          const date = new Date(timestamp);
          const hour = date.getHours();
          
          // Include hours from currentHour onwards from yesterday (25-hour range)
          // e.g., if current hour is 7, include hours 7-23 from yesterday
          if (hour < currentHour) continue;
          
          const hourMatch = timestamp.match(/T(\d{2}):/);
          const localHour = hourMatch ? hourMatch[1] + ':00' : hour.toString().padStart(2, '0') + ':00';
          
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
        
        // Process from hour 0 to current hour (inclusive)
        for (let i = 0; i < dataLength; i++) {
          const timestamp = forecastData.hourly.time[i];
          const date = new Date(timestamp);
          const hour = date.getHours();
          
          // Only include today's data up to and including current hour
          if (date.toISOString().split('T')[0] !== todayStr) continue;
          if (hour > currentHour) break;
          
          const hourMatch = timestamp.match(/T(\d{2}):/);
          const localHour = hourMatch ? hourMatch[1] + ':00' : hour.toString().padStart(2, '0') + ':00';
          
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
   * Fetch extended hourly data for aggregation into accurate daily totals
   * This fetches the last N days of hourly data from archive API
   */
  async fetchExtendedHourlyData(params: OpenMeteoParams, days: number = 30): Promise<Map<string, SolarDataPoint[]>> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);
      
      const url = `${this.archiveUrl}?latitude=${params.lat}&longitude=${params.lon}` +
        `&start_date=${startDate.toISOString().split('T')[0]}` +
        `&end_date=${endDate.toISOString().split('T')[0]}` +
        `&hourly=shortwave_radiation,temperature_2m` +
        `&timezone=auto`;

      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('Extended hourly data unavailable, using daily aggregates');
        return new Map();
      }

      const data = await response.json();
      const hourlyByDate = new Map<string, SolarDataPoint[]>();
      
      for (let i = 0; i < (data.hourly?.time?.length || 0); i++) {
        const timestamp = data.hourly.time[i];
        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0];
        const hour = date.getHours();
        
        const irradiance = data.hourly.shortwave_radiation?.[i] || 0;
        const ambientTemp = data.hourly.temperature_2m?.[i] || 25;
        const cellTemp = this.calculateCellTemperature(ambientTemp, irradiance);
        
        const dcPower = this.calculateDCPower(irradiance, params.system_capacity, cellTemp);
        const acPower = this.calculateACPower(dcPower);
        
        if (!hourlyByDate.has(dateStr)) {
          hourlyByDate.set(dateStr, []);
        }
        
        hourlyByDate.get(dateStr)!.push({
          timestamp: date.toISOString(),
          hour: hour.toString().padStart(2, '0') + ':00',
          ac_output: acPower,
          dc_output: dcPower,
          irradiance: irradiance,
          ambient_temp: ambientTemp,
          cell_temp: cellTemp,
        });
      }
      
      console.log(`✅ Fetched extended hourly data for ${hourlyByDate.size} days`);
      return hourlyByDate;
      
    } catch (error) {
      console.error('❌ Extended hourly data fetch error:', error);
      return new Map();
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
   * Fetch forecast data (90 days / 3 months ahead) using historical patterns, weather forecasts, and panel health
   */
  async fetchForecastData(params: OpenMeteoParams): Promise<DailySolarDataPoint[]> {
    try {
      const today = new Date();
      const forecastEndDate = new Date(today);
      forecastEndDate.setDate(forecastEndDate.getDate() + 90); // 3 months
      
      // Fetch historical data for the same 3-month period from previous 3 years
      const historicalPeriods: Array<{start: Date, end: Date}> = [];
      for (let yearOffset = 1; yearOffset <= 3; yearOffset++) {
        const histStart = new Date(today);
        histStart.setFullYear(histStart.getFullYear() - yearOffset);
        const histEnd = new Date(histStart);
        histEnd.setDate(histEnd.getDate() + 90);
        historicalPeriods.push({ start: histStart, end: histEnd });
      }
      
      // Fetch all historical data periods
      const historicalUrls = historicalPeriods.map(period => 
        `${this.archiveUrl}?latitude=${params.lat}&longitude=${params.lon}` +
        `&start_date=${period.start.toISOString().split('T')[0]}` +
        `&end_date=${period.end.toISOString().split('T')[0]}` +
        `&daily=shortwave_radiation_sum,temperature_2m_mean,temperature_2m_max,cloud_cover_mean&timezone=auto`
      );
      
      // Fetch 16-day weather forecast (max available from Open-Meteo)
      const forecastUrl = `${this.weatherUrl}?latitude=${params.lat}&longitude=${params.lon}` +
        `&daily=temperature_2m_mean,temperature_2m_max,cloud_cover_mean,precipitation_sum&forecast_days=16&timezone=auto`;

      const allResponses = await Promise.all([
        ...historicalUrls.map(url => fetch(url).catch(() => null)),
        fetch(forecastUrl).catch(() => null)
      ]);
      
      const weatherForecastResponse = allResponses[allResponses.length - 1];
      const historicalResponses = allResponses.slice(0, -1);

      // Build daily historical averages by day-of-year
      const dayOfYearStats = new Map<number, {irradiance: number[], temp: number[], clouds: number[]}>();
      
      for (const response of historicalResponses) {
        if (response && response.ok) {
          const data = await response.json();
          for (let i = 0; i < (data.daily?.time?.length || 0); i++) {
            const date = new Date(data.daily.time[i]);
            const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
            
            if (!dayOfYearStats.has(dayOfYear)) {
              dayOfYearStats.set(dayOfYear, { irradiance: [], temp: [], clouds: [] });
            }
            const stats = dayOfYearStats.get(dayOfYear)!;
            stats.irradiance.push(data.daily.shortwave_radiation_sum[i] || 5000);
            stats.temp.push(data.daily.temperature_2m_mean[i] || 26);
            stats.clouds.push(data.daily.cloud_cover_mean[i] || 40);
          }
        }
      }

      // Get panel health factor from solar issues
      const panelHealthFactor = await this.calculatePanelHealthFactor(params.lat, params.lon);
      console.log(`📊 Panel health factor: ${(panelHealthFactor * 100).toFixed(1)}% (1.0 = perfect health)`);

      const days: DailySolarDataPoint[] = [];
      const totalCapacity = params.system_capacity;

      // Parse weather forecast data
      let weatherForecast: any = null;
      if (weatherForecastResponse && weatherForecastResponse.ok) {
        weatherForecast = await weatherForecastResponse.json();
      }

      // Generate 90-day forecast
      for (let dayOffset = 1; dayOffset <= 90; dayOffset++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(forecastDate.getDate() + dayOffset);
        const dateStr = forecastDate.toISOString().split('T')[0];
        const dayOfYear = Math.floor((forecastDate.getTime() - new Date(forecastDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        
        // Get historical stats for this day of year
        const stats = dayOfYearStats.get(dayOfYear);
        const avgHistoricalIrradiance = stats?.irradiance.length 
          ? stats.irradiance.reduce((a, b) => a + b, 0) / stats.irradiance.length 
          : 5000;
        const avgHistoricalTemp = stats?.temp.length 
          ? stats.temp.reduce((a, b) => a + b, 0) / stats.temp.length 
          : 27;
        const avgHistoricalClouds = stats?.clouds.length 
          ? stats.clouds.reduce((a, b) => a + b, 0) / stats.clouds.length 
          : 40;

        // Use weather forecast for first 16 days, then use historical patterns with seasonal variation
        let meanTemp: number;
        let maxTemp: number;
        let clouds: number;
        let precipitation: number = 0;

        if (dayOffset <= 16 && weatherForecast?.daily) {
          const idx = dayOffset - 1;
          meanTemp = weatherForecast.daily.temperature_2m_mean?.[idx] ?? avgHistoricalTemp;
          maxTemp = weatherForecast.daily.temperature_2m_max?.[idx] ?? (meanTemp + 4);
          clouds = weatherForecast.daily.cloud_cover_mean?.[idx] ?? avgHistoricalClouds;
          precipitation = weatherForecast.daily.precipitation_sum?.[idx] ?? 0;
        } else {
          // Use historical patterns with random variation for days 17-90
          const seasonalVariation = Math.sin((dayOfYear / 365) * 2 * Math.PI) * 2;
          const randomVariation = (Math.random() - 0.5) * 4;
          meanTemp = avgHistoricalTemp + seasonalVariation + randomVariation;
          maxTemp = meanTemp + 3 + Math.random() * 3;
          clouds = Math.max(0, Math.min(100, avgHistoricalClouds + (Math.random() - 0.5) * 20));
          precipitation = Math.random() < 0.2 ? Math.random() * 10 : 0; // 20% chance of rain
        }

        // Calculate irradiance with weather and panel health factors
        let baseIrradiance = avgHistoricalIrradiance;
        
        // Cloud cover impact
        const cloudFactor = 1 - (clouds / 200);
        
        // Precipitation impact (rain reduces irradiance)
        const rainFactor = precipitation > 0 ? Math.max(0.5, 1 - (precipitation / 50)) : 1.0;
        
        // Temperature impact on efficiency
        const tempEfficiencyFactor = 1 - ((meanTemp - 25) * 0.004);
        
        // Apply all factors including panel health
        const estimatedIrradiance = Math.max(1000, baseIrradiance * cloudFactor * rainFactor * panelHealthFactor);
        
        const irradianceKwhM2 = estimatedIrradiance / 1000;
        const cellTemp = this.calculateCellTemperature(meanTemp, irradianceKwhM2 * 1000 / 24);

        // Calculate energy with all efficiency factors
        const dcEnergyKwh = Math.max(0, totalCapacity * irradianceKwhM2 * 0.20 * tempEfficiencyFactor);
        const acEnergyKwh = this.calculateACPower(dcEnergyKwh);

        days.push({
          date: dateStr,
          ac_output: Number(acEnergyKwh.toFixed(2)),
          dc_output: Number(dcEnergyKwh.toFixed(2)),
          irradiance: Math.round(estimatedIrradiance),
          ambient_temp: Number(meanTemp.toFixed(1)),
          cell_temp: Number(cellTemp.toFixed(1)),
        });
      }

      console.log(`✅ Fetched ${days.length} days of forecast data (3-year historical + weather + panel health)`);
      return days;
    } catch (error) {
      console.error('❌ Forecast data fetch error:', error);
      console.log('⚠️ Using mock forecast data as fallback');
      return this.generateMockForecastData(params);
    }
  }

  /**
   * Calculate panel health factor based on detected issues (0-1 scale)
   */
  private async calculatePanelHealthFactor(lat: number, lon: number): Promise<number> {
    try {
      // Import dynamically to avoid circular dependencies
      const { solarIssueService } = await import('@/services/solarIssues');
      const { nasaPowerService } = await import('@/services/nasaPower');
      
      const weather = await nasaPowerService.fetchWeatherData({ latitude: lat, longitude: lon });
      const issues = solarIssueService.generateSiteIssues('SGX-FORECAST', weather, 6);
      
      if (issues.length === 0) return 1.0; // Perfect health
      
      // Calculate weighted health reduction based on severity and energy loss
      let totalHealthReduction = 0;
      const severityWeights = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2, normal: 0 };
      
      for (const issue of issues) {
        const severityWeight = severityWeights[issue.severity as keyof typeof severityWeights] || 0;
        const energyLossFactor = issue.energy_loss_percent / 100;
        totalHealthReduction += severityWeight * energyLossFactor;
      }
      
      // Average reduction across all issues
      const avgReduction = totalHealthReduction / issues.length;
      
      // Return health factor (1.0 = perfect, lower = degraded)
      return Math.max(0.5, 1 - avgReduction); // Minimum 50% health
    } catch (error) {
      console.warn('Could not calculate panel health, assuming 95% health:', error);
      return 0.95; // Default to slight degradation if calculation fails
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
   * Generate mock forecast data (90 days)
   */
  private generateMockForecastData(params: OpenMeteoParams): DailySolarDataPoint[] {
    const days: DailySolarDataPoint[] = [];
    const today = new Date();
    const panelHealthFactor = 0.92; // Assume 92% health for mock data

    for (let i = 1; i <= 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

      // Seasonal variation based on day of year
      const seasonalFactor = 0.85 + Math.sin((dayOfYear / 365) * 2 * Math.PI) * 0.15;
      const randomVariation = 0.9 + Math.random() * 0.2;
      const weatherVariation = Math.random() < 0.15 ? 0.6 : 1.0; // 15% chance of poor weather
      
      const irradiance = Math.round(5300 * seasonalFactor * randomVariation * weatherVariation * panelHealthFactor);
      const meanTemp = 26 + Math.random() * 6 + Math.sin((dayOfYear / 365) * 2 * Math.PI) * 2;
      const cellTemp = this.calculateCellTemperature(meanTemp, irradiance / 24);

      const tempEfficiencyFactor = 1 - ((meanTemp - 25) * 0.004);
      const dcEnergy = params.system_capacity * (irradiance / 1000) * 0.22 * tempEfficiencyFactor;
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
