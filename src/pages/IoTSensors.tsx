import { useState, useEffect } from "react";
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
import { openMeteoService, SolarDataPoint } from "@/services/openMeteo";
import { nasaPowerService, SolarWeatherData } from "@/services/nasaPower";
import { solarIssueService, SolarIssue } from "@/services/solarIssues";
import { weatherDataService, SolarSample } from "@/services/weatherData";

const IoTSensors = () => {
  const { user } = useAuth();
  const [sensors, setSensors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    sensor_name: "",
    sensor_type: "thermal",
    protocol: "mqtt",
    device_id: "",
    endpoint_url: "",
  });

  // PVWatts live data state
  const [solarData, setSolarData] = useState<SolarDataPoint[]>([]);
  const [pvDataLoading, setPvDataLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

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
  const [viewMode, setViewMode] = useState<'hourly' | 'weekly' | 'monthly'>('hourly');

  // Fetch sensors data
  useEffect(() => {
    fetchSensors();
  }, [user]);

  // Fetch solar data on mount
  useEffect(() => {
    fetchSolarData();
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
      setLastUpdated(new Date());
      console.log(`✅ Updated solar data: ${data.length} hours`);
    } catch (error) {
      console.error('Error fetching Open-Meteo data:', error);
      toast.error('Failed to fetch solar data');
    } finally {
      setPvDataLoading(false);
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
        sensor_type: "thermal",
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
      case "thermal":
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

  // Filter solar data based on date and day/night
  const getFilteredSolarData = () => {
    let filtered = solarData;

    // Apply day/night filter
    if (dayNightFilter !== 'all') {
      filtered = filtered.filter(dataPoint => {
        const hour = parseInt(dataPoint.hour.split(':')[0]);
        const isDaytime = hour >= 6 && hour < 18;
        return dayNightFilter === 'day' ? isDaytime : !isDaytime;
      });
    }

    return filtered;
  };

  const filteredSolarData = getFilteredSolarData();

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
                      <SelectItem value="thermal">Thermal</SelectItem>
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
                  const Icon = getSensorIcon(sensor.sensor_type);
                  const statusColor = getStatusColor(sensor.status);
                  return (
                    <div
                      key={sensor.id}
                      className="p-4 rounded-xl border border-border hover:border-primary hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg gradient-${sensor.sensor_type === 'battery' ? 'eco' : sensor.sensor_type === 'inverter' ? 'energy' : 'solar'} flex items-center justify-center flex-shrink-0`}>
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
                            {sensor.sensor_type.replace('_', ' ')}
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
                        className="rounded-l-none text-xs px-3"
                      >
                        Monthly
                      </Button>
                    </div>
                  </div>

                  <div className="w-full text-xs text-muted-foreground">
                    Showing {filteredSolarData.length} of {solarData.length} data points • {viewMode === 'hourly' ? '24 hours' : viewMode === 'weekly' ? '7 days' : '30 days'} view
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* View Mode Info */}
            {(viewMode === 'weekly' || viewMode === 'monthly') && (
              <Card className="shadow-card border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">Limited Historical Data</p>
                      <p className="text-xs">
                        Currently displaying 24 hours of data. Weekly and monthly views show the same timeframe.
                        For extended historical analysis, configure longer data retention in your system settings.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Solar Performance Charts */}
            {filteredSolarData.length > 0 ? (
              <>
                {/* AC Power Output Chart */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-500" />
                      AC Power Output ({viewMode === 'hourly' ? '24-Hour' : viewMode === 'weekly' ? '7-Day' : '30-Day'})
                    </CardTitle>
                    <CardDescription>
                      {viewMode === 'hourly' ? 'Live hourly AC power generation from solar panels' :
                       viewMode === 'weekly' ? 'Weekly AC power generation trend' :
                       'Monthly AC power generation overview'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={filteredSolarData}>
                        <defs>
                          <linearGradient id="colorAC" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="hour"
                          style={{ fontSize: '12px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
                          style={{ fontSize: '12px' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: any) => [`${value.toFixed(2)} kW`, 'AC Power']}
                        />
                        <Area
                          type="monotone"
                          dataKey="ac_output"
                          stroke="#f97316"
                          fillOpacity={1}
                          fill="url(#colorAC)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div className="text-center p-3 rounded-lg bg-gradient-to-br from-orange-50 to-white border">
                        <p className="text-xs text-muted-foreground">Current Output</p>
                        <p className="text-xl font-bold text-orange-600">
                          {filteredSolarData[filteredSolarData.length - 1]?.ac_output.toFixed(2)} kW
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gradient-to-br from-blue-50 to-white border">
                        <p className="text-xs text-muted-foreground">Peak Output</p>
                        <p className="text-xl font-bold text-blue-600">
                          {Math.max(...filteredSolarData.map(d => d.ac_output)).toFixed(2)} kW
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gradient-to-br from-green-50 to-white border">
                        <p className="text-xs text-muted-foreground">Avg Output</p>
                        <p className="text-xl font-bold text-green-600">
                          {(filteredSolarData.reduce((sum, d) => sum + d.ac_output, 0) / filteredSolarData.length).toFixed(2)} kW
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
                        <LineChart data={filteredSolarData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="hour"
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
                            formatter={(value: any) => [`${value.toFixed(0)} W/m²`, 'Irradiance']}
                          />
                          <Line
                            type="monotone"
                            dataKey="irradiance"
                            stroke="#eab308"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Current</span>
                        <span className="font-semibold text-yellow-600">
                          {filteredSolarData[filteredSolarData.length - 1]?.irradiance.toFixed(0)} W/m²
                        </span>
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
                        <LineChart data={filteredSolarData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="hour"
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
                              `${value.toFixed(1)}°C`,
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
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cell Temp</span>
                        <span className="font-semibold text-red-600">
                          {filteredSolarData[filteredSolarData.length - 1]?.cell_temp.toFixed(1)}°C
                        </span>
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
                        <p className="text-sm font-medium mb-2">24-Hour Performance Summary</p>
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">Total Energy:</span>
                            <span className="font-semibold ml-1">
                              {(filteredSolarData.reduce((sum, d) => sum + d.ac_output, 0)).toFixed(1)} kWh
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Peak Irradiance:</span>
                            <span className="font-semibold ml-1">
                              {Math.max(...filteredSolarData.map(d => d.irradiance)).toFixed(0)} W/m²
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Avg Cell Temp:</span>
                            <span className="font-semibold ml-1">
                              {(filteredSolarData.reduce((sum, d) => sum + d.cell_temp, 0) / filteredSolarData.length).toFixed(1)}°C
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Data Source:</span>
                            <span className="font-semibold ml-1">Open-Meteo Satellite</span>
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