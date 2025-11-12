import { SolarDataPoint } from "./openMeteo";

export interface BatteryMetric {
  timestamp: string;
  stateOfCharge: number;
  chargePowerKw: number;
  dischargePowerKw: number;
  temperatureC: number;
  voltage: number;
  current: number;
  status: "charging" | "discharging" | "idle";
}

export interface InverterMetric {
  timestamp: string;
  acOutputKw: number;
  dcInputKw: number;
  efficiencyPct: number;
  powerFactor: number;
  temperatureC: number;
  voltage: number;
  current: number;
  clippingPct: number;
}

export interface DeviceMetricsSummary {
  battery: {
    latestSoc: number;
    avgSoc: number;
    dailyThroughputKwh: number;
  };
  inverter: {
    peakEfficiencyPct: number;
    avgEfficiencyPct: number;
    totalEnergyKwh: number;
  };
}

export interface DeviceMetricsResult {
  batteryMetrics: BatteryMetric[];
  inverterMetrics: InverterMetric[];
  summary: DeviceMetricsSummary;
}

interface DeviceMetricsParams {
  systemCapacityKw: number;
  batteryCapacityKwh?: number;
  baseLoadKw?: number;
}

/**
 * Compute inverter and battery metrics from the Open-Meteo satellite feed
 * that we already use for the PV telemetry. This keeps the data grounded in
 * a real API while applying realistic battery and inverter behaviour models.
 */
export const deviceMetricsService = {
  generateFromSolarData(
    solarData: SolarDataPoint[],
    params: DeviceMetricsParams
  ): DeviceMetricsResult {
    const batteryCapacityKwh = params.batteryCapacityKwh ?? params.systemCapacityKw * 4;
    const baseLoadKw = params.baseLoadKw ?? params.systemCapacityKw * 0.45;

    let stateOfCharge = 62;
    const batteryMetrics: BatteryMetric[] = [];
    const inverterMetrics: InverterMetric[] = [];

    let batteryEnergyThroughput = 0;
    let totalEnergy = 0;
    let efficiencyAccumulator = 0;
    let efficiencyCount = 0;
    let peakEfficiency = 0;
    let socAccumulator = 0;

    solarData.forEach((point, idx) => {
      const loadKw = baseLoadKw * (0.85 + 0.25 * Math.sin((idx / 24) * Math.PI * 2));
      const productionKw = Math.max(point.ac_output, 0);
      const netKw = productionKw - loadKw;

      let chargePowerKw = 0;
      let dischargePowerKw = 0;
      let status: BatteryMetric["status"] = "idle";

      if (netKw > 0.2) {
        chargePowerKw = Math.min(netKw, params.systemCapacityKw * 0.8);
        const energyAdded = chargePowerKw;
        stateOfCharge = Math.min(100, stateOfCharge + (energyAdded / batteryCapacityKwh) * 100);
        batteryEnergyThroughput += energyAdded;
        status = "charging";
      } else if (netKw < -0.2) {
        dischargePowerKw = Math.min(-netKw, params.systemCapacityKw * 0.9);
        const energyRemoved = dischargePowerKw;
        stateOfCharge = Math.max(10, stateOfCharge - (energyRemoved / batteryCapacityKwh) * 100);
        batteryEnergyThroughput += energyRemoved;
        status = "discharging";
      }

      const batteryMetric: BatteryMetric = {
        timestamp: point.timestamp,
        stateOfCharge: Number(stateOfCharge.toFixed(1)),
        chargePowerKw: Number(chargePowerKw.toFixed(2)),
        dischargePowerKw: Number(dischargePowerKw.toFixed(2)),
        temperatureC: Number((point.cell_temp - 3).toFixed(1)),
        voltage: Number((720 + stateOfCharge * 1.5).toFixed(0)),
        current: Number(((chargePowerKw - dischargePowerKw) * 1000 / 720).toFixed(1)),
        status
      };

      batteryMetrics.push(batteryMetric);
      socAccumulator += stateOfCharge;

      const dcInputKw = Math.max(point.dc_output, productionKw * 1.04);
      const efficiencyPct = dcInputKw > 0 ? Math.min(100, (productionKw / dcInputKw) * 100) : 0;
      const powerFactor = productionKw > 0 ? 0.96 - 0.05 * Math.cos((idx / 24) * Math.PI * 2) : 0.92;
      const clippingPct = Math.max(0, ((productionKw - params.systemCapacityKw) / params.systemCapacityKw) * 100);

      const inverterMetric: InverterMetric = {
        timestamp: point.timestamp,
        acOutputKw: Number(productionKw.toFixed(2)),
        dcInputKw: Number(dcInputKw.toFixed(2)),
        efficiencyPct: Number(efficiencyPct.toFixed(1)),
        powerFactor: Number(powerFactor.toFixed(3)),
        temperatureC: Number((point.cell_temp + 5).toFixed(1)),
        voltage: Number((380 + productionKw * 2.8).toFixed(0)),
        current: Number(((productionKw * 1000) / 380).toFixed(1)),
        clippingPct: Number(Math.max(0, clippingPct).toFixed(1))
      };

      inverterMetrics.push(inverterMetric);

      if (efficiencyPct > 0) {
        efficiencyAccumulator += efficiencyPct;
        efficiencyCount += 1;
        peakEfficiency = Math.max(peakEfficiency, efficiencyPct);
      }

      totalEnergy += productionKw;
    });

    const summary: DeviceMetricsSummary = {
      battery: {
        latestSoc: Number(batteryMetrics[batteryMetrics.length - 1]?.stateOfCharge ?? 0),
        avgSoc: Number((socAccumulator / Math.max(batteryMetrics.length, 1)).toFixed(1)),
        dailyThroughputKwh: Number(batteryEnergyThroughput.toFixed(1))
      },
      inverter: {
        peakEfficiencyPct: Number(peakEfficiency.toFixed(1)),
        avgEfficiencyPct: Number((efficiencyAccumulator / Math.max(efficiencyCount, 1)).toFixed(1)),
        totalEnergyKwh: Number(totalEnergy.toFixed(1))
      }
    };

    return {
      batteryMetrics,
      inverterMetrics,
      summary
    };
  }
};
