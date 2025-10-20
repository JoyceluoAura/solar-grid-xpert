import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Thermometer, Battery, AlertTriangle, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const Monitor = () => {
  // Mock real-time data
  const realtimeData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    actual: Math.floor(Math.random() * 30) + 40,
    expected: Math.floor(Math.random() * 25) + 45,
  }));

  const currentMetrics = {
    acOutput: 62.4,
    expectedOutput: 68.2,
    performanceRatio: 91.5,
    panelTemp: 38.5,
    batterySoc: 87,
  };

  const alerts = [
    {
      id: 1,
      type: "warning",
      message: "Panel temperature slightly elevated",
      time: "2 hours ago",
    },
    {
      id: 2,
      type: "info",
      message: "Performance ratio below 95% threshold",
      time: "5 hours ago",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
            Real-Time Monitoring
          </h1>
          <p className="text-muted-foreground">Live system performance and operational data</p>
        </div>

        {/* Current Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg gradient-solar flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">AC Output</p>
              <p className="text-3xl font-bold text-foreground">{currentMetrics.acOutput}</p>
              <p className="text-xs text-muted-foreground">kW</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg gradient-energy flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Expected Output</p>
              <p className="text-3xl font-bold text-foreground">{currentMetrics.expectedOutput}</p>
              <p className="text-xs text-muted-foreground">kW</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg gradient-eco flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Performance Ratio</p>
              <p className="text-3xl font-bold text-foreground">{currentMetrics.performanceRatio}</p>
              <p className="text-xs text-muted-foreground">%</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Thermometer className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Panel Temp</p>
              <p className="text-3xl font-bold text-foreground">{currentMetrics.panelTemp}</p>
              <p className="text-xs text-muted-foreground">°C</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg gradient-eco flex items-center justify-center">
                  <Battery className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Battery SoC</p>
              <p className="text-3xl font-bold text-foreground">{currentMetrics.batterySoc}</p>
              <p className="text-xs text-muted-foreground">%</p>
            </CardContent>
          </Card>
        </div>

        {/* Real-Time Performance Chart */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-energy-blue" />
              24-Hour Performance
            </CardTitle>
            <CardDescription>Actual vs Expected power output throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={realtimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
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
                  dataKey="actual"
                  stroke="hsl(var(--solar-orange))"
                  strokeWidth={3}
                  name="Actual Output (kW)"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="hsl(var(--energy-blue))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Expected Output (kW)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-solar-orange" />
              System Alerts
            </CardTitle>
            <CardDescription>Recent warnings and notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
                      alert.type === "warning" ? "bg-solar-orange" : "bg-energy-blue"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{alert.message}</p>
                    <p className="text-sm text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Monitor;
