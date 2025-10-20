import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sun, Zap, TrendingUp, MapPin } from "lucide-react";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-panel-bg">
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
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Monitor & Optimize Your{" "}
              <span className="bg-gradient-to-r from-energy-blue via-solar-orange to-eco-green bg-clip-text text-transparent">
                Solar Energy Systems
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional platform for solar energy evaluation, real-time monitoring, and intelligent forecasting
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="gradient-energy text-white px-8 py-6 text-lg shadow-elevated hover:shadow-xl transition-all"
            >
              Get Started
              <Zap className="w-5 h-5 ml-2" />
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg border-2 border-primary hover:bg-primary/10"
            >
              Sign In
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 pt-16">
            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border">
              <div className="w-14 h-14 rounded-xl gradient-solar flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Site Evaluation</h3>
              <p className="text-muted-foreground">
                Calculate solar potential with interactive maps and weather data integration
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border">
              <div className="w-14 h-14 rounded-xl gradient-energy flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-Time Monitoring</h3>
              <p className="text-muted-foreground">
                Track performance metrics and system health with live data visualization
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all border border-border">
              <div className="w-14 h-14 rounded-xl gradient-eco flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Forecasting</h3>
              <p className="text-muted-foreground">
                AI-powered predictions based on historical weather and performance data
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
