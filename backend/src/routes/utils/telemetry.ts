import { Request } from 'express';

type TelemetryPoint = {
  ts: string;
  ghi_wm2: number;
  air_temp_c: number;
  wind_ms: number;
  ac_kw: number;
};

type TelemetryParams = {
  latitude: number;
  longitude: number;
  systemCapacityKw: number;
  hours: number;
};

const archiveUrl = 'https://archive-api.open-meteo.com/v1/archive';

const calculateCellTemperature = (ambientTemp: number, irradiance: number) => {
  const NOCT = 45;
  const standardIrradiance = 800;
  const standardTemp = 20;
  return ambientTemp + ((NOCT - standardTemp) * (irradiance / standardIrradiance));
};

const calculateDCPower = (irradiance: number, systemCapacity: number, cellTemp: number) => {
  const standardIrradiance = 1000;
  const standardTemp = 25;
  const tempCoefficient = -0.004;
  const tempDerate = 1 + (tempCoefficient * (cellTemp - standardTemp));
  const dcPower = systemCapacity * (irradiance / standardIrradiance) * tempDerate;
  return Math.max(0, dcPower);
};

const calculateACPower = (dcPower: number) => dcPower * 0.96;

export const parseSiteParams = (req: Request) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const capacity = parseFloat(req.query.capacity_kw as string);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Missing or invalid site coordinates');
  }

  return {
    latitude: lat,
    longitude: lon,
    systemCapacityKw: Number.isFinite(capacity) ? capacity : 100,
  };
};

export const fetchSiteTelemetry = async ({ latitude, longitude, systemCapacityKw, hours }: TelemetryParams): Promise<TelemetryPoint[]> => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

  const url = `${archiveUrl}?latitude=${latitude}&longitude=${longitude}` +
    `&start_date=${startDate.toISOString().split('T')[0]}` +
    `&end_date=${endDate.toISOString().split('T')[0]}` +
    `&hourly=shortwave_radiation,direct_radiation,temperature_2m,wind_speed_10m` +
    `&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo archive request failed: ${response.statusText}`);
  }

  const data = await response.json();
  const telemetry: TelemetryPoint[] = [];
  const time = data.hourly?.time || [];
  const shortwave: number[] = data.hourly?.shortwave_radiation || [];
  const temp: number[] = data.hourly?.temperature_2m || [];
  const wind: number[] = data.hourly?.wind_speed_10m || [];

  for (let i = Math.max(0, time.length - hours); i < time.length; i++) {
    const timestamp = time[i];
    const irradiance = Math.max(0, shortwave[i] ?? 0);
    const ambient = temp[i] ?? 26;
    const windSpeed = wind[i] ?? 2;
    const cellTemp = calculateCellTemperature(ambient, irradiance);
    const dcPower = calculateDCPower(irradiance, systemCapacityKw, cellTemp);
    const acPower = calculateACPower(dcPower);

    telemetry.push({
      ts: new Date(timestamp).toISOString(),
      ghi_wm2: Math.round(irradiance),
      air_temp_c: Math.round((ambient + Number.EPSILON) * 10) / 10,
      wind_ms: Math.round((windSpeed + Number.EPSILON) * 10) / 10,
      ac_kw: Math.round((acPower + Number.EPSILON) * 100) / 100,
    });
  }

  if (!telemetry.length) {
    throw new Error('No telemetry data returned from Open-Meteo');
  }

  return telemetry;
};

export const generateMockTelemetry = (systemCapacityKw: number, days: number = 90): TelemetryPoint[] => {
  const data: TelemetryPoint[] = [];
  const now = new Date();

  for (let i = days * 24; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour = ts.getHours();
    const solarFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const ghi = 1000 * solarFactor * (0.9 + Math.random() * 0.2);
    const acKw = systemCapacityKw * 0.9 * solarFactor * (0.8 + Math.random() * 0.3);

    data.push({
      ts: ts.toISOString(),
      ghi_wm2: Math.max(0, ghi),
      air_temp_c: 26 + solarFactor * 7 + (Math.random() - 0.5) * 3,
      wind_ms: 1.5 + Math.random() * 2,
      ac_kw: Math.max(0, acKw),
    });
  }

  return data;
};

export type { TelemetryPoint };
