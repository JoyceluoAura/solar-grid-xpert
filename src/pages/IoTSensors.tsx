import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Wifi, Plus, AlertCircle, Activity, Thermometer, Zap, Battery, Camera, Video, Play } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  // Mock real-time data
  const mockRealtimeData = Array.from({ length: 20 }, (_, i) => ({
    time: `${i}:00`,
    value: Math.floor(Math.random() * 30) + 50,
  }));

  // Mock camera videos with defects
  const mockCameraFeeds = [
    {
      id: "cam-001",
      name: "Panel Array A - Hotspot Detection",
      defectType: "hotspot",
      severity: "critical",
      location: "Row 1, Panel 5",
      thumbnail: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&h=300&fit=crop",
      description: "Thermal anomaly detected - immediate inspection required",
    },
    {
      id: "cam-002",
      name: "Panel Array B - Physical Crack",
      defectType: "crack",
      severity: "high",
      location: "Row 2, Panel 12",
      thumbnail: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=400&h=300&fit=crop",
      description: "Visible crack detected on panel surface",
    },
    {
      id: "cam-003",
      name: "Panel Array C - Soiling Analysis",
      defectType: "soiling",
      severity: "medium",
      location: "Row 3, Panel 8",
      thumbnail: "https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=400&h=300&fit=crop",
      description: "Heavy dust accumulation reducing efficiency",
    },
    {
      id: "cam-004",
      name: "Panel Array D - Normal Operation",
      defectType: "none",
      severity: "info",
      location: "Row 4, Panel 3",
      thumbnail: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop",
      description: "All panels operating within normal parameters",
    },
    {
      id: "cam-005",
      name: "Panel Array E - Delamination",
      defectType: "delamination",
      severity: "high",
      location: "Row 5, Panel 15",
      thumbnail: "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?w=400&h=300&fit=crop",
      description: "Layer separation detected - monitor closely",
    },
    {
      id: "cam-006",
      name: "Panel Array F - Snail Trails",
      defectType: "snail_trail",
      severity: "low",
      location: "Row 6, Panel 7",
      thumbnail: "https://images.unsplash.com/photo-1509390144881-c8fc18f5a628?w=400&h=300&fit=crop",
      description: "Silver paste corrosion visible on cells",
    },
  ];

  useEffect(() => {
    fetchSensors();
  }, [user]);

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
            {sensors.length > 0 ? (
              <div className="grid lg:grid-cols-2 gap-6">
                {sensors.map((sensor) => {
                  const Icon = getSensorIcon(sensor.sensor_type);
                  return (
                    <Card key={sensor.id} className="shadow-card">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl gradient-solar flex items-center justify-center">
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{sensor.sensor_name}</CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1">
                                <span className={`w-2 h-2 rounded-full ${sensor.status === "online" ? "bg-eco-green" : "bg-muted-foreground"}`} />
                                <span className={getStatusColor(sensor.status)}>
                                  {sensor.status || "offline"}
                                </span>
                              </CardDescription>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">{sensor.protocol.toUpperCase()}</div>
                            <div className="text-xs text-muted-foreground">{sensor.device_id}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={mockRealtimeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="time" hide />
                            <YAxis hide />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="hsl(var(--solar-orange))"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Last reading</span>
                          <span className="font-semibold text-foreground">
                            {mockRealtimeData[mockRealtimeData.length - 1].value}{" "}
                            {sensor.sensor_type === "thermal" ? "°C" : "units"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="shadow-card">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Wifi className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Sensors Connected</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Add your first IoT sensor to start real-time monitoring
                  </p>
                  <Button onClick={() => setOpen(true)} className="gradient-energy text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Sensor
                  </Button>
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
                    <img
                      src={feed.thumbnail}
                      alt={feed.name}
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-8 h-8 text-white ml-1" />
                      </div>
                    </div>

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
                      <div className="text-white text-sm font-medium truncate">
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
                        <span>20s recording</span>
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