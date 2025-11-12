import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import KPICard from "@/components/KPICard";
import { Zap, Battery, TrendingUp, AlertTriangle, MapPin, Plus, XCircle, Camera, ChevronRight, Activity, Thermometer } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getFallbackSensors } from "@/lib/mockSensors";

interface Site {
  id: string;
  site_name: string;
  address: string;
  latitude: number;
  longitude: number;
  system_size_kwp: number;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  site_name: string;
  site_location: string;
  defect_type: string;
  image_url: string;
  created_at: string;
}

interface Sensor {
  id: string;
  sensor_name: string;
  sensor_type: string;
  protocol: string;
  status: string;
  device_id: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for 30-day forecast
  const forecastData = Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${i + 1}`,
    generation: Math.floor(Math.random() * 50) + 80,
    consumption: Math.floor(Math.random() * 40) + 60,
  }));

  useEffect(() => {
    fetchSites();
    fetchSensors();
    fetchActionItems();
  }, [user]);

  const fetchSites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSites(data || []);
    } catch (error: any) {
      toast.error("Failed to load sites");
      console.error(error);
    } finally {
      setLoading(false);
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
      console.error("Failed to load sensors:", error);
      setSensors(getFallbackSensors());
    }
  };

  const fetchActionItems = async () => {
    if (!user) return;

    try {
      // Fetch high and critical severity alerts as action items
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .in("severity", ["critical", "high"])
        .eq("is_resolved", false)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      // Map alerts to action items format
      const mappedItems = (data || []).map(alert => ({
        id: alert.id,
        title: alert.message,
        description: alert.message,
        severity: alert.severity,
        status: alert.is_resolved ? "closed" : "open",
        site_name: "Site",
        site_location: "Location",
        defect_type: alert.alert_type,
        image_url: "",
        created_at: alert.created_at
      }));

      setActionItems(mappedItems);
    } catch (error: any) {
      console.error("Failed to load action items:", error);
    }
  };

  const getSeverityColor = (severity: string) => {
    return severity === "critical"
      ? "bg-red-500 text-white"
      : "bg-orange-500 text-white";
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

  const getSensorTypeColor = (type: string) => {
    switch (type) {
      case "battery":
        return "text-green-600 bg-green-50 border-green-200";
      case "inverter":
      case "voltage":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "temperature":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "camera":
        return "text-purple-600 bg-purple-50 border-purple-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground">Real-time solar system performance overview</p>
          </div>
          <Button onClick={() => navigate("/add-site")} className="gradient-energy text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Site
          </Button>
        </div>

        {/* Connected Sensors Summary */}
        {sensors.length > 0 && (
          <Card className="shadow-card border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Connected Sensors ({sensors.length})
              </CardTitle>
              <CardDescription>IoT devices monitoring your solar installations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {sensors.map((sensor) => {
                  const Icon = getSensorIcon(sensor.sensor_type);
                  const colorClass = getSensorTypeColor(sensor.sensor_type);
                  return (
                    <div
                      key={sensor.id}
                      className={`p-3 rounded-lg border ${colorClass} hover:shadow-md transition-all cursor-pointer`}
                      onClick={() => navigate("/sensors")}
                    >
                      <div className="flex flex-col items-center text-center gap-2">
                        <Icon className="w-6 h-6" />
                        <div>
                          <p className="text-xs font-semibold truncate">{sensor.sensor_name}</p>
                          <p className="text-xs capitalize opacity-75">
                            {sensor.sensor_type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/sensors")}
                >
                  View All Sensors
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* High Severity Action Items */}
        {actionItems.length > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <XCircle className="w-6 h-6" />
                  High Priority Action Items
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/panel-analysis")}
                >
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <CardDescription>Defects detected by AI analysis requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border bg-white dark:bg-gray-900 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate("/panel-analysis")}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={getSeverityColor(item.severity)}>
                            {item.severity.toUpperCase()}
                          </Badge>
                          {item.defect_type && (
                            <Badge variant="outline" className="capitalize">
                              {item.defect_type.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>

                        <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{item.description}</p>

                        {item.site_name && (
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{item.site_name}</span>
                            </div>
                            {item.image_url && (
                              <div className="flex items-center space-x-1">
                                <Camera className="w-3 h-3" />
                                <span>Image available</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {actionItems.length >= 5 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => navigate("/panel-analysis")}>
                    View More Action Items
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sites List */}
        {sites.length > 0 ? (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-solar-orange" />
                Your Sites
              </CardTitle>
              <CardDescription>Manage and monitor your solar installations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className="p-4 rounded-xl border border-border hover:border-primary hover:shadow-card transition-all cursor-pointer"
                    onClick={() => navigate("/sensors")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg gradient-solar flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{site.site_name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{site.address}</p>
                        {site.system_size_kwp && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {site.system_size_kwp} kWp
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <MapPin className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Sites Yet</h3>
              <p className="text-muted-foreground text-center mb-6">
                Add your first solar site to start monitoring and forecasting
              </p>
              <Button onClick={() => navigate("/add-site")} className="gradient-energy text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Site
              </Button>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="PV Generation Today"
            value="142.5"
            unit="kWh"
            change="+12.3%"
            icon={Zap}
            trend="up"
            gradient="solar"
          />
          <KPICard
            title="Load Consumption"
            value="98.7"
            unit="kWh"
            change="-5.2%"
            icon={TrendingUp}
            trend="down"
            gradient="energy"
          />
          <KPICard
            title="Battery SoC"
            value="87"
            unit="%"
            change="+2%"
            icon={Battery}
            trend="up"
            gradient="eco"
          />
          <KPICard
            title="Active Alerts"
            value="2"
            unit="warnings"
            icon={AlertTriangle}
            trend="neutral"
            gradient="energy"
          />
        </div>

        {/* AI Summary */}
        <Card className="shadow-card border-solar-orange/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🧠 AI Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-gradient-to-r from-solar-orange/10 to-energy-blue/10 border border-border">
                <p className="text-sm font-semibold mb-2">Weekly Forecast</p>
                <p className="text-sm text-muted-foreground">
                  Predicted output for next week: <strong className="text-foreground">18% higher</strong> due to reduced cloud cover and optimal temperatures. Expected generation: 1,245 kWh.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-semibold mb-2">System Health</p>
                <p className="text-sm text-muted-foreground">
                  All systems operating normally. Battery health at 87%. Consider scheduling maintenance for optimal performance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 30-Day Forecast Chart */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-solar-orange" />
              30-Day Energy Forecast
            </CardTitle>
            <CardDescription>Predicted generation vs consumption over the next month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  interval={4}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="generation"
                  stroke="hsl(var(--solar-orange))"
                  strokeWidth={3}
                  name="Generation (kWh)"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="consumption"
                  stroke="hsl(var(--energy-blue))"
                  strokeWidth={3}
                  name="Consumption (kWh)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
            <CardDescription>Daily performance ratio and system efficiency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Performance Ratio</p>
                <p className="text-3xl font-bold text-foreground">94.2%</p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="gradient-eco h-2 rounded-full" style={{ width: "94.2%" }} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">System Efficiency</p>
                <p className="text-3xl font-bold text-foreground">89.5%</p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="gradient-energy h-2 rounded-full" style={{ width: "89.5%" }} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Panel Temperature</p>
                <p className="text-3xl font-bold text-foreground">38°C</p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="gradient-solar h-2 rounded-full" style={{ width: "76%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
