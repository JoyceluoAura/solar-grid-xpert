import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Battery,
  BatteryLow,
  BatteryWarning,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Gauge,
  ThermometerSun,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Site {
  id: string;
  name: string;
  location: string;
  connection_status: "online" | "low_power" | "offline";
  power_mode: string;
  battery_level: number;
  last_heartbeat_at: string;
}

interface SensorReading {
  id: string;
  sensor_id: string;
  value: number;
  unit: string;
  timestamp: string;
  metadata: any;
  sensors: {
    sensor_name: string;
    sensor_type: string;
  };
}

interface Alert {
  id: string;
  alert_type: string;
  message: string;
  severity: string;
  created_at: string;
  is_resolved: boolean;
}

const RealTimeMonitor = () => {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSites();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSite) {
      fetchReadings(selectedSite.id);
      fetchAlerts(selectedSite.id);
    }
  }, [selectedSite]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (selectedSite) {
        fetchReadings(selectedSite.id);
        fetchAlerts(selectedSite.id);
      }
      fetchSites();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedSite]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!selectedSite) return;

    const channel = supabase
      .channel(`site-${selectedSite.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sensor_readings",
          filter: `sensor_id=in.(select id from sensors where site_id=eq.${selectedSite.id})`,
        },
        (payload) => {
          console.log("New reading:", payload);
          fetchReadings(selectedSite.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `site_id=eq.${selectedSite.id}`,
        },
        (payload) => {
          console.log("New alert:", payload);
          fetchAlerts(selectedSite.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSite]);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("name");

      if (error) throw error;

      setSites(data || []);
      if (data && data.length > 0 && !selectedSite) {
        setSelectedSite(data[0]);
      }
    } catch (error: any) {
      console.error("Error fetching sites:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReadings = async (siteId: string) => {
    try {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("*, sensors(sensor_name, sensor_type)")
        .in(
          "sensor_id",
          supabase.from("sensors").select("id").eq("site_id", siteId)
        )
        .order("timestamp", { ascending: false })
        .limit(20);

      if (error) throw error;
      setReadings(data || []);
    } catch (error: any) {
      console.error("Error fetching readings:", error);
    }
  };

  const fetchAlerts = async (siteId: string) => {
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("site_id", siteId)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error: any) {
      console.error("Error fetching alerts:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "low_power":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "offline":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <WifiOff className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "low_power":
        return "bg-yellow-500";
      case "offline":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getBatteryIcon = (level: number) => {
    if (level > 50) return <Battery className="h-5 w-5 text-green-500" />;
    if (level > 20) return <BatteryLow className="h-5 w-5 text-yellow-500" />;
    return <BatteryWarning className="h-5 w-5 text-red-500" />;
  };

  const getTimeSince = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 minute ago";
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Activity className="h-8 w-8" />
            <span>Real-Time Monitoring</span>
          </h1>
          <p className="text-muted-foreground">
            Monitor off-grid sites with intelligent operational modes
          </p>
        </div>

        <Button
          variant={autoRefresh ? "default" : "outline"}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
          {autoRefresh ? "Auto-Refreshing" : "Refresh Paused"}
        </Button>
      </div>

      {/* Sites Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sites.map((site) => (
          <Card
            key={site.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedSite?.id === site.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedSite(site)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{site.name}</CardTitle>
                {getStatusIcon(site.connection_status)}
              </div>
              <CardDescription>{site.location}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge className={getStatusColor(site.connection_status)}>
                  {site.power_mode || site.connection_status}
                </Badge>

                {site.battery_level !== null && (
                  <div className="flex items-center space-x-2">
                    {getBatteryIcon(site.battery_level)}
                    <Progress value={site.battery_level} className="flex-1" />
                    <span className="text-sm font-medium">{site.battery_level}%</span>
                  </div>
                )}

                {site.last_heartbeat_at && (
                  <p className="text-xs text-muted-foreground">
                    {getTimeSince(site.last_heartbeat_at)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Site Details */}
      {selectedSite && (
        <Tabs defaultValue="readings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="readings">Sensor Readings</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts {alerts.length > 0 && `(${alerts.length})`}
            </TabsTrigger>
            <TabsTrigger value="details">Site Details</TabsTrigger>
          </TabsList>

          <TabsContent value="readings">
            <Card>
              <CardHeader>
                <CardTitle>Latest Sensor Readings</CardTitle>
                <CardDescription>
                  Real-time data from {selectedSite.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {readings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No readings available
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sensor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {readings.map((reading) => (
                        <TableRow key={reading.id}>
                          <TableCell className="font-medium">
                            {reading.sensors?.sensor_name || "Unknown"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {reading.sensors?.sensor_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono">
                              {reading.value} {reading.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getTimeSince(reading.timestamp)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>Unresolved alerts for {selectedSite.name}</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No active alerts</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border ${
                          alert.severity === "critical"
                            ? "bg-red-50 border-red-200 dark:bg-red-950"
                            : alert.severity === "warning"
                            ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950"
                            : "bg-blue-50 border-blue-200 dark:bg-blue-950"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-2">
                            {alert.severity === "critical" ? (
                              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                            ) : alert.severity === "warning" ? (
                              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                            ) : (
                              <Activity className="h-5 w-5 text-blue-500 mt-0.5" />
                            )}
                            <div>
                              <p className="font-medium">{alert.message}</p>
                              <p className="text-sm text-muted-foreground">
                                {getTimeSince(alert.created_at)}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              alert.severity === "critical"
                                ? "border-red-500 text-red-500"
                                : alert.severity === "warning"
                                ? "border-yellow-500 text-yellow-500"
                                : "border-blue-500 text-blue-500"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Site Details</CardTitle>
                <CardDescription>{selectedSite.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusIcon(selectedSite.connection_status)}
                        <span className="text-lg font-semibold capitalize">
                          {selectedSite.connection_status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Power Mode</h3>
                      <p className="text-lg font-semibold capitalize mt-1">
                        {selectedSite.power_mode || "Normal"}
                      </p>
                    </div>

                    {selectedSite.battery_level !== null && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Battery Level
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          {getBatteryIcon(selectedSite.battery_level)}
                          <span className="text-lg font-semibold">
                            {selectedSite.battery_level}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Location</h3>
                      <p className="text-lg font-semibold mt-1">{selectedSite.location}</p>
                    </div>

                    {selectedSite.last_heartbeat_at && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Last Heartbeat
                        </h3>
                        <p className="text-lg font-semibold mt-1">
                          {getTimeSince(selectedSite.last_heartbeat_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(selectedSite.last_heartbeat_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operational Modes Info */}
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-3">Operational Modes</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <span className="font-medium">Normal: </span>
                        Real-time cloud sync every 5 seconds
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <div>
                        <span className="font-medium">Low Power: </span>
                        Reduced transmission (60s) to conserve energy
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                      <div>
                        <span className="font-medium">Offline: </span>
                        Local caching with automatic re-upload on recovery
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default RealTimeMonitor;
