import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sun, Zap, TrendingUp, MapPin, Cloud, Activity, BarChart3, Wifi } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

const Welcome = () => {
  const navigate = useNavigate();

  // Mock data for demo preview
  const mockData = Array.from({ length: 20 }, (_, i) => ({
    name: i,
    pv: Math.random() * 40 + 60,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-panel-bg to-background">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded-xl gradient-solar flex items-center justify-center">
            <Sun className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
            SolarGridX
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto mb-24">
          <div className="space-y-8">
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Monitor, Predict & Optimize Your{" "}
              <span className="bg-gradient-to-r from-energy-blue via-solar-orange to-eco-green bg-clip-text text-transparent">
                Solar Energy Systems
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              From weather forecasts to IoT sensor data — all in one intelligent platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => navigate("/auth")}
                size="lg"
                className="gradient-energy text-white px-8 py-6 text-lg shadow-elevated hover:shadow-xl transition-all"
              >
                🚀 Get Started
                <Zap className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={() => navigate("/auth")}
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg border-2 border-primary hover:bg-primary/10"
              >
                🔑 Sign In
              </Button>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="relative">
            <div className="rounded-2xl border-2 border-border shadow-elevated bg-card p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">PV Output (kW)</span>
                  <span className="text-2xl font-bold text-solar-orange">62.4</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={mockData}>
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Line
                      type="monotone"
                      dataKey="pv"
                      stroke="hsl(var(--solar-orange))"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded bg-muted/50">
                    <div className="text-xs text-muted-foreground">Battery</div>
                    <div className="text-lg font-bold text-eco-green">87%</div>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <div className="text-xs text-muted-foreground">Efficiency</div>
                    <div className="text-lg font-bold text-energy-blue">94%</div>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="text-lg font-bold text-eco-green">●</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -z-10 inset-0 bg-gradient-to-br from-solar-orange/20 to-energy-blue/20 blur-3xl" />
          </div>
        </div>

        {/* How It Works Section */}
        <div className="max-w-6xl mx-auto mb-24">
          <h2 className="text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-xl text-muted-foreground text-center mb-16">
            Three simple steps to optimize your solar energy
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl gradient-solar flex items-center justify-center mx-auto shadow-elevated">
                  <MapPin className="w-10 h-10 text-white" />
                </div>
                <div className="absolute top-10 left-1/2 w-full h-px bg-gradient-to-r from-solar-orange to-transparent hidden md:block" />
                <h3 className="text-2xl font-bold">1. Add Your Location</h3>
                <p className="text-muted-foreground">
                  Auto-detect via Google Maps or manually enter coordinates for precise analysis
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl gradient-energy flex items-center justify-center mx-auto shadow-elevated">
                  <Cloud className="w-10 h-10 text-white" />
                </div>
                <div className="absolute top-10 left-1/2 w-full h-px bg-gradient-to-r from-energy-blue to-transparent hidden md:block" />
                <h3 className="text-2xl font-bold">2. Analyze Weather Data</h3>
                <p className="text-muted-foreground">
                  View 2-year history and 30-day forecast using AI-powered prediction models
                </p>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl gradient-eco flex items-center justify-center mx-auto shadow-elevated">
                <Wifi className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold">3. Connect Sensors</h3>
              <p className="text-muted-foreground">
                Link your IoT devices for real-time monitoring and smart alerts
              </p>
            </div>
          </div>
        </div>

        {/* Live Demo Preview */}
        <div className="max-w-6xl mx-auto mb-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Live Demo Preview</h2>
            <p className="text-xl text-muted-foreground">
              Experience the platform with sample data from Bogor, Indonesia
            </p>
          </div>
          <div className="rounded-2xl border-2 border-border shadow-elevated bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/30 p-4 flex gap-2">
              <div className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                Weather
              </div>
              <div className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">
                Sensors
              </div>
              <div className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">
                Performance
              </div>
            </div>
            <div className="p-8 grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Today's Generation</div>
                <div className="text-3xl font-bold text-solar-orange">142.5 kWh</div>
                <div className="text-sm text-eco-green">+12.3% vs yesterday</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Weather Status</div>
                <div className="text-3xl font-bold">🌤️ Clear</div>
                <div className="text-sm text-muted-foreground">28°C, Low humidity</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Next 7 Days Forecast</div>
                <div className="text-3xl font-bold text-energy-blue">+18%</div>
                <div className="text-sm text-muted-foreground">Expected increase</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Powerful Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border group">
              <div className="w-14 h-14 rounded-xl gradient-solar flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Cloud className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">🌤️ Weather Intelligence</h3>
              <p className="text-muted-foreground">
                2-year historical data and 30-day AI forecasts
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border group">
              <div className="w-14 h-14 rounded-xl gradient-energy flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Wifi className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">🔌 IoT Connectivity</h3>
              <p className="text-muted-foreground">
                MQTT, Modbus, and HTTP API integration
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border group">
              <div className="w-14 h-14 rounded-xl gradient-eco flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Activity className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">📊 Real-Time Monitoring</h3>
              <p className="text-muted-foreground">
                Live dashboards with performance metrics
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">🧠 Smart Diagnostics</h3>
              <p className="text-muted-foreground">
                AI-powered analysis and recommendations
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t border-border">
        <p className="text-center text-sm text-muted-foreground">
          © 2025 SolarGridX. Professional solar energy management platform.
        </p>
      </footer>
    </div>
  );
};

export default Welcome;
