import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Wifi, Plus, AlertCircle, Activity, Thermometer, Zap, Battery, Camera, Video, Sun, RefreshCw, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { pvWattsService, SolarDataPoint } from "@/services/pvwatts";

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

  // Mock camera videos with defects
  const mockCameraFeeds = [
    {
      id: "cam-001",
      name: "Panel Array A - Hotspot Detection",
      defectType: "hotspot",
      severity: "critical",
      location: "Row 1, Panel 5",
      videoUrl: "https://videos.pexels.com/video-files/4509544/4509544-uhd_2560_1440_25fps.mp4",
      description: "Thermal anomaly detected - immediate inspection required",
    },
    {
      id: "cam-002",
      name: "Panel Array B - Physical Crack",
      defectType: "crack",
      severity: "high",
      location: "Row 2, Panel 12",
      videoUrl: "https://videos.pexels.com/video-files/8953563/8953563-uhd_2560_1440_25fps.mp4",
      description: "Visible crack detected on panel surface",
    },
    {
      id: "cam-003",
      name: "Panel Array C - Soiling Analysis",
      defectType: "soiling",
      severity: "medium",
      location: "Row 3, Panel 8",
      videoUrl: "https://videos.pexels.com/video-files/2278095/2278095-uhd_2560_1440_30fps.mp4",
      description: "Heavy dust accumulation reducing efficiency",
    },
    {
      id: "cam-004",
      name: "Panel Array D - Normal Operation",
      defectType: "none",
      severity: "info",
      location: "Row 4, Panel 3",
      videoUrl: "https://videos.pexels.com/video-files/7235122/7235122-uhd_2560_1440_30fps.mp4",
      description: "All panels operating within normal parameters",
    },
    {
      id: "cam-005",
      name: "Panel Array E - Delamination",
      defectType: "delamination",
      severity: "high",
      location: "Row 5, Panel 15",
      videoUrl: "https://videos.pexels.com/video-files/9648835/9648835-uhd_2560_1440_30fps.mp4",
      description: "Layer separation detected - monitor closely",
    },
    {
      id: "cam-006",
      name: "Panel Array F - Snail Trails",
      defectType: "snail_trail",
      severity: "low",
      location: "Row 6, Panel 7",
      videoUrl: "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4",
      description: "Silver paste corrosion visible on cells",
    },
  ];

  // Fetch sensors data
  useEffect(() => {
    fetchSensors();
  }, [user]);

  // Fetch PVWatts data on mount
  useEffect(() => {
    fetchPVWattsData();
  }, []);

  // Auto-refresh PVWatts data every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchPVWattsData();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, siteParams]);

  // Fetch live solar data from PVWatts
  const fetchPVWattsData = async () => {
    try {
      setPvDataLoading(true);
      const data = await pvWattsService.fetchSolarData(siteParams);
      setSolarData(data);
      setLastUpdated(new Date());
      console.log(`✅ Updated solar data: ${data.length} hours`);
    } catch (error) {
      console.error('Error fetching PVWatts data:', error);
      toast.error('Failed to fetch solar data');
    } finally {
      setPvDataLoading(false);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
              IoT Sensors
            </h1>
            <p className="text-muted-foreground">Manage and visualize your connected devices</p>
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

        {/* Tabs for Data vs Visual */}
        <Tabs defaultValue="data" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="data">
              <Activity className="w-4 h-4 mr-2" />
              Data Sensors
            </TabsTrigger>
            <TabsTrigger value="visual">
              <Video className="w-4 h-4 mr-2" />
              Visual Monitoring
            </TabsTrigger>
          </TabsList>

          {/* Data Sensors Tab */}
          <TabsContent value="data" className="space-y-6">
            {/* Live PVWatts Data Header */}
            <Card className="shadow-card border-blue-200 bg-gradient-to-r from-blue-50 to-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start space-x-3">
                    <Sun className="h-6 w-6 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Live Solar Data from PVWatts</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Hourly performance data • Auto-refreshes every 10 seconds • Last updated: {lastUpdated.toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Location: {siteParams.lat.toFixed(4)}°, {siteParams.lon.toFixed(4)}° •
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
                      onClick={fetchPVWattsData}
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

            {/* Solar Performance Charts */}
            {solarData.length > 0 ? (
              <>
                {/* AC Power Output Chart */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-500" />
                      AC Power Output (24-Hour)
                    </CardTitle>
                    <CardDescription>
                      Live hourly AC power generation from solar panels
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={solarData}>
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
                          {solarData[solarData.length - 1]?.ac_output.toFixed(2)} kW
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gradient-to-br from-blue-50 to-white border">
                        <p className="text-xs text-muted-foreground">Peak Output</p>
                        <p className="text-xl font-bold text-blue-600">
                          {Math.max(...solarData.map(d => d.ac_output)).toFixed(2)} kW
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gradient-to-br from-green-50 to-white border">
                        <p className="text-xs text-muted-foreground">Avg Output</p>
                        <p className="text-xl font-bold text-green-600">
                          {(solarData.reduce((sum, d) => sum + d.ac_output, 0) / solarData.length).toFixed(2)} kW
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
                        <LineChart data={solarData}>
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
                          {solarData[solarData.length - 1]?.irradiance.toFixed(0)} W/m²
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
                        <LineChart data={solarData}>
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
                              name === 'cell_temp' ? 'Cell Temp' : 'Ambient Temp'
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
                          {solarData[solarData.length - 1]?.cell_temp.toFixed(1)}°C
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
                              {(solarData.reduce((sum, d) => sum + d.ac_output, 0)).toFixed(1)} kWh
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Peak Irradiance:</span>
                            <span className="font-semibold ml-1">
                              {Math.max(...solarData.map(d => d.irradiance)).toFixed(0)} W/m²
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Avg Cell Temp:</span>
                            <span className="font-semibold ml-1">
                              {(solarData.reduce((sum, d) => sum + d.cell_temp, 0) / solarData.length).toFixed(1)}°C
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Data Source:</span>
                            <span className="font-semibold ml-1">PVWatts API</span>
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
                    Fetching live hourly data from PVWatts API
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Visual Monitoring Tab */}
          <TabsContent value="visual" className="space-y-6">
            <Card className="shadow-card border-blue-200 bg-blue-50 dark:bg-blue-950">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Camera className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Live Camera Feeds</p>
                    <p className="text-sm text-muted-foreground">
                      Monitoring {mockCameraFeeds.length} panel arrays with AI defect detection
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockCameraFeeds.map((feed) => (
                <Card key={feed.id} className="shadow-card overflow-hidden group">
                  <div className="relative aspect-video bg-black">
                    <video
                      src={feed.videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Status badge */}
                    <div className="absolute top-2 left-2 flex items-center space-x-2">
                      <Badge className="bg-red-500 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white mr-2" />
                        LIVE
                      </Badge>
                    </div>

                    {/* Severity badge */}
                    {feed.defectType !== "none" && (
                      <div className="absolute top-2 right-2">
                        <Badge className={getSeverityColor(feed.severity)}>
                          {feed.severity.toUpperCase()}
                        </Badge>
                      </div>
                    )}

                    {/* Location label */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="text-white text-sm font-medium truncate drop-shadow-lg">
                        {feed.location}
                      </div>
                    </div>
                  </div>

                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center space-x-2">
                      <Camera className="w-4 h-4" />
                      <span className="truncate">{feed.name}</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {feed.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Video className="w-3 h-3" />
                        <span>5s recording</span>
                      </div>
                      {feed.defectType !== "none" && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {feed.defectType.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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