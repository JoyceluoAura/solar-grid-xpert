import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Thermometer, Cloud, Zap, Battery, CheckCircle2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const TestingDiagnostics = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const runDiagnostics = async () => {
    setTesting(true);
    toast.info("Running comprehensive diagnostics...");

    // Simulate diagnostic tests
    setTimeout(() => {
      setTestResults({
        temperatureDerating: {
          status: "warning",
          efficiency: 92.3,
          recommendation: "Panel temperature is slightly elevated. Consider improving ventilation.",
        },
        dustShading: {
          status: "good",
          cleanliness: 95,
          recommendation: "Panels are clean. Maintain regular cleaning schedule.",
        },
        stringPerformance: {
          status: "good",
          balance: 98,
          recommendation: "All strings performing within normal parameters.",
        },
        batteryEfficiency: {
          status: "warning",
          cycleHealth: 87,
          recommendation: "Battery showing minor degradation. Monitor cycle count.",
        },
        weatherImpact: {
          status: "good",
          correlation: 94,
          recommendation: "Weather predictions align well with actual performance.",
        },
      });
      setTesting(false);
      toast.success("Diagnostics complete!");
    }, 2000);
  };

  const getStatusIcon = (status: string) => {
    if (status === "good") return <CheckCircle2 className="w-5 h-5 text-eco-green" />;
    if (status === "warning") return <AlertTriangle className="w-5 h-5 text-solar-orange" />;
    return <AlertTriangle className="w-5 h-5 text-destructive" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
            Testing & Diagnostics
          </h1>
          <p className="text-muted-foreground">Advanced system analysis and performance testing</p>
        </div>

        {/* Test Launcher */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-solar-orange" />
              Run Comprehensive Diagnostics
            </CardTitle>
            <CardDescription>
              Analyze panel performance, battery health, and environmental impacts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={runDiagnostics}
              disabled={testing}
              className="gradient-energy text-white w-full md:w-auto"
            >
              <FlaskConical className="w-4 h-4 mr-2" />
              {testing ? "Running Tests..." : "Start Diagnostic Tests"}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Temperature Derating Test */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Thermometer className="w-5 h-5 text-solar-orange" />
                    Temperature Derating
                  </CardTitle>
                  {getStatusIcon(testResults.temperatureDerating.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Panel Efficiency</span>
                    <span className="font-semibold">{testResults.temperatureDerating.efficiency}%</span>
                  </div>
                  <Progress value={testResults.temperatureDerating.efficiency} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {testResults.temperatureDerating.recommendation}
                </p>
              </CardContent>
            </Card>

            {/* Dust & Shading Analysis */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Cloud className="w-5 h-5 text-energy-blue" />
                    Dust & Shading Analysis
                  </CardTitle>
                  {getStatusIcon(testResults.dustShading.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cleanliness Score</span>
                    <span className="font-semibold">{testResults.dustShading.cleanliness}%</span>
                  </div>
                  <Progress value={testResults.dustShading.cleanliness} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {testResults.dustShading.recommendation}
                </p>
              </CardContent>
            </Card>

            {/* String Performance Check */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="w-5 h-5 text-solar-orange" />
                    String Performance
                  </CardTitle>
                  {getStatusIcon(testResults.stringPerformance.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance Score</span>
                    <span className="font-semibold">{testResults.stringPerformance.balance}%</span>
                  </div>
                  <Progress value={testResults.stringPerformance.balance} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {testResults.stringPerformance.recommendation}
                </p>
              </CardContent>
            </Card>

            {/* Battery Cycle Efficiency */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Battery className="w-5 h-5 text-eco-green" />
                    Battery Cycle Efficiency
                  </CardTitle>
                  {getStatusIcon(testResults.batteryEfficiency.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cycle Health</span>
                    <span className="font-semibold">{testResults.batteryEfficiency.cycleHealth}%</span>
                  </div>
                  <Progress value={testResults.batteryEfficiency.cycleHealth} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {testResults.batteryEfficiency.recommendation}
                </p>
              </CardContent>
            </Card>

            {/* Weather Impact Simulation */}
            <Card className="shadow-card md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Cloud className="w-5 h-5 text-energy-blue" />
                    Weather Impact Analysis
                  </CardTitle>
                  {getStatusIcon(testResults.weatherImpact.status)}
                </div>
                <CardDescription>
                  Correlation between weather forecasts and actual performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prediction Accuracy</span>
                    <span className="font-semibold">{testResults.weatherImpact.correlation}%</span>
                  </div>
                  <Progress value={testResults.weatherImpact.correlation} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {testResults.weatherImpact.recommendation}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Recommendations */}
        {testResults && (
          <Card className="shadow-card border-solar-orange/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🧠 AI-Generated Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-semibold mb-2">Optimization Opportunity</p>
                <p className="text-sm text-muted-foreground">
                  Based on the diagnostic results, your system is performing well overall. Consider scheduling a maintenance check for the battery system within the next month to prevent efficiency loss. Panel ventilation could be improved to reduce temperature derating effects.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-semibold mb-2">Predicted Performance</p>
                <p className="text-sm text-muted-foreground">
                  Weather data suggests favorable conditions for the next 7 days. Expected generation increase of 18% compared to this week. No maintenance actions required at this time.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestingDiagnostics;