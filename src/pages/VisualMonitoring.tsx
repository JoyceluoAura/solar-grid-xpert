import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { solarIssueService, SolarIssue, IssueType } from "@/services/solarIssues";
import { nasaPowerService } from "@/services/nasaPower";
import { formatJakartaDateTime } from "@/lib/utils";
import { getFallbackSensors } from "@/lib/mockSensors";

interface Sensor {
  id: string;
  sensor_name: string;
  sensor_type: string;
  status: string;
  device_id: string;
  description?: string;
}

const VisualMonitoring = () => {
  const { user } = useAuth();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [solarIssues, setSolarIssues] = useState<SolarIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);

  const siteParams = {
    lat: -6.2088,
    lon: 106.8456,
  };

  useEffect(() => {
    if (user) {
      fetchCameraSensors();
      fetchSolarIssues();
    }
  }, [user]);

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

  const fetchSolarIssues = async () => {
    try {
      setIssuesLoading(true);
      const weather = await nasaPowerService.fetchWeatherData({
        latitude: siteParams.lat,
        longitude: siteParams.lon,
      });
      const issues = solarIssueService.generateSiteIssues('SGX-IND-001', weather, 6);
      setSolarIssues(issues);
    } catch (error) {
      console.error("Failed to fetch solar issues:", error);
      toast.error("Failed to load visual monitoring data");
    } finally {
      setIssuesLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "low":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      default:
        return "bg-green-500/10 text-green-600 border-green-500/20";
    }
  };

  const getSeverityIcon = (severity: string) => {
    return severity === "critical" || severity === "high" ? (
      <AlertTriangle className="w-4 h-4" />
    ) : (
      <CheckCircle2 className="w-4 h-4" />
    );
  };

  const selectedSensorDetails = sensors.find(s => s.id === selectedSensor);

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
          Real-time video monitoring of solar panel conditions and defect detection
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
                Choose a camera sensor to view detected issues from its feed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select value={selectedSensor} onValueChange={setSelectedSensor}>
                  <SelectTrigger className="flex-1">
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
                {selectedSensorDetails && (
                  <Badge
                    variant="outline"
                    className={selectedSensorDetails.status === "online" 
                      ? "bg-green-500/10 text-green-600 border-green-500/20" 
                      : "bg-red-500/10 text-red-600 border-red-500/20"
                    }
                  >
                    {selectedSensorDetails.status === "online" ? (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 mr-1" />
                    )}
                    {selectedSensorDetails.status}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detected Issues with Videos */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Detected Solar Panel Issues</h2>
            {issuesLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Loading detected issues...</span>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {solarIssues.map((issue) => (
                  <Card key={issue.id} className="overflow-hidden">
                    <div className="relative aspect-video bg-muted">
                      <img
                        src={issue.posterUrl}
                        alt={`Solar panel - ${issue.type}`}
                        className="w-full h-full object-cover"
                      />
                      {issue.is_live && (
                        <Badge className="absolute top-2 left-2 bg-red-600 text-white">
                          <span className="animate-pulse mr-1">●</span> LIVE
                        </Badge>
                      )}
                    </div>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{issue.name}</CardTitle>
                        <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                          {getSeverityIcon(issue.severity)}
                          <span className="ml-1 capitalize">{issue.severity}</span>
                        </Badge>
                      </div>
                      <CardDescription>{issue.location}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">Energy Loss</p>
                          <p className="font-semibold">{issue.energy_loss_percent}%</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">AI Confidence</p>
                          <p className="font-semibold">{Math.round(issue.confidence * 100)}%</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">Daily Loss</p>
                          <p className="font-semibold">{issue.predicted_kwh_loss} kWh</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">Priority</p>
                          <p className="font-semibold capitalize">{issue.dispatch_priority}</p>
                        </div>
                      </div>

                      {issue.has_sensor_error && issue.error_message && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-600">
                          <p className="font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Sensor Error
                          </p>
                          <p className="text-xs mt-1">{issue.error_message}</p>
                        </div>
                      )}

                      {issue.needs_recheck && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm text-yellow-600">
                          <p className="font-semibold">⚠️ Needs Manual Verification</p>
                          <p className="text-xs mt-1">AI confidence below 70% - manual inspection recommended</p>
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Sensor Data</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div><span className="text-muted-foreground">Panel Temp:</span> {issue.sensor_data.panel_temp}°C</div>
                          <div><span className="text-muted-foreground">Ambient:</span> {issue.sensor_data.ambient_temp}°C</div>
                          <div><span className="text-muted-foreground">Irradiance:</span> {issue.sensor_data.irradiance} W/m²</div>
                          <div><span className="text-muted-foreground">Power:</span> {issue.sensor_data.power_output} W</div>
                        </div>
                      </div>

                      <div className="space-y-1 pt-2 border-t">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Recommended Actions</p>
                        <ul className="text-xs space-y-1">
                          {issue.recommended_actions.slice(0, 2).map((action, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-muted-foreground mt-0.5">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <p className="text-xs text-muted-foreground pt-1">
                        Detected: {formatJakartaDateTime(issue.detected_at)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VisualMonitoring;
