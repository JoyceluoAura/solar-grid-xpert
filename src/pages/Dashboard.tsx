import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import KPICard from "@/components/KPICard";
import { Zap, Battery, TrendingUp, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const Dashboard = () => {
  // Mock data for 30-day forecast
  const forecastData = Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${i + 1}`,
    generation: Math.floor(Math.random() * 50) + 80,
    consumption: Math.floor(Math.random() * 40) + 60,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">Real-time solar system performance overview</p>
        </div>

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
