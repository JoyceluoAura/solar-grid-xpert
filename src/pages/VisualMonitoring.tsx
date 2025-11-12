import { useState, useEffect, useMemo, useCallback } from "react";
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
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { openMeteoService, SolarDataPoint } from "@/services/openMeteo";
import { getFallbackSensors } from "@/lib/mockSensors";

interface Sensor {
  id: string;
  sensor_name: string;
  sensor_type: string;
  status: string;
  device_id: string;
  description?: string;
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
  const [solarData, setSolarData] = useState<SolarDataPoint[]>([]);
  const [solarLoading, setSolarLoading] = useState(true);

  const siteParams = {
    lat: -6.2088,
    lon: 106.8456,
    system_capacity: 100,
    tilt: 10,
    azimuth: 180,
  };

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

  useEffect(() => {
    fetchSolarPerformance();
  }, []);

  const buildFallbackCameraSensors = (): Sensor[] =>
    getFallbackSensors()
      .filter(sensor => sensor.sensor_type === "camera")
      .map(sensor => ({
        id: sensor.id,
        sensor_name: sensor.sensor_name,
        sensor_type: sensor.sensor_type,
        status: sensor.status,
        device_id: sensor.device_id,
        description: sensor.description,
      }));

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

      const resolvedSensors = (data && data.length > 0 ? data : buildFallbackCameraSensors()).map(sensor => ({
        ...sensor,
        status: sensor.status || "online",
      }));
      setSensors(resolvedSensors);
      if (resolvedSensors.length > 0) {
        setSelectedSensor(resolvedSensors[0].id);
      }
    } catch (error: any) {
      toast.error("Failed to load camera sensors");
      console.error(error);
      const fallback = buildFallbackCameraSensors();
      setSensors(fallback);
      if (fallback.length > 0) {
        setSelectedSensor(fallback[0].id);
      }
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

      if (data && data.length > 0) {
        setReadings(data);
        return;
      }

      if (solarData.length > 0) {
        setReadings(buildFallbackReadings(sensorId, solarData));
      }
    } catch (error: any) {
      console.error("Error fetching sensor readings:", error);
      if (solarData.length > 0) {
        setReadings(buildFallbackReadings(sensorId, solarData));
      }
    }
  };

  const fetchSolarPerformance = async () => {
    try {
      setSolarLoading(true);
      const data = await openMeteoService.fetchSolarData(siteParams);
      setSolarData(data);
    } catch (error) {
      console.error("Failed to load solar performance for visual monitoring", error);
    } finally {
      setSolarLoading(false);
    }
  };

  const buildFallbackReadings = useCallback((sensorId: string, data: SolarDataPoint[]): SensorReading[] => {
    return data
      .slice(-8)
      .reverse()
      .map((point, index) => ({
        id: `fallback-visual-${sensorId}-${index}`,
        sensor_id: sensorId,
        value: Number(point.ac_output.toFixed(2)),
        unit: "kW",
        timestamp: point.timestamp,
        metadata: {
          irradiance: Math.round(point.irradiance),
          ambient_temp: Number(point.ambient_temp.toFixed(1)),
          cell_temp: Number(point.cell_temp.toFixed(1)),
          description: `AC ${point.ac_output.toFixed(1)} kW • Irradiance ${Math.round(point.irradiance)} W/m² • Cell ${point.cell_temp.toFixed(1)}°C`,
        },
      }));
  }, []);

  const performanceData = useMemo(() => solarData.slice(-12), [solarData]);

  const latestPoint = performanceData.length > 0 ? performanceData[performanceData.length - 1] : null;
  const peakOutput = useMemo(
    () => performanceData.reduce((max, point) => Math.max(max, point.ac_output), 0),
    [performanceData]
  );
  const avgIrradiance = useMemo(
    () =>
      performanceData.length > 0
        ? performanceData.reduce((sum, point) => sum + point.irradiance, 0) / performanceData.length
        : 0,
    [performanceData]
  );
  const hasReadings = readings.length > 0;
  const selectedSensorDetails = useMemo(
    () => sensors.find(sensor => sensor.id === selectedSensor) ?? null,
    [sensors, selectedSensor]
  );

  useEffect(() => {
    if (!selectedSensor) return;
    if (hasReadings) return;
    if (solarData.length === 0) return;
    setReadings(buildFallbackReadings(selectedSensor, solarData));
  }, [selectedSensor, hasReadings, solarData, buildFallbackReadings]);

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
                      {selectedSensorDetails?.sensor_name}
                    </CardTitle>
                    <CardDescription>
                      Device ID: {selectedSensorDetails?.device_id}
                    </CardDescription>
                    {selectedSensorDetails?.description && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedSensorDetails.description}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={getStatusColor(selectedSensorDetails?.status || "offline")}
                  >
                    {getStatusIcon(selectedSensorDetails?.status || "offline")}
                    <span className="ml-2 capitalize">
                      {selectedSensorDetails?.status}
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="p-4 rounded-lg border bg-muted/40">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Output</p>
                      <p className="text-2xl font-semibold mt-2">
                        {latestPoint ? `${latestPoint.ac_output.toFixed(1)} kW` : "--"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {latestPoint ? new Date(latestPoint.timestamp).toLocaleTimeString() : "-"}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/40">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Peak Output (24h)</p>
                      <p className="text-2xl font-semibold mt-2">
                        {peakOutput ? `${peakOutput.toFixed(1)} kW` : "--"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        System capacity baseline {siteParams.system_capacity} kW
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/40">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Irradiance</p>
                      <p className="text-2xl font-semibold mt-2">
                        {avgIrradiance ? `${Math.round(avgIrradiance)} W/m²` : "--"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Direct correlation with visual anomaly detection
                      </p>
                    </div>
                  </div>

                  <div className="h-[260px]">
                    {solarLoading ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Loading solar performance...
                      </div>
                    ) : performanceData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceData}>
                          <defs>
                            <linearGradient id="visualAc" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                          <XAxis dataKey="hour" stroke="currentColor" opacity={0.6} />
                          <YAxis yAxisId="left" stroke="#2563eb" opacity={0.6} />
                          <YAxis yAxisId="right" orientation="right" stroke="#f97316" opacity={0.6} />
                          <Tooltip
                            formatter={(value: number | string, name: string) => {
                              const numeric = typeof value === "number" ? value : Number(value);
                              const label =
                                name === "irradiance"
                                  ? "Irradiance (W/m²)"
                                  : name === "ac_output"
                                  ? "AC Output (kW)"
                                  : name;
                              return [
                                Number.isFinite(numeric) ? numeric.toFixed(1) : String(value),
                                label,
                              ];
                            }}
                          />
                          <Area yAxisId="left" type="monotone" dataKey="ac_output" stroke="#2563eb" fill="url(#visualAc)" name="AC Output (kW)" />
                          <Area yAxisId="right" type="monotone" dataKey="irradiance" stroke="#f97316" fillOpacity={0} name="Irradiance (W/m²)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No solar performance data available
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center bg-muted rounded-lg p-6 text-center">
                    <div>
                      <Video className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        Live video stream pairs with the performance data to validate anomalies.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Connect your IoT gateway to stream the feed alongside these real-time solar metrics.
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
                          {reading.metadata?.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {reading.metadata.description}
                            </p>
                          )}
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
