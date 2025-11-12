import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sun, Zap, TrendingUp, MapPin, Cloud, Activity, BarChart3, Wifi, Camera, Network, Database } from "lucide-react";
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
              Turn Uncertainty Into{" "}
              <span className="bg-gradient-to-r from-energy-blue via-solar-orange to-eco-green bg-clip-text text-transparent">
                Energy Reliability
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              A smart unified solar management system powered by IoT, 5G, and AI — featuring multi-device connectivity, AI vision detection, and real-time analytics.
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

        {/* About SolarGridX Section */}
        <div className="max-w-7xl mx-auto mb-24">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-solar-orange via-energy-blue to-eco-green bg-clip-text text-transparent">
              About SolarGridX
            </h2>
            <p className="text-2xl text-muted-foreground max-w-4xl mx-auto">
              A smart unified solar management system that turns uncertainty into energy reliability — powered by{" "}
              <span className="font-semibold text-foreground">IoT, 5G, and AI</span>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-card to-muted/20 border border-border shadow-card hover:shadow-elevated transition-all">
              <div className="w-24 h-24 rounded-2xl gradient-solar flex items-center justify-center mx-auto shadow-elevated">
                <Network className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold">Multi-IoT Device Connection</h3>
              <p className="text-muted-foreground">
                Connect multiple sensors via MQTT, Modbus, and REST APIs with support for normal, low power, and offline modes to ensure reliable data collection
              </p>
            </div>

            <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-card to-muted/20 border border-border shadow-card hover:shadow-elevated transition-all">
              <div className="w-24 h-24 rounded-2xl gradient-energy flex items-center justify-center mx-auto shadow-elevated">
                <Camera className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold">AI Vision Detection</h3>
              <p className="text-muted-foreground">
                Automated panel inspection using computer vision to detect cracks, soiling, hotspots, and other defects for proactive maintenance
              </p>
            </div>

            <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-card to-muted/20 border border-border shadow-card hover:shadow-elevated transition-all">
              <div className="w-24 h-24 rounded-2xl gradient-eco flex items-center justify-center mx-auto shadow-elevated">
                <BarChart3 className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold">Real-time Analytics Powered by AI</h3>
              <p className="text-muted-foreground">
                Random Forest Regressor models analyze system health, predict failures, and calculate weather impact with fault probability indicators
              </p>
            </div>
          </div>
        </div>

        {/* Live Demo Preview */}
        <div className="max-w-6xl mx-auto mb-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Live Demo Preview</h2>
            <p className="text-xl text-muted-foreground">
              Experience the platform with real-time data from Bogor Solar Site
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Powered by NASA POWER API • Off-grid supported with normal, low power, and offline modes
            </p>
          </div>
          <div className="rounded-2xl border-2 border-border shadow-elevated bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/30 p-4 flex gap-2">
              <div className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                AI Analysis
              </div>
              <div className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">
                IoT Sensors
              </div>
              <div className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">
                Visual Monitoring
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2 p-4 rounded-lg bg-gradient-to-br from-solar-orange/10 to-transparent border border-solar-orange/20">
                  <div className="text-sm text-muted-foreground">System Health</div>
                  <div className="text-4xl font-bold text-solar-orange">71.4</div>
                  <div className="text-sm text-amber-500">Needs attention</div>
                </div>
                <div className="space-y-2 p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20">
                  <div className="text-sm text-muted-foreground">kWh Loss (7d)</div>
                  <div className="text-4xl font-bold text-red-500">521.3</div>
                  <div className="text-sm text-red-400">37.2% efficiency drop</div>
                </div>
                <div className="space-y-2 p-4 rounded-lg bg-gradient-to-br from-energy-blue/10 to-transparent border border-energy-blue/20">
                  <div className="text-sm text-muted-foreground">AI Confidence</div>
                  <div className="text-4xl font-bold text-energy-blue">92.5%</div>
                  <div className="text-sm text-eco-green">High accuracy • 24h data</div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="text-sm font-semibold mb-3">AI Performance Insights</div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-500">●</span>
                    <span>System performing below expected baseline for current weather conditions</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-eco-green">●</span>
                    <span>Optimal cleaning window detected in next 48 hours - potential +12% efficiency gain</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-energy-blue">●</span>
                    <span>Weather pattern analysis suggests increased output (+8%) over next 3 days</span>
                  </div>
                </div>
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
                <Database className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">🔮 Random Forest Predictions</h3>
              <p className="text-muted-foreground">
                ML-powered fault probability and battery health indicators
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border group">
              <div className="w-14 h-14 rounded-xl gradient-energy flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Cloud className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">🌍 NASA POWER API</h3>
              <p className="text-muted-foreground">
                Real-time irradiance, temperature, and weather data
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border group">
              <div className="w-14 h-14 rounded-xl gradient-eco flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Activity className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">⚡ Off-Grid Support</h3>
              <p className="text-muted-foreground">
                Normal, low power, and offline modes with local caching
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">👁️ Visual Inspection</h3>
              <p className="text-muted-foreground">
                AI-powered defect detection for solar panels
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
