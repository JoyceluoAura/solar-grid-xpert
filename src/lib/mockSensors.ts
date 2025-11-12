export interface MockSensor {
  id: string;
  sensor_name: string;
  sensor_type: "temperature" | "inverter" | "battery" | "camera" | string;
  protocol: string;
  status: "online" | "offline" | "error" | string;
  device_id: string;
  endpoint_url?: string;
  description?: string;
}

export const getFallbackSensors = (): MockSensor[] => [
  {
    id: "fallback-temp-001",
    sensor_name: "Array Surface Temp",
    sensor_type: "temperature",
    protocol: "mqtt",
    status: "online",
    device_id: "TEMP_A1",
    description: "Monitors module temperature across the rooftop array",
  },
  {
    id: "fallback-inv-001",
    sensor_name: "String Inverter North",
    sensor_type: "inverter",
    protocol: "modbus",
    status: "online",
    device_id: "INV_NORTH_01",
    description: "Tracks DC to AC conversion efficiency for the north inverter",
  },
  {
    id: "fallback-batt-001",
    sensor_name: "Battery Rack East",
    sensor_type: "battery",
    protocol: "mqtt",
    status: "online",
    device_id: "BATT_EAST_01",
    description: "Supervises charge/discharge cycles on the storage rack",
  },
  {
    id: "fallback-cam-001",
    sensor_name: "Carport Visual Feed",
    sensor_type: "camera",
    protocol: "rtsp",
    status: "online",
    device_id: "CAM_CARPORT_01",
    description: "High-resolution overview of the carport strings",
    endpoint_url: "rtsp://demo.solar-grid.local/carport",
  },
  {
    id: "fallback-cam-002",
    sensor_name: "Rooftop Thermal Feed",
    sensor_type: "camera",
    protocol: "rtsp",
    status: "online",
    device_id: "CAM_ROOF_02",
    description: "Thermal view detecting hotspots on the rooftop modules",
    endpoint_url: "rtsp://demo.solar-grid.local/rooftop",
  },
];
