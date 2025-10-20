import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, MapPin, Battery, Zap } from "lucide-react";
import { toast } from "sonner";

const Evaluate = () => {
  const [formData, setFormData] = useState({
    siteName: "",
    latitude: "",
    longitude: "",
    systemSize: "",
    panelEfficiency: "",
    tiltAngle: "",
    azimuth: "",
    dailyLoad: "",
    daysOfAutonomy: "",
  });

  const [results, setResults] = useState<{
    dailyGeneration: number;
    monthlyGeneration: number;
    batteryCapacity: number;
    inverterSize: number;
  } | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateResults = () => {
    // Simple mock calculation (would call NREL API in production)
    const systemSize = parseFloat(formData.systemSize) || 0;
    const panelEfficiency = (parseFloat(formData.panelEfficiency) || 100) / 100;
    const dailyLoad = parseFloat(formData.dailyLoad) || 0;
    const daysOfAutonomy = parseFloat(formData.daysOfAutonomy) || 0;

    const dailyGeneration = systemSize * 4.5 * panelEfficiency; // Assuming 4.5 peak sun hours
    const monthlyGeneration = dailyGeneration * 30;
    const batteryCapacity = dailyLoad * daysOfAutonomy * 1.2; // 20% buffer
    const inverterSize = systemSize * 1.1; // 10% oversizing

    setResults({
      dailyGeneration: Math.round(dailyGeneration * 10) / 10,
      monthlyGeneration: Math.round(monthlyGeneration * 10) / 10,
      batteryCapacity: Math.round(batteryCapacity * 10) / 10,
      inverterSize: Math.round(inverterSize * 10) / 10,
    });

    toast.success("Site evaluation complete!");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
            Evaluate Site
          </h1>
          <p className="text-muted-foreground">Calculate solar potential and system requirements</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-solar-orange" />
                Site Information
              </CardTitle>
              <CardDescription>Enter your site details for accurate evaluation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="siteName">Site Name</Label>
                <Input
                  id="siteName"
                  placeholder="e.g., Downtown Solar Farm"
                  value={formData.siteName}
                  onChange={(e) => handleInputChange("siteName", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    placeholder="e.g., 37.7749"
                    value={formData.latitude}
                    onChange={(e) => handleInputChange("latitude", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    placeholder="e.g., -122.4194"
                    value={formData.longitude}
                    onChange={(e) => handleInputChange("longitude", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="systemSize">System Size (kWp)</Label>
                  <Input
                    id="systemSize"
                    type="number"
                    placeholder="e.g., 50"
                    value={formData.systemSize}
                    onChange={(e) => handleInputChange("systemSize", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panelEfficiency">Panel Efficiency (%)</Label>
                  <Input
                    id="panelEfficiency"
                    type="number"
                    placeholder="e.g., 95"
                    value={formData.panelEfficiency}
                    onChange={(e) => handleInputChange("panelEfficiency", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tiltAngle">Tilt Angle (°)</Label>
                  <Input
                    id="tiltAngle"
                    type="number"
                    placeholder="e.g., 30"
                    value={formData.tiltAngle}
                    onChange={(e) => handleInputChange("tiltAngle", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="azimuth">Azimuth (°)</Label>
                  <Input
                    id="azimuth"
                    type="number"
                    placeholder="e.g., 180"
                    value={formData.azimuth}
                    onChange={(e) => handleInputChange("azimuth", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dailyLoad">Daily Load (kWh)</Label>
                  <Input
                    id="dailyLoad"
                    type="number"
                    placeholder="e.g., 200"
                    value={formData.dailyLoad}
                    onChange={(e) => handleInputChange("dailyLoad", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daysOfAutonomy">Days of Autonomy</Label>
                  <Input
                    id="daysOfAutonomy"
                    type="number"
                    placeholder="e.g., 2"
                    value={formData.daysOfAutonomy}
                    onChange={(e) => handleInputChange("daysOfAutonomy", e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={calculateResults} className="w-full gradient-energy text-white">
                <Calculator className="w-4 h-4 mr-2" />
                Calculate Potential
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-solar-orange" />
                Evaluation Results
              </CardTitle>
              <CardDescription>Estimated system performance and requirements</CardDescription>
            </CardHeader>
            <CardContent>
              {results ? (
                <div className="space-y-6">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-solar-orange/10 to-solar-orange/5 border border-solar-orange/20">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="w-5 h-5 text-solar-orange" />
                      <p className="text-sm font-medium text-muted-foreground">Daily Generation</p>
                    </div>
                    <p className="text-4xl font-bold text-foreground">{results.dailyGeneration} kWh</p>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-energy-blue/10 to-energy-blue/5 border border-energy-blue/20">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="w-5 h-5 text-energy-blue" />
                      <p className="text-sm font-medium text-muted-foreground">Monthly Generation</p>
                    </div>
                    <p className="text-4xl font-bold text-foreground">{results.monthlyGeneration} kWh</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-eco-green/10 to-eco-green/5 border border-eco-green/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Battery className="w-4 h-4 text-eco-green" />
                        <p className="text-xs font-medium text-muted-foreground">Battery Capacity</p>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{results.batteryCapacity} kWh</p>
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-br from-data-accent/10 to-data-accent/5 border border-data-accent/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-data-accent" />
                        <p className="text-xs font-medium text-muted-foreground">Inverter Size</p>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{results.inverterSize} kW</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Note:</strong> These are estimated values based on standard
                      assumptions. For production deployment, integrate with NREL PVWatts API for accurate solar
                      radiation data.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <MapPin className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No evaluation yet</p>
                  <p className="text-sm text-muted-foreground/80 mt-2">
                    Fill in the form and click "Calculate Potential" to see results
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Evaluate;
