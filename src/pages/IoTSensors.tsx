import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wifi, Plus, AlertCircle, Activity, Thermometer, Zap, Battery, Camera } from "lucide-react";
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

        {/* Sensors Grid */}
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

        {/* Alert Info */}
        <Card className="shadow-card border-solar-orange/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-solar-orange flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-2">IoT Integration Guide</h3>
                <p className="text-sm text-muted-foreground">
                  To connect your physical sensors, configure your devices to send data to the platform using MQTT, Modbus, or HTTP API protocols. 
                  For testing purposes, sensors added here will display simulated real-time data. For production deployment, integrate with your actual IoT infrastructure.
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