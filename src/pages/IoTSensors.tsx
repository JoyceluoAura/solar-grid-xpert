import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatJakartaTime } from "@/lib/utils";
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
  Brain,
  Sparkles,
  ThermometerSun,
  BatteryCharging,
  ArrowUpRight,
  CheckCircle2,
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
import { getFallbackSensors } from "@/lib/mockSensors";

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

type InsightSeverity = "critical" | "warning" | "info";

interface AiInsight {
  id: string;
  title: string;
  severity: InsightSeverity;
  summary: string;
  recommendation: string;
  metric: string;
  value: string;
}

interface AiSummary {
  healthScore: number;
  riskLevel: "Low" | "Elevated" | "High";
  performanceRatioPct: number | null;
  opportunityKwh: number;
  avgRecentPower: number;
  temperatureFlag?: string;
  insights: AiInsight[];
  summaryBullets: string[];
}

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
  const [forecastData, setForecastData] = useState<DailySolarDataPoint[]>([]);

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
  const [viewMode, setViewMode] = useState<'hourly' | 'weekly' | 'monthly' | 'yearly' | 'forecast'>('hourly');

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
  }, [viewMode]); // Refetch when view mode changes

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
      
      // Adjust date range based on view mode
      if (viewMode === 'weekly') {
        startDate.setDate(endDate.getDate() - 7);
      } else if (viewMode === 'monthly') {
        startDate.setMonth(endDate.getMonth() - 1);
      } else if (viewMode === 'yearly') {
        startDate.setFullYear(endDate.getFullYear() - 1);
      } else {
        startDate.setFullYear(startDate.getFullYear() - 2); // Default 2 years for comprehensive data
      }

      const [historical, forecast] = await Promise.all([
        openMeteoService.fetchHistoricalDailyData(
          siteParams,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        ),
        openMeteoService.fetchForecastData(siteParams)
      ]);

      setHistoricalSolarData(historical);
      setForecastData(forecast);
      console.log(`📈 Loaded ${historical.length} days historical + ${forecast.length} days forecast`);
    } catch (error) {
      console.error('Error fetching solar data:', error);
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
      if (data && data.length > 0) {
        setSensors(data);
      } else {
        setSensors(getFallbackSensors());
      }
    } catch (error: any) {
      toast.error("Failed to load sensors");
      console.error(error);
      setSensors(getFallbackSensors());
    } finally {
      setLoading(false);
    }
  };

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

  const getInsightPillStyle = (severity: InsightSeverity) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "warning":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  const getInsightLabel = (severity: InsightSeverity) => {
    switch (severity) {
      case "critical":
        return "Critical";
      case "warning":
        return "Warning";
      default:
        return "Info";
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
      
      // Don't filter by selectedDate in hourly view - we want rolling 24 hours
      // The selectedDate filter is only useful for historical daily views
      
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

    if (viewMode === 'yearly') {
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
    }

    // Forecast view
    if (viewMode === 'forecast' && forecastData.length > 0) {
      return forecastData.map((day) =>
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

    return [];
  }, [solarData, historicalSolarData, forecastData, viewMode, dayNightFilter, selectedDate]);

  const chartUnits = useMemo(() => ({
    powerLabel: viewMode === 'hourly' ? 'Power (kW)' : viewMode === 'forecast' ? 'Forecast Power (kW)' : 'Avg Power (kW)',
    irradianceLabel: viewMode === 'hourly' ? 'Irradiance (W/m²)' : viewMode === 'forecast' ? 'Forecast Irradiance (W/m²)' : 'Avg Irradiance (W/m²)',
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

    if (viewMode === 'yearly') {
      return {
        windowLabel: '12-month monthly averages',
        totalSourcePoints: Math.min(12, Math.ceil(historicalSolarData.length / 30)),
        pointDescriptor: 'months',
      };
    }

    if (viewMode === 'forecast') {
      return {
        windowLabel: '7-day forecast',
        totalSourcePoints: forecastData.length,
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

    // Find the most recent data with actual solar generation (irradiance > 10)
    let latestPower = 0;
    let latestLabel = '';
    let isNighttime = false;
    
    if (solarData.length > 0) {
      const latestData = solarData[solarData.length - 1];
      
      // Check if current time is nighttime (irradiance = 0)
      if (latestData.irradiance === 0) {
        isNighttime = true;
        // Find most recent daytime reading
        for (let i = solarData.length - 1; i >= 0; i--) {
          if (solarData[i].irradiance > 10) {
            latestPower = solarData[i].ac_output;
            latestLabel = solarData[i].hour;
            break;
          }
        }
      } else {
        latestPower = latestData.ac_output;
        latestLabel = latestData.hour;
      }
    } else if (displayData.length > 0) {
      // Fallback to displayData
      const latestDisplay = displayData[displayData.length - 1];
      latestPower = latestDisplay.ac_output;
      // If we're in aggregated view, multiply back
      if (viewMode !== 'hourly' && viewMode !== 'forecast') {
        latestPower = latestPower * 24;
      }
    }

    const peakPower = Math.max(...displayData.map((d) => d.ac_output));
    const avgPower = displayData.reduce((sum, d) => sum + d.ac_output, 0) / displayData.length;
    const energyMultiplier = viewMode === 'hourly' ? 1 : 24;
    const totalEnergyKwh = displayData.reduce((sum, d) => sum + d.ac_output * energyMultiplier, 0);

    return {
      latestPower,
      latestLabel,
      isNighttime,
      peakPower,
      avgPower,
      totalEnergyKwh,
    };
  }, [displayData, viewMode, solarData]);

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
      label: formatJakartaTime(metric.timestamp),
      stateOfCharge: metric.stateOfCharge,
      netPower: Number((metric.chargePowerKw - metric.dischargePowerKw).toFixed(2)),
      temperatureC: metric.temperatureC,
    })),
    [batteryMetrics]
  );

  const inverterChartData = useMemo(() =>
    inverterMetrics.slice(-24).map((metric) => ({
      label: formatJakartaTime(metric.timestamp),
      efficiencyPct: metric.efficiencyPct,
      acOutputKw: metric.acOutputKw,
      clippingPct: metric.clippingPct,
    })),
    [inverterMetrics]
  );

  const aiSummary = useMemo<AiSummary | null>(() => {
    if (!displayData.length) {
      return null;
    }

    const systemCapacity = siteParams.system_capacity;
    const latest = displayData[displayData.length - 1];
    const expectedPower = Math.min(systemCapacity, (latest.irradiance / 1000) * systemCapacity);
    const performanceRatio = expectedPower > 0 ? latest.ac_output / expectedPower : null;

    const recentWindow = displayData.slice(-6);
    const previousWindow = displayData.slice(-12, -6);
    const avgRecentPower = recentWindow.length
      ? recentWindow.reduce((sum, point) => sum + point.ac_output, 0) / recentWindow.length
      : latest.ac_output;
    const avgPreviousPower = previousWindow.length
      ? previousWindow.reduce((sum, point) => sum + point.ac_output, 0) / previousWindow.length
      : avgRecentPower;

    const battery = batteryMetrics[batteryMetrics.length - 1];
    const inverterEfficiency = deviceSummary?.inverter.avgEfficiencyPct ?? null;

    const performancePenalty = performanceRatio !== null ? Math.max(0, (1 - performanceRatio) * 40) : 0;
    const tempPenalty = Math.max(0, latest.cell_temp - 58) * 1.1;
    const batteryPenalty = battery && battery.stateOfCharge < 35 ? (35 - battery.stateOfCharge) * 0.3 : 0;
    const efficiencyPenalty =
      inverterEfficiency !== null && inverterEfficiency < 94 ? (94 - inverterEfficiency) * 0.6 : 0;

    const rawScore = 92 - performancePenalty - tempPenalty - batteryPenalty - efficiencyPenalty;
    const healthScore = Number(Math.max(45, Math.min(98, rawScore)).toFixed(1));
    const riskLevel: AiSummary["riskLevel"] = healthScore >= 85 ? "Low" : healthScore >= 70 ? "Elevated" : "High";

    const opportunityKw = performanceRatio !== null ? Math.max(0, expectedPower - latest.ac_output) : 0;
    const opportunityKwh = Number((opportunityKw * (viewMode === 'hourly' ? 1 : 24)).toFixed(1));

    const avgCellTemp = displayData.reduce((sum, point) => sum + point.cell_temp, 0) / displayData.length;
    const avgIrradiance = displayData.reduce((sum, point) => sum + point.irradiance, 0) / displayData.length;

    const insights: AiInsight[] = [];
    if (performanceRatio !== null) {
      if (performanceRatio < 0.7 && latest.irradiance > 550) {
        insights.push({
          id: "performance-deficit",
          title: "Performance deficit detected",
          severity: "critical",
          summary: `Performance ratio ${(performanceRatio * 100).toFixed(1)}% with irradiance ${latest.irradiance.toFixed(0)} W/m²`,
          recommendation: "Inspect for string mismatch or heavy shading; compare IV traces for affected strings.",
          metric: "Performance Ratio",
          value: `${(performanceRatio * 100).toFixed(1)}%`,
        });
      } else if (performanceRatio < 0.85) {
        insights.push({
          id: "performance-watch",
          title: "Performance trending below forecast",
          severity: "warning",
          summary: `Performance ratio ${(performanceRatio * 100).toFixed(1)}% with average irradiance ${avgIrradiance.toFixed(0)} W/m²`,
          recommendation: "Verify inverter clipping limits and check for emerging soiling on rooftop arrays.",
          metric: "Performance Ratio",
          value: `${(performanceRatio * 100).toFixed(1)}%`,
        });
      }
    }

    if (latest.cell_temp >= 62) {
      insights.push({
        id: "thermal-hotspot",
        title: "Module temperature is in critical range",
        severity: "critical",
        summary: `Latest cell temperature ${latest.cell_temp.toFixed(1)}°C exceeds safe threshold`,
        recommendation: "Dispatch cleaning and inspect for hotspots using IR camera feed to prevent accelerated degradation.",
        metric: "Cell Temp",
        value: `${latest.cell_temp.toFixed(1)}°C`,
      });
    } else if (avgCellTemp >= 55) {
      insights.push({
        id: "thermal-trend",
        title: "Panel temperature elevated",
        severity: "warning",
        summary: `Average cell temperature ${avgCellTemp.toFixed(1)}°C across telemetry window`,
        recommendation: "Schedule rinsing during early morning hours and review ventilation or airflow around rooftop arrays.",
        metric: "Avg Cell Temp",
        value: `${avgCellTemp.toFixed(1)}°C`,
      });
    }

    if (battery) {
      if (battery.stateOfCharge < 30) {
        insights.push({
          id: "battery-reserve",
          title: "Battery reserve critically low",
          severity: "critical",
          summary: `Latest battery state-of-charge ${battery.stateOfCharge.toFixed(1)}%`,
          recommendation: "Throttle discharge for the next cycle and evaluate peak load profile vs. available solar charge window.",
          metric: "Battery SoC",
          value: `${battery.stateOfCharge.toFixed(1)}%`,
        });
      } else if (battery.stateOfCharge < 45) {
        insights.push({
          id: "battery-trend",
          title: "Battery charge drifting downward",
          severity: "warning",
          summary: `Battery state-of-charge ${battery.stateOfCharge.toFixed(1)}% is below optimal reserve`,
          recommendation: "Adjust charge schedule or reduce evening discharge to maintain resiliency margin.",
          metric: "Battery SoC",
          value: `${battery.stateOfCharge.toFixed(1)}%`,
        });
      }
    }

    if (inverterEfficiency !== null && inverterEfficiency < 93) {
      insights.push({
        id: "inverter-efficiency",
        title: "Inverter efficiency dip",
        severity: "info",
        summary: `Average inverter efficiency ${inverterEfficiency.toFixed(1)}% over the last cycle`,
        recommendation: "Run inverter self-diagnostics and verify DC wiring losses or clipping at peak sun hours.",
        metric: "Avg Efficiency",
        value: `${inverterEfficiency.toFixed(1)}%`,
      });
    }

    if (avgRecentPower < avgPreviousPower - 2) {
      insights.push({
        id: "power-trend",
        title: "Output trend declining",
        severity: "warning",
        summary: `Recent average power ${avgRecentPower.toFixed(1)} kW vs ${avgPreviousPower.toFixed(1)} kW previously`,
        recommendation: "Review cleaning schedule and confirm tracker alignment; consider targeted inspection of underperforming strings.",
        metric: "Avg Power",
        value: `${avgRecentPower.toFixed(1)} kW`,
      });
    }

    const summaryBullets = [
      `Latest AC output ${latest.ac_output.toFixed(2)} kW at ${latest.irradiance.toFixed(0)} W/m² irradiance`,
      performanceRatio !== null
        ? `Performance ratio ${(performanceRatio * 100).toFixed(1)}% • Opportunity ${opportunityKwh.toFixed(1)} kWh`
        : "Performance ratio awaiting irradiance reference",
      battery
        ? `Battery SoC ${battery.stateOfCharge.toFixed(1)}% • Daily avg ${(deviceSummary?.battery.avgSoc ?? battery.stateOfCharge).toFixed(1)}%`
        : "Battery telemetry not available",
    ];

    if (avgRecentPower && avgPreviousPower && Math.abs(avgRecentPower - avgPreviousPower) >= 0.5) {
      summaryBullets.push(`Average power trend ${avgRecentPower >= avgPreviousPower ? "up" : "down"} ${(avgRecentPower - avgPreviousPower).toFixed(1)} kW over last 6 samples`);
    }

    return {
      healthScore,
      riskLevel,
      performanceRatioPct: performanceRatio !== null ? Number((performanceRatio * 100).toFixed(1)) : null,
      opportunityKwh,
      avgRecentPower: Number(avgRecentPower.toFixed(2)),
      temperatureFlag: latest.cell_temp >= 60 ? `Cell temperature ${latest.cell_temp.toFixed(1)}°C` : undefined,
      insights,
      summaryBullets,
    };
  }, [
    displayData,
    siteParams.system_capacity,
    batteryMetrics,
    deviceSummary,
    viewMode,
  ]);

  const latestBatteryMetric = batteryMetrics[batteryMetrics.length - 1];
  const latestInverterMetric = inverterMetrics[inverterMetrics.length - 1];
  const inverterAvgEfficiency = deviceSummary?.inverter.avgEfficiencyPct ?? null;

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
        {sensors.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-solar-orange" />
                Connected Sensors ({sensors.length})
              </CardTitle>
              <CardDescription>IoT devices monitoring your solar installation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sensors.map((sensor) => {
                  const normalizedType = sensor.sensor_type === 'thermal' ? 'temperature' : sensor.sensor_type;
                  const Icon = getSensorIcon(normalizedType);
                  const statusColor = getStatusColor(sensor.status);
                  return (
                    <div
                      key={sensor.id}
                      className="p-4 rounded-xl border border-border hover:border-primary hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg gradient-${normalizedType === 'battery' ? 'eco' : normalizedType === 'inverter' ? 'energy' : 'solar'} flex items-center justify-center flex-shrink-0`}>
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
                        Himawari satellite data • Auto-refreshes every 10 seconds • Last updated: {formatJakartaTime(lastUpdated)}
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
                        className="rounded-none border-r text-xs px-3"
                      >
                        Yearly
                      </Button>
                      <Button
                        variant={viewMode === 'forecast' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('forecast')}
                        className="rounded-r-md text-xs px-3"
                      >
                        Forecast
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
                        <p className="text-xs text-muted-foreground">
                          {aggregateStats?.isNighttime ? 'Last Daytime Output' : 'Current Output'}
                        </p>
                        <p className="text-xl font-bold text-orange-600">
                          {aggregateStats ? aggregateStats.latestPower.toFixed(2) : '--'} kW
                        </p>
                        {aggregateStats?.isNighttime && aggregateStats?.latestLabel && (
                          <p className="text-xs text-muted-foreground mt-1">
                            at {aggregateStats.latestLabel} WIB
                          </p>
                        )}
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
                      <video
                        src={issue.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        poster={issue.posterUrl}
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
                          <Video className="w-3 h-3 mr-1" />
                          5s
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