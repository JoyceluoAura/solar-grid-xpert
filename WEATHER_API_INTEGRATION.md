# Weather API Integration Guide

This document explains the weather data integration for SolarGridX, including API setup and data normalization.

## Overview

The platform uses multiple weather data sources with automatic fallback:
1. **Solcast** (Primary) - Real-time solar radiation actuals
2. **NSRDB** (Fallback) - Historical solar radiation database
3. **Mock Data** (Demo) - Generated data when APIs unavailable

## API Sources

### 1. Solcast API (Primary)

**Endpoint**: `https://api.solcast.com.au/world_radiation/estimated_actuals`

**Features**:
- Real-time and historical solar radiation data
- Global coverage with high accuracy
- Free tier: 50 API calls/day
- Data updated every 5-15 minutes

**Sign up**: https://solcast.com/
**Documentation**: https://docs.solcast.com.au/

**Environment Variable**:
```bash
VITE_SOLCAST_KEY=your_api_key_here
```

### 2. NREL NSRDB API (Fallback)

**Endpoint**: `https://developer.nrel.gov/api/nsrdb/v2/solar/psm3-download.csv`

**Features**:
- Historical solar radiation data (1998-2020)
- US government database
- Free with API key
- Hourly resolution

**Sign up**: https://developer.nrel.gov/signup/
**Documentation**: https://nsrdb.nrel.gov/

**Environment Variable**:
```bash
VITE_NSRDB_KEY=your_api_key_here
```

## Data Normalization

All weather data is normalized through the `weatherDataService` to ensure data quality:

### Normalization Rules

1. **Negative Values**: Converted to 0 (prevents sensor error displays)
2. **Null/-999 Values**: Converted to 0
3. **Range Clamping**:
   - GHI (Global Horizontal Irradiance): 0-1400 W/m²
   - DNI (Direct Normal Irradiance): 0-1100 W/m²
   - DHI (Diffuse Horizontal Irradiance): 0-800 W/m²
   - Air Temperature: -40°C to 85°C
   - Wind Speed: 0-80 m/s

### Validation Rules

The service includes automatic validation:

1. **Daytime Zero Irradiance**: Flags GHI=0 during daylight (6am-6pm) as critical
2. **GHI/DNI/DHI Consistency**: Checks physical relationship between components
3. **Low Power Output**: Flags <20% expected power under high irradiance
4. **Temperature Range**: Warns if outside typical -20°C to 60°C range

## Data Structure

```typescript
interface SolarSample {
  ts: string;           // ISO timestamp
  ghi_wm2: number;     // Global Horizontal Irradiance (W/m²)
  dni_wm2: number;     // Direct Normal Irradiance (W/m²)
  dhi_wm2: number;     // Diffuse Horizontal Irradiance (W/m²)
  air_temp_c: number;  // Air temperature (°C)
  wind_ms?: number;    // Wind speed (m/s)
  source: 'Solcast' | 'NSRDB' | 'Mock';
}
```

## Usage Example

```typescript
import { weatherDataService } from '@/services/weatherData';

// Fetch weather data for Jakarta
const samples = await weatherDataService.fetchWeatherData(
  -6.2088,  // latitude
  106.8456, // longitude
  24        // hours back
);

// Validate a sample
const validation = weatherDataService.validate(samples[0], 100); // 100 kW expected power
if (!validation.isValid) {
  console.log('Issues:', validation.issues);
  console.log('Severity:', validation.severity);
}
```

## Integration Points

### 1. Visual Data Tab
- Uses normalized weather data for sensor readings
- Displays GHI, air temperature, and wind speed on panel cards
- Shows validation warnings for suspicious readings

### 2. Metrics Data Tab
- Uses Open-Meteo Satellite API for hourly solar data
- Falls back to mock data if API unavailable
- Displays irradiance and temperature charts

### 3. AI Analysis Tab
- Integrates weather context for issue detection
- Uses validation results to flag sensor errors
- Provides actionable recommendations

## Troubleshooting

### No API Keys Configured
If both `VITE_SOLCAST_KEY` and `VITE_NSRDB_KEY` are set to `DEMO_KEY`, the system will use mock data. This is normal for development/demo environments.

### API Rate Limits
- **Solcast**: 50 calls/day (free tier)
- **NSRDB**: No strict limit but recommended <1000/day

The service implements 5-minute caching to minimize API calls.

### Negative Values Still Appearing
If you see negative values:
1. Check if the weather service is being used (check console logs)
2. Verify API keys are properly configured
3. Check if data is coming from mock source

## References

- [Solcast API Documentation](https://docs.solcast.com.au/)
- [NREL NSRDB Documentation](https://nsrdb.nrel.gov/)
- [PVGIS Documentation](https://joint-research-centre.ec.europa.eu/pvgis-en) (alternative source)
- [Open-Meteo Solar API](https://open-meteo.com/en/docs/solar) (currently used for Metrics Data)
