import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Video, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sensor {
  id: string;
  sensor_name: string;
  sensor_type: string;
  status: string;
  device_id: string;
}

interface SensorReading {
  id: string;
  sensor_id: string;
  value: number;
  unit: string;
  timestamp: string;
  metadata: any;
}

const VisualMonitoring = () => {
  const { user } = useAuth();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string>("");
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCameraSensors();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSensor) {
      fetchSensorReadings(selectedSensor);
    }
  }, [selectedSensor]);

  const fetchCameraSensors = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("sensors")
        .select("*")
        .eq("user_id", user.id)
        .eq("sensor_type", "camera")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSensors(data || []);
      if (data && data.length > 0) {
        setSelectedSensor(data[0].id);
      }
    } catch (error: any) {
      toast.error("Failed to load camera sensors");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSensorReadings = async (sensorId: string) => {
    try {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("*")
        .eq("sensor_id", sensorId)
        .order("timestamp", { ascending: false })
        .limit(20);

      if (error) throw error;

      setReadings(data || []);
    } catch (error: any) {
      console.error("Error fetching sensor readings:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "offline":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    return status === "online" ? (
      <CheckCircle2 className="w-4 h-4" />
    ) : (
      <AlertTriangle className="w-4 h-4" />
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Visual Monitoring</h1>
        <p className="text-muted-foreground mt-2">
          Monitor solar panels through connected camera sensors
        </p>
      </div>

      {sensors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Camera className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Camera Sensors Found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Add camera sensors from the Sensors page to start visual monitoring of your solar panels
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Sensor Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Camera Sensor</CardTitle>
              <CardDescription>
                Choose a camera sensor to view its monitoring data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedSensor} onValueChange={setSelectedSensor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a camera sensor" />
                </SelectTrigger>
                <SelectContent>
                  {sensors.map((sensor) => (
                    <SelectItem key={sensor.id} value={sensor.id}>
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        {sensor.sensor_name} - {sensor.device_id}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Selected Sensor Info */}
          {selectedSensor && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      {sensors.find(s => s.id === selectedSensor)?.sensor_name}
                    </CardTitle>
                    <CardDescription>
                      Device ID: {sensors.find(s => s.id === selectedSensor)?.device_id}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={getStatusColor(sensors.find(s => s.id === selectedSensor)?.status || "offline")}
                  >
                    {getStatusIcon(sensors.find(s => s.id === selectedSensor)?.status || "offline")}
                    <span className="ml-2 capitalize">
                      {sensors.find(s => s.id === selectedSensor)?.status}
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center bg-muted rounded-lg p-8">
                    <div className="text-center">
                      <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Video feed integration coming soon
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Connect your IoT gateway to stream live video from this sensor
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sensor Readings */}
          {selectedSensor && readings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Captures</CardTitle>
                <CardDescription>
                  Latest readings from the selected camera sensor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {readings.map((reading) => (
                    <div
                      key={reading.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Camera className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(reading.timestamp).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {reading.value} {reading.unit}
                          </p>
                        </div>
                      </div>
                      {reading.metadata?.image_url && (
                        <Badge variant="outline">Has Image</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default VisualMonitoring;
