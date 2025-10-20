import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import KPICard from "@/components/KPICard";
import { Zap, Battery, TrendingUp, AlertTriangle, MapPin, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Site {
  id: string;
  site_name: string;
  address: string;
  latitude: number;
  longitude: number;
  system_size_kwp: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for 30-day forecast
  const forecastData = Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${i + 1}`,
    generation: Math.floor(Math.random() * 50) + 80,
    consumption: Math.floor(Math.random() * 40) + 60,
  }));

  useEffect(() => {
    fetchSites();
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
                    onClick={() => navigate("/monitor")}
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
