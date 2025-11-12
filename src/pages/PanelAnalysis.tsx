import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Battery,
  Gauge,
  BarChart3,
  AlertCircle,
  Info,
  Thermometer,
  Wind,
  Sun,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface AIAnalysisResult {
  site_id: string;
  predicted_output: number;
  actual_output: number;
  deviation: number;
  fault_prob: number;
  top_factors: string[];
  weather_impact_score: number;
  battery_health_score: number;
  performance_metrics: {
    temp_correction: number;
    soiling_factor: number;
    inverter_factor: number;
    irradiance_factor: number;
  };
  recommendations: Array<{
    priority: string;
    msg: string;
    action: string;
  }>;
}

interface SiteData {
  id: string;
  name: string;
  location: string;
  capacity_kwp: number;
}

const PanelAnalysis = () => {
  const { user } = useAuth();
  const [sites, setSites] = useState<SiteData[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Mock historical data for charts
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchSites();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSite) {
      fetchAnalysis();
      generateHistoricalData();
    }
  }, [selectedSite]);

  useEffect(() => {
    if (autoRefresh && selectedSite) {
      const interval = setInterval(() => {
        fetchAnalysis();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedSite]);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, location, capacity_kwp")
        .order("name");

      if (error) throw error;
      setSites(data || []);
      if (data && data.length > 0) {
        setSelectedSite(data[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching sites:", error);
    }
  };

  const fetchAnalysis = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      // Get current sensor readings from Supabase
      const { data: sensorData, error } = await supabase
        .from("sensor_readings")
        .select("*")
        .eq("site_id", selectedSite)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      // Mock data for demo (in production, use actual sensor data)
      const inputs = {
        irradiance: sensorData?.irradiance || 850 + Math.random() * 150,
        ambient_temp: sensorData?.ambient_temp || 28 + Math.random() * 8,
        panel_temp: sensorData?.panel_temp || 42 + Math.random() * 12,
        battery_soc: sensorData?.battery_soc || 65 + Math.random() * 25,
        inverter_eff: sensorData?.inverter_eff || 95 + Math.random() * 2,
        soiling_index: sensorData?.soiling_index || 2 + Math.random() * 4,
        tilt: 30,
        azimuth: 180,
        wind_speed: 2 + Math.random() * 3,
        pr_baseline: 0.80,
        system_capacity: sites.find(s => s.id === selectedSite)?.capacity_kwp || 100,
        actual_output: sensorData?.power || (850 + Math.random() * 150) * 0.06,
      };

      // Call AI Analysis Service
      const response = await fetch('http://localhost:5001/api/ai_analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: selectedSite,
          inputs
        })
      }).catch(() => {
        // Fallback to mock data if AI service is not available
        return {
          ok: false,
          json: async () => mockAnalysisResult(inputs)
        };
      });

      const result = response.ok
        ? await response.json()
        : mockAnalysisResult(inputs);

      setAnalysis(result);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching analysis:", error);
      // Use mock data on error
      setAnalysis(mockAnalysisResult({
        irradiance: 900,
        ambient_temp: 32,
        panel_temp: 48,
        battery_soc: 72,
        inverter_eff: 96.4,
        soiling_index: 3.1,
        tilt: 30,
        azimuth: 180,
        wind_speed: 2.3,
        pr_baseline: 0.80,
        system_capacity: 100,
        actual_output: 62.4
      }));
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  const mockAnalysisResult = (inputs: any): AIAnalysisResult => {
    const predicted = inputs.system_capacity * (inputs.irradiance / 1000) * 0.75;
    const deviation = ((inputs.actual_output - predicted) / predicted) * 100;

    return {
      site_id: selectedSite,
      predicted_output: predicted,
      actual_output: inputs.actual_output,
      deviation: deviation,
      fault_prob: Math.abs(deviation) > 15 ? 0.3 : 0.08,
      top_factors: ["irradiance", "panel_temp", "inverter_eff"],
      weather_impact_score: 85.3,
      battery_health_score: 92.0,
      performance_metrics: {
        temp_correction: 0.908,
        soiling_factor: 0.969,
        inverter_factor: 0.964,
        irradiance_factor: inputs.irradiance / 1000
      },
      recommendations: [
        {
          priority: "High",
          msg: `Panel temperature elevated (${inputs.panel_temp.toFixed(1)}°C vs ambient ${inputs.ambient_temp.toFixed(1)}°C)`,
          action: "Check for adequate airflow, clean panels if soiled"
        },
        {
          priority: "Medium",
          msg: `Moderate soiling detected (${inputs.soiling_index.toFixed(1)}% loss)`,
          action: "Plan cleaning maintenance within 2 weeks"
        },
        {
          priority: "Info",
          msg: `Battery SoC stable (${inputs.battery_soc.toFixed(0)}%)`,
          action: "Continue monitoring"
        }
      ]
    };
  };

  const generateHistoricalData = () => {
    const data = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now);
      hour.setHours(now.getHours() - i);
      const predicted = 50 + Math.sin(i / 4) * 30 + Math.random() * 10;
      const actual = predicted - 5 + Math.random() * 10;
      data.push({
        time: hour.getHours() + ":00",
        predicted: Math.max(0, predicted),
        actual: Math.max(0, actual),
      });
    }
    setHistoricalData(data);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "info":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      case "medium":
        return <AlertCircle className="w-4 h-4" />;
      case "info":
        return <Info className="w-4 h-4" />;
      default:
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const featureNameMap: { [key: string]: string } = {
    irradiance: "Solar Irradiance",
    panel_temp: "Panel Temperature",
    inverter_eff: "Inverter Efficiency",
    soiling_index: "Panel Soiling",
    battery_soc: "Battery SoC",
    ambient_temp: "Ambient Temperature",
    wind_speed: "Wind Speed"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#FFD36E]/10 to-[#75CFFF]/10">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#FFD36E] to-[#75CFFF] bg-clip-text text-transparent">
              AI Analysis & Recommendations
            </h1>
            <p className="text-muted-foreground">
              ML-powered performance monitoring and predictive insights
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name} ({site.capacity_kwp} kWp)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={fetchAnalysis}
              disabled={loading || !selectedSite}
              className="bg-gradient-to-r from-[#FFD36E] to-[#75CFFF] text-white"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Analysis
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Last Updated Info */}
        {analysis && (
          <Card className="border-[#FFD36E]/20 bg-white/50 backdrop-blur">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="w-4 h-4" />
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Auto-refresh</label>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="overview">
              <Gauge className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="insights">
              <BarChart3 className="w-4 h-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="history">
              <TrendingUp className="w-4 h-4 mr-2" />
              History Trends
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {analysis ? (
              <>
                {/* KPI Tiles */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Performance Deviation */}
                  <Card className="shadow-lg border-[#FFD36E]/30 bg-gradient-to-br from-white to-[#FFD36E]/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {analysis.deviation < 0 ? (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        ) : (
                          <TrendingUp className="w-5 h-5 text-green-500" />
                        )}
                        Performance Deviation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold mb-2">
                        {analysis.deviation > 0 ? "+" : ""}
                        {analysis.deviation.toFixed(1)}%
                      </div>
                      <Progress
                        value={Math.abs(analysis.deviation)}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        vs expected output
                      </p>
                    </CardContent>
                  </Card>

                  {/* Predicted vs Actual Output */}
                  <Card className="shadow-lg border-[#75CFFF]/30 bg-gradient-to-br from-white to-[#75CFFF]/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Zap className="w-5 h-5 text-[#FFD36E]" />
                        Power Output
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <div className="text-2xl font-bold">
                            {analysis.actual_output.toFixed(1)} kW
                          </div>
                          <p className="text-xs text-muted-foreground">Actual</p>
                        </div>
                        <div>
                          <div className="text-lg text-muted-foreground">
                            {analysis.predicted_output.toFixed(1)} kW
                          </div>
                          <p className="text-xs text-muted-foreground">Predicted</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Weather Impact Score */}
                  <Card className="shadow-lg border-[#75CFFF]/30 bg-gradient-to-br from-white to-[#75CFFF]/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Cloud className="w-5 h-5 text-[#75CFFF]" />
                        Weather Impact
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold mb-2">
                        {analysis.weather_impact_score.toFixed(0)}
                      </div>
                      <Progress
                        value={analysis.weather_impact_score}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Favorable conditions
                      </p>
                    </CardContent>
                  </Card>

                  {/* Battery Health Score */}
                  <Card className="shadow-lg border-[#FFD36E]/30 bg-gradient-to-br from-white to-[#FFD36E]/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Battery className="w-5 h-5 text-green-500" />
                        Battery Health
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold mb-2">
                        {analysis.battery_health_score.toFixed(0)}%
                      </div>
                      <Progress
                        value={analysis.battery_health_score}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Optimal range
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* AI Recommendations */}
                <Card className="shadow-lg border-[#FFD36E]/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-[#FFD36E]" />
                      Recommended Actions
                    </CardTitle>
                    <CardDescription>
                      AI-generated insights and priority actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysis.recommendations.map((rec, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-white to-gray-50 border"
                        >
                          <div className={`p-2 rounded-full ${getPriorityColor(rec.priority)} text-white`}>
                            {getPriorityIcon(rec.priority)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={getPriorityColor(rec.priority)}>
                                {rec.priority.toUpperCase()}
                              </Badge>
                              <span className="font-medium">{rec.msg}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              <strong>Action:</strong> {rec.action}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Fault Probability */}
                <Card className="shadow-lg border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium mb-1">Fault Probability</p>
                        <p className="text-3xl font-bold">
                          {(analysis.fault_prob * 100).toFixed(1)}%
                        </p>
                      </div>
                      <Gauge className="w-12 h-12 text-red-500" />
                    </div>
                    <Progress
                      value={analysis.fault_prob * 100}
                      className="h-2 mt-3"
                    />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-lg">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <BarChart3 className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Analysis Available</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Select a site and click "Refresh Analysis" to start
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            {analysis && (
              <>
                {/* Top Influence Factors */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-[#75CFFF]" />
                      Top Influence Factors
                    </CardTitle>
                    <CardDescription>
                      Key factors affecting system performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analysis.top_factors.map((factor, i) => ({
                        name: featureNameMap[factor] || factor,
                        importance: (100 - i * 15),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis label={{ value: 'Importance', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Bar dataKey="importance" fill="#75CFFF" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Performance Metrics Breakdown</CardTitle>
                    <CardDescription>
                      Individual correction factors affecting output
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-[#FFD36E]/10 to-white border">
                        <div className="flex items-center gap-2 mb-2">
                          <Thermometer className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-medium">Temperature Correction</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {(analysis.performance_metrics.temp_correction * 100).toFixed(1)}%
                        </div>
                        <Progress
                          value={analysis.performance_metrics.temp_correction * 100}
                          className="h-2 mt-2"
                        />
                      </div>

                      <div className="p-4 rounded-lg bg-gradient-to-br from-[#75CFFF]/10 to-white border">
                        <div className="flex items-center gap-2 mb-2">
                          <Wind className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium">Soiling Factor</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {(analysis.performance_metrics.soiling_factor * 100).toFixed(1)}%
                        </div>
                        <Progress
                          value={analysis.performance_metrics.soiling_factor * 100}
                          className="h-2 mt-2"
                        />
                      </div>

                      <div className="p-4 rounded-lg bg-gradient-to-br from-[#FFD36E]/10 to-white border">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-medium">Inverter Efficiency</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {(analysis.performance_metrics.inverter_factor * 100).toFixed(1)}%
                        </div>
                        <Progress
                          value={analysis.performance_metrics.inverter_factor * 100}
                          className="h-2 mt-2"
                        />
                      </div>

                      <div className="p-4 rounded-lg bg-gradient-to-br from-[#75CFFF]/10 to-white border">
                        <div className="flex items-center gap-2 mb-2">
                          <Sun className="w-4 h-4 text-orange-400" />
                          <span className="text-sm font-medium">Irradiance Factor</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {(analysis.performance_metrics.irradiance_factor * 100).toFixed(1)}%
                        </div>
                        <Progress
                          value={analysis.performance_metrics.irradiance_factor * 100}
                          className="h-2 mt-2"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* History Trends Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#75CFFF]" />
                  24-Hour Performance Trend
                </CardTitle>
                <CardDescription>
                  Predicted vs Actual output over the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={historicalData}>
                    <defs>
                      <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#75CFFF" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#75CFFF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFD36E" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#FFD36E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="predicted"
                      stroke="#75CFFF"
                      fillOpacity={1}
                      fill="url(#colorPredicted)"
                      name="Predicted"
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#FFD36E"
                      fillOpacity={1}
                      fill="url(#colorActual)"
                      name="Actual"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PanelAnalysis;
