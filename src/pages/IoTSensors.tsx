import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Wifi,
  Plus,
  AlertCircle,
  Activity,
  Thermometer,
  Zap,
  Battery,
  Camera,
  Video,
  Clock,
  Sun,
  RefreshCw,
  TrendingUp,
  Cloud,
  Wind,
  Droplets,
  AlertTriangle,
  Wrench,
  Eye,
  Calendar,
  Filter,
  Moon,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { openMeteoService, SolarDataPoint, DailySolarDataPoint } from "@/services/openMeteo";
import { nasaPowerService, SolarWeatherData } from "@/services/nasaPower";
import { solarIssueService, SolarIssue } from "@/services/solarIssues";
import { weatherDataService, SolarSample } from "@/services/weatherData";
import { deviceMetricsService, BatteryMetric, InverterMetric, DeviceMetricsSummary } from "@/services/deviceMetrics";

const PANEL_CONFIGURATIONS = [
  {
    id: "rooftop_a",
    label: "Rooftop Array A",
    capacityKw: 42,
    orientationFactor: 1,
    temperatureBias: 0,
    color: "#f97316",
  },
  {
    id: "rooftop_b",
    label: "Rooftop Array B",
    capacityKw: 35,
    orientationFactor: 0.94,
    temperatureBias: 1.5,
    color: "#3b82f6",
  },
  {
    id: "carport",
    label: "Carport Array",
    capacityKw: 23,
    orientationFactor: 0.88,
    temperatureBias: -1.2,
    color: "#10b981",
  },
] as const;

const TOTAL_PANEL_CAPACITY = PANEL_CONFIGURATIONS.reduce((sum, config) => sum + config.capacityKw, 0);

interface DisplayDataPoint {
  label: string;
  ac_output: number;
  dc_output: number;
  irradiance: number;
  ambient_temp: number;
  cell_temp: number;
  configOutputs: Record<string, number>;
  configIrradiance: Record<string, number>;
  configTemps: Record<string, number>;
}

interface DisplaySensor {
  id: string;
  sensor_name: string;
  sensor_type: string;
  protocol: string;
  device_id: string;
  status: 'online' | 'offline' | 'error';
  last_value?: string;
  last_updated?: string;
}

const formatRelativeTime = (iso?: string) => {
  if (!iso) return 'Updated just now';
  const updated = new Date(iso);
  if (Number.isNaN(updated.getTime())) return 'Updated just now';
  const diffMs = Date.now() - updated.getTime();
  if (diffMs < 0) return 'Updated just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Updated seconds ago';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
};

const IoTSensors = () => {
  const { user } = useAuth();
  const [sensors, setSensors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    sensor_name: "",
    sensor_type: "temperature",
    protocol: "mqtt",
    device_id: "",
    endpoint_url: "",
  });

  // PVWatts live data state
  const [solarData, setSolarData] = useState<SolarDataPoint[]>([]);
  const [pvDataLoading, setPvDataLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [batteryMetrics, setBatteryMetrics] = useState<BatteryMetric[]>([]);
  const [inverterMetrics, setInverterMetrics] = useState<InverterMetric[]>([]);
  const [deviceSummary, setDeviceSummary] = useState<DeviceMetricsSummary | null>(null);
  const [historicalSolarData, setHistoricalSolarData] = useState<DailySolarDataPoint[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(true);

  // Site parameters for PVWatts (can be made configurable later)
  const [siteParams, setSiteParams] = useState({
    lat: -6.2088,    // Jakarta, Indonesia
    lon: 106.8456,
    system_capacity: 100, // 100 kW
    tilt: 10,
    azimuth: 180,
  });

  // Solar issues and weather data
  const [solarIssues, setSolarIssues] = useState<SolarIssue[]>([]);
  const [weatherData, setWeatherData] = useState<SolarWeatherData | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [visualLastUpdated, setVisualLastUpdated] = useState<Date>(new Date());

  // Filters for Metrics Data
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dayNightFilter, setDayNightFilter] = useState<'all' | 'day' | 'night'>('all');
  const [viewMode, setViewMode] = useState<'hourly' | 'weekly' | 'monthly' | 'yearly'>('hourly');

  // Fetch sensors data
  useEffect(() => {
    fetchSensors();
  }, [user]);

  // Fetch solar data on mount
  useEffect(() => {
    fetchSolarData();
  }, []);

  useEffect(() => {
    fetchHistoricalSolarData();
  }, []);

  // Fetch weather and issues data on mount
  useEffect(() => {
    fetchWeatherAndIssues();
  }, []);

  // Auto-refresh solar data every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchSolarData();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, siteParams]);

  // Auto-refresh visual monitoring every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchWeatherAndIssues();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, siteParams]);

  // Fetch live solar data from Open-Meteo
  const fetchSolarData = async () => {
    try {
      setPvDataLoading(true);
      const data = await openMeteoService.fetchSolarData(siteParams);
      setSolarData(data);
      const deviceData = deviceMetricsService.generateFromSolarData(data, {
        systemCapacityKw: siteParams.system_capacity,
        batteryCapacityKwh: siteParams.system_capacity * 4.2,
      });
      setBatteryMetrics(deviceData.batteryMetrics);
      setInverterMetrics(deviceData.inverterMetrics);
      setDeviceSummary(deviceData.summary);
      setLastUpdated(new Date());
      console.log(`✅ Updated solar data: ${data.length} hours`);
    } catch (error) {
      console.error('Error fetching Open-Meteo data:', error);
      toast.error('Failed to fetch solar data');
    } finally {
      setPvDataLoading(false);
    }
  };

  const fetchHistoricalSolarData = async () => {
    try {
      setHistoricalLoading(true);
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setFullYear(startDate.getFullYear() - 2);

      const historical = await openMeteoService.fetchHistoricalDailyData(
        siteParams,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      setHistoricalSolarData(historical);
      console.log(`📈 Loaded ${historical.length} days of historical solar data`);
    } catch (error) {
      console.error('Error fetching historical solar data:', error);
      toast.error('Failed to load historical solar data');
    } finally {
      setHistoricalLoading(false);
    }
  };

  // Fetch weather data and generate solar issues
  const fetchWeatherAndIssues = async () => {
    try {
      setIssuesLoading(true);

      // Fetch normalized weather data from Solcast/NSRDB (prevents negative values)
      const weatherSamples = await weatherDataService.fetchWeatherData(
        siteParams.lat,
        siteParams.lon,
        1 // Just get the latest hour
      );

      // Convert normalized data to format expected by solarIssueService
      const latestSample = weatherSamples[weatherSamples.length - 1];
      const weather: SolarWeatherData = {
        irradiance: latestSample.ghi_wm2, // Normalized 0-1400 W/m²
        temperature: latestSample.air_temp_c, // Normalized -40 to 85°C
        humidity: 65, // Default value
        wind_speed: latestSample.wind_ms || 2, // Normalized 0-80 m/s
        cloud_cover: latestSample.ghi_wm2 < 800 ? 30 : 10, // Estimate from irradiance
        pressure: 101.3, // Standard pressure
        timestamp: latestSample.ts,
      };
      setWeatherData(weather);

      // Generate solar issues based on weather context
      const issues = solarIssueService.generateSiteIssues('SGX-IND-001', weather, 6);
      setSolarIssues(issues);

      setVisualLastUpdated(new Date());
      console.log(`✅ Updated ${issues.length} solar issues (source: ${latestSample.source})`);
    } catch (error) {
      console.error('Error fetching weather and issues:', error);
    } finally {
      setIssuesLoading(false);
    }
  };

  const fetchSensors = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("sensors")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSensors(data || []);
    } catch (error: any) {
      toast.error("Failed to load sensors");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const combinedSensors = useMemo<DisplaySensor[]>(() => {
    const virtualSensors: DisplaySensor[] = [];
    const latestSolar = solarData[solarData.length - 1];
    const latestBattery = batteryMetrics[batteryMetrics.length - 1];
    const latestInverter = inverterMetrics[inverterMetrics.length - 1];

    if (latestSolar) {
      virtualSensors.push(
        {
          id: 'virtual-irradiance',
          sensor_name: 'Rooftop Irradiance Sensor',
          sensor_type: 'irradiance',
          protocol: 'modbus',
          device_id: 'IRR-001',
          status: 'online',
          last_value: `${latestSolar.irradiance.toFixed(0)} W/m²`,
          last_updated: latestSolar.timestamp,
        },
        {
          id: 'virtual-ambient',
          sensor_name: 'Ambient Temperature Probe',
          sensor_type: 'temperature',
          protocol: 'modbus',
          device_id: 'TMP-OUT-01',
          status: 'online',
          last_value: `${latestSolar.ambient_temp.toFixed(1)} °C`,
          last_updated: latestSolar.timestamp,
        },
      );
    }

    if (latestBattery) {
      virtualSensors.push({
        id: 'virtual-battery',
        sensor_name: 'Battery Storage Controller',
        sensor_type: 'battery',
        protocol: 'modbus',
        device_id: 'BAT-HV-01',
        status: 'online',
        last_value: `${latestBattery.stateOfCharge.toFixed(0)}% SOC • ${latestBattery.status.toUpperCase()}`,
        last_updated: latestBattery.timestamp,
      });
    }

    if (latestInverter) {
      virtualSensors.push({
        id: 'virtual-inverter',
        sensor_name: 'Central Inverter Monitor',
        sensor_type: 'inverter',
        protocol: 'modbus',
        device_id: 'INV-MAIN-01',
        status: 'online',
        last_value: `${latestInverter.acOutputKw.toFixed(1)} kW • ${latestInverter.efficiencyPct.toFixed(1)}% eff`,
        last_updated: latestInverter.timestamp,
      });
    }

    if (solarIssues.length > 0) {
      const criticalIssues = solarIssues.filter((issue) => issue.severity === 'critical' || issue.severity === 'high');
      virtualSensors.push({
        id: 'virtual-camera',
        sensor_name: 'Array Visual Camera',
        sensor_type: 'camera',
        protocol: 'rtsp',
        device_id: criticalIssues[0]?.panel_id ?? 'CAM-ROOF-01',
        status: 'online',
        last_value:
          criticalIssues.length > 0
            ? `${criticalIssues.length} urgent alerts`
            : `${solarIssues.length} visual records`,
        last_updated: visualLastUpdated.toISOString(),
      });
    }

    return [
      ...virtualSensors,
      ...sensors.map((sensor, index) => {
        const normalizedType = sensor.sensor_type === 'thermal' ? 'temperature' : sensor.sensor_type;
        const assumedLive = Date.now() - lastUpdated.getTime() < 5 * 60 * 1000;
        const status: DisplaySensor['status'] = sensor.status === 'offline' && assumedLive
          ? 'online'
          : (sensor.status as DisplaySensor['status']) || 'online';

        return {
          id: sensor.id ?? `db-sensor-${index}`,
          sensor_name: sensor.sensor_name || `Sensor ${index + 1}`,
          sensor_type: normalizedType,
          protocol: sensor.protocol || 'mqtt',
          device_id: sensor.device_id || `SENSOR-${index + 1}`,
          status,
          last_value: sensor.last_value,
          last_updated: sensor.updated_at || sensor.created_at || lastUpdated.toISOString(),
        };
      }),
    ];
  }, [
    sensors,
    solarData,
    batteryMetrics,
    inverterMetrics,
    solarIssues,
    lastUpdated,
    visualLastUpdated,
  ]);

  const handleAddSensor = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.from("sensors").insert([{
        user_id: user.id,
        ...formData,
      }] as any);

      if (error) throw error;

      toast.success("Sensor added successfully!");
      setOpen(false);
      setFormData({
        sensor_name: "",
        sensor_type: "temperature",
        protocol: "mqtt",
        device_id: "",
        endpoint_url: "",
      });
      fetchSensors();
    } catch (error: any) {
      toast.error("Failed to add sensor");
      console.error(error);
    }
  };

  const getSensorIcon = (type: string) => {
    switch (type) {
      case "temperature":
        return Thermometer;
      case "irradiance":
        return Sun;
      case "inverter":
      case "voltage":
        return Zap;
      case "battery":
        return Battery;
      case "camera":
        return Camera;
      default:
        return Activity;
    }
  };

  const getSensorGradient = (type: string) => {
    switch (type) {
      case "battery":
        return "gradient-eco";
      case "inverter":
        return "gradient-energy";
      case "camera":
        return "gradient-night";
      case "irradiance":
        return "gradient-solar";
      case "temperature":
        return "gradient-solar";
      default:
        return "gradient-energy";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "text-eco-green";
      case "offline":
        return "text-muted-foreground";
      case "error":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  // Filter solar data based on date and day/night
  const displayData = useMemo<DisplayDataPoint[]>(() => {
    const buildPoint = (
      label: string,
      acValue: number,
      dcValue: number,
      irradianceValue: number,
      ambient: number,
      cell: number
    ): DisplayDataPoint => {
      const configOutputs: Record<string, number> = {};
      const configIrradiance: Record<string, number> = {};
      const configTemps: Record<string, number> = {};

      PANEL_CONFIGURATIONS.forEach((config) => {
        const share = config.capacityKw / TOTAL_PANEL_CAPACITY;
        const adjustedOutput = acValue * share * config.orientationFactor;
        configOutputs[config.id] = Number(adjustedOutput.toFixed(2));
        configIrradiance[config.id] = Number((irradianceValue * config.orientationFactor).toFixed(1));
        configTemps[config.id] = Number((cell + config.temperatureBias).toFixed(1));
      });

      return {
        label,
        ac_output: Number(acValue.toFixed(2)),
        dc_output: Number(dcValue.toFixed(2)),
        irradiance: Number(irradianceValue.toFixed(1)),
        ambient_temp: Number(ambient.toFixed(1)),
        cell_temp: Number(cell.toFixed(1)),
        configOutputs,
        configIrradiance,
        configTemps,
      };
    };

    if (viewMode === 'hourly') {
      let filtered = solarData;
      if (selectedDate) {
        filtered = filtered.filter((point) => point.timestamp.startsWith(selectedDate));
      }
      if (!filtered.length) {
        filtered = solarData;
      }
      if (dayNightFilter !== 'all') {
        filtered = filtered.filter((dataPoint) => {
          const hour = parseInt(dataPoint.hour.split(':')[0]);
          const isDaytime = hour >= 6 && hour < 18;
          return dayNightFilter === 'day' ? isDaytime : !isDaytime;
        });
      }

      return filtered.map((point) =>
        buildPoint(
          point.hour,
          point.ac_output,
          point.dc_output,
          point.irradiance,
          point.ambient_temp,
          point.cell_temp
        )
      );
    }

    if (!historicalSolarData.length) {
      return [];
    }

    const orderedHistorical = [...historicalSolarData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (viewMode === 'weekly') {
      const last7 = orderedHistorical.slice(-7);
      return last7.map((day) =>
        buildPoint(
          new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          day.ac_output / 24,
          day.dc_output / 24,
          day.irradiance / 24,
          day.ambient_temp,
          day.cell_temp
        )
      );
    }

    if (viewMode === 'monthly') {
      const last30 = orderedHistorical.slice(-30);
      return last30.map((day) =>
        buildPoint(
          new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          day.ac_output / 24,
          day.dc_output / 24,
          day.irradiance / 24,
          day.ambient_temp,
          day.cell_temp
        )
      );
    }

    // Yearly view - aggregate by month for the last 12 months
    const monthlyBuckets = new Map<string, {
      ac: number;
      dc: number;
      irr: number;
      ambient: number;
      cell: number;
      count: number;
    }>();

    orderedHistorical.forEach((day) => {
      const monthKey = day.date.slice(0, 7); // YYYY-MM
      if (!monthlyBuckets.has(monthKey)) {
        monthlyBuckets.set(monthKey, { ac: 0, dc: 0, irr: 0, ambient: 0, cell: 0, count: 0 });
      }
      const bucket = monthlyBuckets.get(monthKey)!;
      bucket.ac += day.ac_output;
      bucket.dc += day.dc_output;
      bucket.irr += day.irradiance;
      bucket.ambient += day.ambient_temp;
      bucket.cell += day.cell_temp;
      bucket.count += 1;
    });

    const monthlyPoints = Array.from(monthlyBuckets.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-12);

    return monthlyPoints.map(([monthKey, bucket]) =>
      buildPoint(
        new Date(`${monthKey}-01`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        (bucket.ac / bucket.count) / 24,
        (bucket.dc / bucket.count) / 24,
        (bucket.irr / bucket.count) / 24,
        bucket.ambient / bucket.count,
        bucket.cell / bucket.count
      )
    );
  }, [solarData, historicalSolarData, viewMode, dayNightFilter, selectedDate]);

  const chartUnits = useMemo(() => ({
    powerLabel: viewMode === 'hourly' ? 'Power (kW)' : 'Avg Power (kW)',
    irradianceLabel: viewMode === 'hourly' ? 'Irradiance (W/m²)' : 'Avg Irradiance (W/m²)',
    tooltipPowerSuffix: viewMode === 'hourly' ? ' kW' : ' kW avg',
    tooltipIrrSuffix: viewMode === 'hourly' ? ' W/m²' : ' W/m² avg',
  }), [viewMode]);

  const viewMeta = useMemo(() => {
    if (viewMode === 'hourly') {
      return {
        windowLabel: '24-hour live view',
        totalSourcePoints: solarData.length,
        pointDescriptor: 'hourly samples',
      };
    }

    if (viewMode === 'weekly') {
      return {
        windowLabel: '7-day daily averages',
        totalSourcePoints: Math.min(7, historicalSolarData.length),
        pointDescriptor: 'days',
      };
    }

    if (viewMode === 'monthly') {
      return {
        windowLabel: '30-day daily averages',
        totalSourcePoints: Math.min(30, historicalSolarData.length),
        pointDescriptor: 'days',
      };
    }

    const monthsAvailable = Math.max(1, Math.floor(historicalSolarData.length / 30));
    return {
      windowLabel: '12-month rolling averages',
      totalSourcePoints: Math.min(12, monthsAvailable),
      pointDescriptor: 'months',
    };
  }, [viewMode, solarData.length, historicalSolarData.length]);

  const aggregateStats = useMemo(() => {
    if (!displayData.length) {
      return null;
    }

    const latest = displayData[displayData.length - 1];
    const peakPower = Math.max(...displayData.map((d) => d.ac_output));
    const avgPower = displayData.reduce((sum, d) => sum + d.ac_output, 0) / displayData.length;
    const energyMultiplier = viewMode === 'hourly' ? 1 : 24;
    const totalEnergyKwh = displayData.reduce((sum, d) => sum + d.ac_output * energyMultiplier, 0);

    return {
      latestPower: latest.ac_output,
      peakPower,
      avgPower,
      totalEnergyKwh,
    };
  }, [displayData, viewMode]);

  const irradianceStats = useMemo(() => {
    if (!displayData.length) {
      return null;
    }

    const latest = displayData[displayData.length - 1];
    const peakIrradiance = Math.max(...displayData.map((d) => d.irradiance));

    return {
      latest: latest.irradiance,
      peak: peakIrradiance,
    };
  }, [displayData]);

  const temperatureStats = useMemo(() => {
    if (!displayData.length) {
      return null;
    }

    const latest = displayData[displayData.length - 1];
    const avgTemp = displayData.reduce((sum, d) => sum + d.cell_temp, 0) / displayData.length;

    return {
      latestCell: latest.cell_temp,
      avgCell: avgTemp,
    };
  }, [displayData]);

  const batteryChartData = useMemo(() =>
    batteryMetrics.slice(-24).map((metric) => ({
      label: new Date(metric.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      stateOfCharge: metric.stateOfCharge,
      netPower: Number((metric.chargePowerKw - metric.dischargePowerKw).toFixed(2)),
      temperatureC: metric.temperatureC,
    })),
    [batteryMetrics]
  );

  const inverterChartData = useMemo(() =>
    inverterMetrics.slice(-24).map((metric) => ({
      label: new Date(metric.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      efficiencyPct: metric.efficiencyPct,
      acOutputKw: metric.acOutputKw,
      clippingPct: metric.clippingPct,
    })),
    [inverterMetrics]
  );

  const latestBatteryMetric = batteryMetrics[batteryMetrics.length - 1];
  const latestInverterMetric = inverterMetrics[inverterMetrics.length - 1];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
              IoT Sensors
            </h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-energy text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Sensor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Sensor</DialogTitle>
                <DialogDescription>Configure a new IoT device for monitoring</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sensor_name">Sensor Name</Label>
                  <Input
                    id="sensor_name"
                    placeholder="e.g., Roof Panel Temperature"
                    value={formData.sensor_name}
                    onChange={(e) => setFormData({ ...formData, sensor_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sensor_type">Sensor Type</Label>
                  <Select
                    value={formData.sensor_type}
                    onValueChange={(value) => setFormData({ ...formData, sensor_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="temperature">Temperature</SelectItem>
                      <SelectItem value="inverter">Inverter</SelectItem>
                      <SelectItem value="voltage">Voltage</SelectItem>
                      <SelectItem value="irradiance">Irradiance</SelectItem>
                      <SelectItem value="environmental">Environmental</SelectItem>
                      <SelectItem value="battery">Battery</SelectItem>
                      <SelectItem value="ev_charger">EV Charger</SelectItem>
                      <SelectItem value="camera">Camera</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="protocol">Protocol</Label>
                  <Select
                    value={formData.protocol}
                    onValueChange={(value) => setFormData({ ...formData, protocol: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mqtt">MQTT</SelectItem>
                      <SelectItem value="modbus">Modbus</SelectItem>
                      <SelectItem value="http_api">HTTP API</SelectItem>
                      <SelectItem value="websocket">WebSocket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="device_id">Device ID</Label>
                  <Input
                    id="device_id"
                    placeholder="e.g., SENSOR_001"
                    value={formData.device_id}
                    onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpoint_url">Endpoint URL (Optional)</Label>
                  <Input
                    id="endpoint_url"
                    placeholder="e.g., mqtt://broker.example.com"
                    value={formData.endpoint_url}
                    onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                  />
                </div>

                <Button onClick={handleAddSensor} className="w-full gradient-energy text-white">
                  Add Sensor
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Connected Sensors */}
        {combinedSensors.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-solar-orange" />
                Connected Sensors ({combinedSensors.length})
              </CardTitle>
              <CardDescription>IoT devices monitoring your solar installation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {combinedSensors.map((sensor) => {
                  const normalizedType = sensor.sensor_type === 'thermal' ? 'temperature' : sensor.sensor_type;
                  const Icon = getSensorIcon(normalizedType);
                  const statusColor = getStatusColor(sensor.status);
                  const gradientClass = getSensorGradient(normalizedType);
                  return (
                    <div
                      key={sensor.id}
                      className="p-4 rounded-xl border border-border hover:border-primary hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${gradientClass} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-foreground truncate">{sensor.sensor_name}</h3>
                            <span className={`text-xs font-medium ${statusColor} capitalize`}>
                              {sensor.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground capitalize mb-2">
                            {normalizedType.replace('_', ' ')}
                          </p>
                          {sensor.last_value && (
                            <p className="text-sm font-semibold text-foreground mb-2 line-clamp-2">
                              {sensor.last_value}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                            {sensor.status === 'online' && (
                              <span className="flex items-center gap-1 text-emerald-600">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Live
                              </span>
                            )}
                            <span>{formatRelativeTime(sensor.last_updated)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{sensor.protocol.toUpperCase()}</span>
                            <span>•</span>
                            <span className="truncate">{sensor.device_id}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Data vs Visual */}
        <Tabs defaultValue="data" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="data">
              <Activity className="w-4 h-4 mr-2" />
              Metrics Data
            </TabsTrigger>
            <TabsTrigger value="visual">
              <Video className="w-4 h-4 mr-2" />
              Visual Data
            </TabsTrigger>
          </TabsList>

          {/* Data Sensors Tab */}
          <TabsContent value="data" className="space-y-6">
            {/* Live Solar Data Header */}
            <Card className="shadow-card border-blue-200 bg-gradient-to-r from-blue-50 to-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start space-x-3">
                    <Sun className="h-6 w-6 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Live Solar Data - Singapore/Jakarta Region</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Himawari satellite data • Auto-refreshes every 10 seconds • Last updated: {lastUpdated.toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Location: Jakarta, Indonesia ({siteParams.lat.toFixed(4)}°, {siteParams.lon.toFixed(4)}°) •
                        System: {siteParams.system_capacity} kW • {solarData.length} hours of data
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium">Auto-refresh</label>
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="w-4 h-4"
                      />
                    </div>
                    <Button
                      onClick={fetchSolarData}
                      disabled={pvDataLoading}
                      size="sm"
                      className="bg-gradient-to-r from-orange-500 to-blue-500 text-white"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${pvDataLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Filters */}
            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-40 h-9"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex rounded-md border">
                      <Button
                        variant={dayNightFilter === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDayNightFilter('all')}
                        className="rounded-r-none"
                      >
                        All
                      </Button>
                      <Button
                        variant={dayNightFilter === 'day' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDayNightFilter('day')}
                        className="rounded-none border-x"
                      >
                        <Sun className="w-4 h-4 mr-1" />
                        Day
                      </Button>
                      <Button
                        variant={dayNightFilter === 'night' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDayNightFilter('night')}
                        className="rounded-l-none"
                      >
                        <Moon className="w-4 h-4 mr-1" />
                        Night
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs font-medium mr-2">View:</span>
                    <div className="flex rounded-md border">
                      <Button
                        variant={viewMode === 'hourly' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('hourly')}
                        className="rounded-r-none text-xs px-3"
                      >
                        Hourly
                      </Button>
                      <Button
                        variant={viewMode === 'weekly' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('weekly')}
                        className="rounded-none border-x text-xs px-3"
                      >
                        Weekly
                      </Button>
                      <Button
                        variant={viewMode === 'monthly' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('monthly')}
                        className="rounded-none text-xs px-3"
                      >
                        Monthly
                      </Button>
                      <Button
                        variant={viewMode === 'yearly' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('yearly')}
                        className="rounded-l-none text-xs px-3"
                      >
                        Yearly
                      </Button>
                    </div>
                  </div>

                  <div className="w-full text-xs text-muted-foreground">
                    Showing {displayData.length} {viewMeta.pointDescriptor} • {viewMeta.windowLabel}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Battery and Inverter Metrics */}
            {batteryChartData.length > 0 && inverterChartData.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-card border-emerald-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Battery className="w-5 h-5 text-emerald-500" />
                      Battery Storage Sensors
                    </CardTitle>
                    <CardDescription>
                      Live state-of-charge modelling derived from Open-Meteo irradiance and site load assumptions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={batteryChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
                          style={{ fontSize: '11px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          yAxisId="soc"
                          domain={[0, 100]}
                          label={{ value: 'State of Charge (%)', angle: -90, position: 'insideLeft', style: { fontSize: '11px' } }}
                          style={{ fontSize: '11px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          yAxisId="power"
                          orientation="right"
                          label={{ value: 'Net Power (kW)', angle: 90, position: 'insideRight', style: { fontSize: '11px' } }}
                          style={{ fontSize: '11px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: any, name: string) => [
                            name.includes('Power') ? `${Number(value).toFixed(2)} kW` : `${Number(value).toFixed(1)}%`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Line
                          yAxisId="soc"
                          type="monotone"
                          dataKey="stateOfCharge"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          name="State of Charge"
                        />
                        <Line
                          yAxisId="power"
                          type="monotone"
                          dataKey="netPower"
                          stroke="#6366f1"
                          strokeWidth={1.5}
                          dot={false}
                          name="Net Power"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
                      <div className="p-3 rounded-lg bg-emerald-50 border">
                        <p className="text-muted-foreground">Latest SoC</p>
                        <p className="text-lg font-semibold text-emerald-600">
                          {latestBatteryMetric ? `${latestBatteryMetric.stateOfCharge.toFixed(1)}%` : '--'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-50 border">
                        <p className="text-muted-foreground">Avg SoC</p>
                        <p className="text-lg font-semibold text-blue-600">
                          {deviceSummary ? `${deviceSummary.battery.avgSoc.toFixed(1)}%` : '--'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 border">
                        <p className="text-muted-foreground">Daily Throughput</p>
                        <p className="text-lg font-semibold text-amber-600">
                          {deviceSummary ? `${deviceSummary.battery.dailyThroughputKwh.toFixed(1)} kWh` : '--'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-500" />
                      Inverter Sensors
                    </CardTitle>
                    <CardDescription>
                      Efficiency and AC output metrics generated from live DC/AC conversions of the Open-Meteo feed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={inverterChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
                          style={{ fontSize: '11px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          yAxisId="efficiency"
                          domain={[80, 100]}
                          label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft', style: { fontSize: '11px' } }}
                          style={{ fontSize: '11px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          yAxisId="power"
                          orientation="right"
                          label={{ value: 'AC Output (kW)', angle: 90, position: 'insideRight', style: { fontSize: '11px' } }}
                          style={{ fontSize: '11px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: any, name: string) => [
                            name.includes('Output') ? `${Number(value).toFixed(2)} kW` : `${Number(value).toFixed(1)}%`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Line
                          yAxisId="efficiency"
                          type="monotone"
                          dataKey="efficiencyPct"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          name="Efficiency"
                        />
                        <Line
                          yAxisId="power"
                          type="monotone"
                          dataKey="acOutputKw"
                          stroke="#f97316"
                          strokeWidth={1.5}
                          dot={false}
                          name="AC Output"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
                      <div className="p-3 rounded-lg bg-blue-50 border">
                        <p className="text-muted-foreground">Peak Efficiency</p>
                        <p className="text-lg font-semibold text-blue-600">
                          {deviceSummary ? `${deviceSummary.inverter.peakEfficiencyPct.toFixed(1)}%` : '--'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-sky-50 border">
                        <p className="text-muted-foreground">Avg Efficiency</p>
                        <p className="text-lg font-semibold text-sky-600">
                          {deviceSummary ? `${deviceSummary.inverter.avgEfficiencyPct.toFixed(1)}%` : '--'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-indigo-50 border">
                        <p className="text-muted-foreground">Daily Energy</p>
                        <p className="text-lg font-semibold text-indigo-600">
                          {deviceSummary ? `${deviceSummary.inverter.totalEnergyKwh.toFixed(1)} kWh` : '--'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Solar Performance Charts */}
            {displayData.length > 0 ? (
              <>
                {/* AC Power Output Chart */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-500" />
                      AC Power Output ({viewMode === 'hourly' ? '24-Hour' : viewMode === 'weekly' ? '7-Day' : viewMode === 'monthly' ? '30-Day' : '12-Month'})
                    </CardTitle>
                    <CardDescription>
                      {viewMode === 'hourly'
                        ? 'Live hourly AC power generation from solar panels'
                        : viewMode === 'weekly'
                        ? 'Daily average power across the last week'
                        : viewMode === 'monthly'
                        ? 'Daily average power across the last month'
                        : 'Monthly average power across the last year'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={displayData}>
                        <defs>
                          <linearGradient id="colorAC" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
                          style={{ fontSize: '12px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          label={{ value: chartUnits.powerLabel, angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
                          style={{ fontSize: '12px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}${chartUnits.tooltipPowerSuffix}`, name]}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="ac_output"
                          stroke="#f97316"
                          fillOpacity={1}
                          fill="url(#colorAC)"
                          strokeWidth={2}
                        />
                        {PANEL_CONFIGURATIONS.map((config) => (
                          <Line
                            key={config.id}
                            type="monotone"
                            dataKey={`configOutputs.${config.id}`}
                            stroke={config.color}
                            strokeWidth={2}
                            dot={false}
                            name={config.label}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div className="text-center p-3 rounded-lg bg-gradient-to-br from-orange-50 to-white border">
                        <p className="text-xs text-muted-foreground">Current Output</p>
                        <p className="text-xl font-bold text-orange-600">
                          {aggregateStats ? aggregateStats.latestPower.toFixed(2) : '--'} kW
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gradient-to-br from-blue-50 to-white border">
                        <p className="text-xs text-muted-foreground">Peak Output</p>
                        <p className="text-xl font-bold text-blue-600">
                          {aggregateStats ? aggregateStats.peakPower.toFixed(2) : '--'} kW
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gradient-to-br from-green-50 to-white border">
                        <p className="text-xs text-muted-foreground">Avg Output</p>
                        <p className="text-xl font-bold text-green-600">
                          {aggregateStats ? aggregateStats.avgPower.toFixed(2) : '--'} kW
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Irradiance and Temperature Charts */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Irradiance Chart */}
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sun className="w-5 h-5 text-yellow-500" />
                        Solar Irradiance
                      </CardTitle>
                      <CardDescription>Plane of array irradiance (W/m²)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={displayData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="label"
                            style={{ fontSize: '11px' }}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis
                            style={{ fontSize: '11px' }}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: any, name: string) => [`${Number(value).toFixed(0)}${chartUnits.tooltipIrrSuffix}`, name]}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="irradiance"
                            stroke="#eab308"
                            strokeWidth={2}
                            dot={false}
                            name="Site Average"
                          />
                          {PANEL_CONFIGURATIONS.map((config) => (
                            <Line
                              key={config.id}
                              type="monotone"
                              dataKey={`configIrradiance.${config.id}`}
                              stroke={config.color}
                              strokeWidth={1.5}
                              dot={false}
                              strokeDasharray="6 4"
                              name={`${config.label} Irradiance`}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Latest</span>
                          <span className="font-semibold text-yellow-600">
                            {irradianceStats ? irradianceStats.latest.toFixed(0) : '--'} W/m²
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Peak</span>
                          <span className="font-semibold text-amber-600">
                            {irradianceStats ? irradianceStats.peak.toFixed(0) : '--'} W/m²
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Temperature Chart */}
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Thermometer className="w-5 h-5 text-red-500" />
                        Panel Temperature
                      </CardTitle>
                      <CardDescription>Cell temperature vs ambient</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={displayData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="label"
                            style={{ fontSize: '11px' }}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis
                            style={{ fontSize: '11px' }}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: any, name: string) => [
                              `${Number(value).toFixed(1)}°C`,
                              name
                            ]}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="cell_temp"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            name="Cell Temp"
                          />
                          <Line
                            type="monotone"
                            dataKey="ambient_temp"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            name="Ambient Temp"
                          />
                          {PANEL_CONFIGURATIONS.map((config) => (
                            <Line
                              key={config.id}
                              type="monotone"
                              dataKey={`configTemps.${config.id}`}
                              stroke={config.color}
                              strokeWidth={1.5}
                              dot={false}
                              strokeDasharray="4 4"
                              name={`${config.label} Cell Temp`}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Latest Cell</span>
                          <span className="font-semibold text-red-600">
                            {temperatureStats ? temperatureStats.latestCell.toFixed(1) : '--'}°C
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Avg Cell</span>
                          <span className="font-semibold text-rose-600">
                            {temperatureStats ? temperatureStats.avgCell.toFixed(1) : '--'}°C
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance Summary Card */}
                <Card className="shadow-card border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-2">{viewMeta.windowLabel} Summary</p>
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">Total Energy:</span>
                            <span className="font-semibold ml-1">
                              {aggregateStats ? aggregateStats.totalEnergyKwh.toFixed(1) : '--'} kWh
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Peak Irradiance:</span>
                            <span className="font-semibold ml-1">
                              {irradianceStats ? irradianceStats.peak.toFixed(0) : '--'} W/m²
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Avg Cell Temp:</span>
                            <span className="font-semibold ml-1">
                              {temperatureStats ? temperatureStats.avgCell.toFixed(1) : '--'}°C
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Data Coverage:</span>
                            <span className="font-semibold ml-1">Live + 24 months archive</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-card">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Sun className="w-16 h-16 text-muted-foreground/50 mb-4 animate-pulse" />
                  <h3 className="text-xl font-semibold mb-2">Loading Solar Data...</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Fetching live hourly data from Himawari satellite
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Visual Monitoring Tab */}
          <TabsContent value="visual" className="space-y-6">
            {solarIssues.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {solarIssues.map((issue) => (
                  <Card
                    key={issue.id}
                    className={`shadow-lg overflow-hidden group transition-all hover:shadow-xl hover:scale-[1.02] ${
                      issue.severity === 'critical' ? 'border-red-200 animate-pulse-slow' : ''
                    }`}
                  >
                    <div className="relative aspect-video bg-black">
                      <img
                        src={issue.imageUrl}
                        alt={`${issue.name} visual evidence`}
                        className="w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-all group-hover:from-black/95" />

                      {/* Status badges */}
                      <div className="absolute top-2 left-2 flex items-center space-x-2">
                        {issue.is_live && (
                          <Badge className="bg-red-500 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-white mr-2" />
                            LIVE
                          </Badge>
                        )}
                        <Badge className="bg-black/50 backdrop-blur-sm">
                          <Camera className="w-3 h-3 mr-1" />
                          Snapshot
                        </Badge>
                      </div>

                      {/* Severity badge */}
                      {issue.type !== 'none' && (
                        <div className="absolute top-2 right-2">
                          <Badge className={getSeverityColor(issue.severity)}>
                            {issue.severity.toUpperCase()}
                          </Badge>
                        </div>
                      )}

                      {/* Location and sensor data */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                        <div className="text-white text-sm font-medium drop-shadow-lg">
                          {issue.location}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/80">
                          <span className="flex items-center gap-1">
                            <Thermometer className="w-3 h-3" />
                            {issue.sensor_data.panel_temp.toFixed(1)}°C
                          </span>
                          <span className="flex items-center gap-1">
                            <Sun className="w-3 h-3" />
                            {issue.sensor_data.irradiance.toFixed(0)} W/m²
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {issue.sensor_data.power_output.toFixed(0)}W
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/70">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(issue.detected_at)}
                        </div>
                      </div>
                    </div>

                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${
                            issue.type === 'hotspot'
                              ? 'border-red-500 text-red-600'
                              : issue.type === 'crack'
                              ? 'border-orange-500 text-orange-600'
                              : issue.type === 'soiling'
                              ? 'border-yellow-500 text-yellow-600'
                              : 'border-gray-500 text-gray-600'
                          }`}
                        >
                          {issue.type.replace(/_/g, ' ')}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{issue.dispatch_priority}</span>
                        </div>
                      </div>
                      <CardTitle className="text-base leading-tight">{issue.name}</CardTitle>
                      <CardDescription className="text-xs">{issue.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Sensor Error Warning */}
                      {issue.has_sensor_error && (
                        <div className="p-3 rounded-lg bg-red-100 border-2 border-red-500">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-red-700">Sensor Error Detected</p>
                              <p className="text-xs text-red-600 mt-1">{issue.error_message}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Low Confidence Warning */}
                      {issue.needs_recheck && !issue.has_sensor_error && (
                        <div className="p-3 rounded-lg bg-yellow-100 border-2 border-yellow-500">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-yellow-700">Re-check Feed Required</p>
                              <p className="text-xs text-yellow-600 mt-1">
                                AI confidence below 70% - manual verification recommended
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Metrics */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className={`p-2 rounded-lg border ${
                          issue.needs_recheck
                            ? 'bg-yellow-50 border-yellow-300'
                            : 'bg-gradient-to-br from-blue-50 to-white'
                        }`}>
                          <div className="text-xs text-muted-foreground">AI Confidence</div>
                          <div className={`text-lg font-bold ${
                            issue.needs_recheck ? 'text-yellow-600' : 'text-blue-600'
                          }`}>
                            {(issue.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-gradient-to-br from-orange-50 to-white border">
                          <div className="text-xs text-muted-foreground">Energy Loss</div>
                          <div className="text-lg font-bold text-orange-600">
                            {issue.energy_loss_percent.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-gradient-to-r from-red-50 to-orange-50 border border-red-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Predicted Loss</span>
                          <span className="font-semibold text-red-600">
                            {issue.predicted_kwh_loss.toFixed(1)} kWh/day
                          </span>
                        </div>
                      </div>

                      {issue.history.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            <span>History Snapshots</span>
                            <span className="font-normal text-foreground/60">
                              Last review {formatRelativeTime(issue.history[issue.history.length - 1]?.timestamp)}
                            </span>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2">
                            {issue.history.map((frame) => (
                              <div
                                key={frame.timestamp}
                                className="min-w-[150px] border border-border/60 rounded-lg bg-muted/40 backdrop-blur-sm"
                              >
                                <div className="aspect-video overflow-hidden rounded-t-lg">
                                  <img
                                    src={frame.imageUrl}
                                    alt={`${issue.name} ${frame.label}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="p-2 space-y-1 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground">{frame.label}</span>
                                    <Badge className={`${getSeverityColor(frame.severity)} text-white px-2 py-0.5`}>
                                      {frame.severity.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-muted-foreground leading-tight line-clamp-3">
                                    {frame.notes}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground/70">
                                    {new Date(frame.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => toast.info('Sensor logs opened')}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View Logs
                        </Button>
                        {issue.severity !== 'info' && (
                          <Button
                            size="sm"
                            className={`flex-1 text-xs ${
                              issue.has_sensor_error
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                            }`}
                            onClick={() =>
                              issue.has_sensor_error
                                ? toast.error('Sensor repair required!')
                                : toast.success('Technician dispatched!')
                            }
                          >
                            <Wrench className="w-3 h-3 mr-1" />
                            {issue.has_sensor_error ? 'Repair Sensor' : 'Dispatch'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="shadow-card">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Camera className="w-16 h-16 text-muted-foreground/50 mb-4 animate-pulse" />
                  <h3 className="text-xl font-semibold mb-2">Loading Visual Monitoring...</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Fetching AI-powered issue detection with weather context
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Alert Info */}
        <Card className="shadow-card border-solar-orange/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-solar-orange flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-2">IoT Integration Guide</h3>
                <p className="text-sm text-muted-foreground">
                  To connect your physical sensors and cameras, configure your devices to send data to the platform using MQTT, Modbus, or HTTP API protocols.
                  Visual monitoring uses AI-powered defect detection on live camera feeds for automated panel inspection.
                  For testing purposes, sensors display simulated real-time data. For production deployment, integrate with your actual IoT infrastructure.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IoTSensors;