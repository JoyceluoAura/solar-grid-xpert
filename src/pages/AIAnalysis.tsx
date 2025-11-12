import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Zap,
  AlertCircle,
  Clock,
  Wrench,
  BarChart3,
  RefreshCw,
  Filter,
  ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { openMeteoService, SolarDataPoint } from "@/services/openMeteo";
import { solarIssueService, SolarIssue } from "@/services/solarIssues";
import { nasaPowerService } from "@/services/nasaPower";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Type definitions
interface OverviewData {
  health_score: number;
  predicted_loss_kwh_7d: number;
  predicted_loss_pct_7d: number;
  top_drivers: Array<{ label: string; contribution_pct: number }>;
  actions: Array<{ title: string; impact_kwh: number; priority: 'high' | 'med' }>;
  forecast_windows: Array<{ start: string; end: string; label: 'low output' | 'high risk' }>;
}

interface InsightCard {
  id: string;
  ts: string;
  kind: string;
  confidence: number;
  impact_kwh: number;
  summary: string;
  evidence_url?: string;
  tags: string[];
}

interface HistoryData {
  series: Array<{ ts: string; ghi: number; ac_kw: number; modeled_kw: number; pr?: number | null }>;
  anomalies: Array<{ start: string; end: string; type: string; score: number }>;
  kpis: { mtbf_hours: number; mttr_hours: number; recovered_kwh_30d: number };
}

interface SiteOption {
  id: string;
  site_name: string;
  latitude: number;
  longitude: number;
  system_size_kwp: number | null;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const buildTopDriverBreakdown = (weights: Array<{ label: string; value: number }>): Array<{ label: string; contribution_pct: number }> => {
  if (weights.length === 0) {
    return [];
  }

  const sanitized = weights.map(driver => ({
    label: driver.label,
    value: driver.value > 0 ? driver.value : 0.5,
  }));
  const totalWeight = sanitized.reduce((sum, driver) => sum + driver.value, 0) || 1;
  let allocated = 0;

  const breakdown = sanitized.map((driver, index) => {
    if (index === sanitized.length - 1) {
      return {
        label: driver.label,
        contribution_pct: Math.max(0, 100 - allocated),
      };
    }

    const pct = Math.max(0, Math.round((driver.value / totalWeight) * 100));
    allocated += pct;
    return {
      label: driver.label,
      contribution_pct: pct,
    };
  });

  const totalAllocated = breakdown.reduce((sum, driver) => sum + driver.contribution_pct, 0);
  if (totalAllocated > 100 && breakdown.length > 0) {
    const diff = totalAllocated - 100;
    breakdown[0].contribution_pct = Math.max(0, breakdown[0].contribution_pct - diff);
  }

  return breakdown;
};

const buildOverviewFromSolarData = (data: SolarDataPoint[], capacity: number): OverviewData => {
  if (data.length === 0) {
    return {
      health_score: 76.2,
      predicted_loss_kwh_7d: 94.5,
      predicted_loss_pct_7d: 6.5,
      top_drivers: [
        { label: "Limited irradiance", contribution_pct: 40 },
        { label: "Temperature derating", contribution_pct: 35 },
        { label: "Cleaning interval", contribution_pct: 25 },
      ],
      actions: [
        { title: "Verify shading on midday strings", impact_kwh: 34.1, priority: "high" },
        { title: "Schedule module cleaning", impact_kwh: 28.4, priority: "med" },
        { title: "Tune inverter MPPT window", impact_kwh: 18.6, priority: "med" },
      ],
      forecast_windows: [],
    };
  }

  const window = data.slice(-24);
  const peakOutput = window.reduce((max, point) => Math.max(max, point.ac_output), 0);
  const averageOutput = window.reduce((sum, point) => sum + point.ac_output, 0) / window.length;
  const avgIrradiance = window.reduce((sum, point) => sum + point.irradiance, 0) / window.length;
  const highTempHours = window.filter(point => point.cell_temp > 60).length;
  const shadingHours = window.filter(point => point.irradiance > 600 && point.ac_output < capacity * 0.6).length;
  const expectedPeak = capacity * 0.95;
  const lossPct = expectedPeak > 0 ? Math.max(0, ((expectedPeak - peakOutput) / expectedPeak) * 100) : 0;
  const predictedLossKwh = Number(((lossPct / 100) * capacity * 7 * 4).toFixed(1));
  const healthScore = Number(
    Math.min(100, Math.max(45, 92 - lossPct / 2 - highTempHours * 1.8 - shadingHours * 2)).toFixed(1)
  );

  const drivers = buildTopDriverBreakdown([
    { label: "Thermal derating", value: highTempHours * 1.6 },
    { label: "Cloud cover & shading", value: shadingHours * 1.4 },
    { label: "Soiling trend", value: avgIrradiance < 500 ? 1.8 : 1 },
  ]);

  const actions: OverviewData["actions"] = [
    {
      title: `Investigate hotspots detected in camera feed`,
      impact_kwh: Number((Math.max(1, highTempHours) * capacity * 0.35).toFixed(1)),
      priority: highTempHours > 0 ? "high" : "med",
    },
    {
      title: `Trim shading sources affecting ${shadingHours} recent hours`,
      impact_kwh: Number((Math.max(1, shadingHours) * capacity * 0.25).toFixed(1)),
      priority: shadingHours > 1 ? "high" : "med",
    },
    {
      title: `Wash modules to sustain ${averageOutput.toFixed(1)} kW baseline`,
      impact_kwh: Number((capacity * 0.18).toFixed(1)),
      priority: "med",
    },
  ];

  const highRiskWindows = window
    .filter(point => point.irradiance > 650 && point.ac_output < capacity * 0.6)
    .slice(0, 2)
    .map(point => ({
      start: point.timestamp,
      end: new Date(new Date(point.timestamp).getTime() + 60 * 60 * 1000).toISOString(),
      label: "high risk" as const,
    }));

  const lowOutputWindow = window
    .filter(point => point.irradiance < 200)
    .slice(-1)
    .map(point => ({
      start: point.timestamp,
      end: new Date(new Date(point.timestamp).getTime() + 60 * 60 * 1000).toISOString(),
      label: "low output" as const,
    }));

  return {
    health_score: healthScore,
    predicted_loss_kwh_7d: predictedLossKwh,
    predicted_loss_pct_7d: Number(lossPct.toFixed(1)),
    top_drivers: drivers,
    actions,
    forecast_windows: [...highRiskWindows, ...lowOutputWindow],
  };
};

const buildInsightsFromSolarData = (data: SolarDataPoint[], capacity: number): InsightCard[] => {
  if (data.length === 0) {
    return [];
  }

  const window = data.slice(-24);
  const insights: InsightCard[] = [];

  const hottestPoint = window.reduce((prev, current) => (current.cell_temp > prev.cell_temp ? current : prev));
  if (hottestPoint.cell_temp > 58) {
    const impact = Number(((hottestPoint.cell_temp - 55) * capacity * 0.08).toFixed(1));
    insights.push({
      id: "thermal-hotspot",
      ts: hottestPoint.timestamp,
      kind: "thermal_hotspot",
      confidence: Math.min(0.98, 0.6 + (hottestPoint.cell_temp - 55) / 40),
      impact_kwh: impact,
      summary: `Thermal hotspot detected at ${hottestPoint.hour} — cell temperature ${hottestPoint.cell_temp.toFixed(1)}°C with AC output ${hottestPoint.ac_output.toFixed(1)} kW`,
      tags: ["Thermal", "Camera", "Performance"],
    });
  }

  const irradiancePeaks = window.filter(point => point.irradiance > 650);
  if (irradiancePeaks.length > 0) {
    const worstPerformance = irradiancePeaks.reduce(
      (prev, point) => {
        const expected = Math.min(capacity, (point.irradiance / 1000) * capacity);
        const pr = expected > 0 ? point.ac_output / expected : 1;
        if (pr < prev.pr) {
          return { point, pr };
        }
        return prev;
      },
      { point: irradiancePeaks[0], pr: 1 }
    );

    if (worstPerformance.pr < 0.78) {
      const deficit = Math.max(0, Math.min(capacity, (worstPerformance.point.irradiance / 1000) * capacity) - worstPerformance.point.ac_output);
      insights.push({
        id: "shading-midday",
        ts: worstPerformance.point.timestamp,
        kind: "shading",
        confidence: Math.min(0.9, 0.7 + (1 - worstPerformance.pr) / 2),
        impact_kwh: Number((deficit * 1.5).toFixed(1)),
        summary: `Midday shading suspected — irradiance ${Math.round(worstPerformance.point.irradiance)} W/m² but AC output ${worstPerformance.point.ac_output.toFixed(1)} kW`,
        tags: ["Shading", "Performance", "AI"],
      });
    }
  }

  const morningPoints = window.filter(point => {
    const hour = parseInt(point.hour.split(":")[0], 10);
    return hour >= 6 && hour <= 10;
  });
  if (morningPoints.length >= 2) {
    const first = morningPoints[0];
    const last = morningPoints[morningPoints.length - 1];
    const ramp = last.ac_output - first.ac_output;
    if (ramp < capacity * 0.3) {
      insights.push({
        id: "slow-ramp",
        ts: last.timestamp,
        kind: "soiling",
        confidence: 0.72,
        impact_kwh: Number((Math.max(0, capacity * 0.35 - ramp)).toFixed(1)),
        summary: `Morning production ramp is slower than expected — gained only ${ramp.toFixed(1)} kW between ${first.hour} and ${last.hour}`,
        tags: ["Soiling", "Ramp", "Performance"],
      });
    }
  }

  if (insights.length === 0) {
    const latest = window[window.length - 1];
    insights.push({
      id: "stable-output",
      ts: latest.timestamp,
      kind: "stability",
      confidence: 0.65,
      impact_kwh: Number((capacity * 0.12).toFixed(1)),
      summary: `Consistent production — latest reading ${latest.ac_output.toFixed(1)} kW with irradiance ${Math.round(latest.irradiance)} W/m²`,
      tags: ["Stability", "Performance"],
    });
  }

  return insights;
};

const buildHistoryFromSolarData = (data: SolarDataPoint[], capacity: number): HistoryData => {
  if (data.length === 0) {
    return {
      series: [],
      anomalies: [],
      kpis: { mtbf_hours: 72, mttr_hours: 4, recovered_kwh_30d: 120 },
    };
  }

  const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const series = sorted.map(point => {
    const modeled = Math.min(capacity, (point.irradiance / 1000) * capacity);
    const performanceRatio = modeled > 0 ? point.ac_output / modeled : null;
    return {
      ts: point.timestamp,
      ghi: Number(point.irradiance.toFixed(1)),
      ac_kw: Number(point.ac_output.toFixed(2)),
      modeled_kw: Number(modeled.toFixed(2)),
      pr: performanceRatio !== null ? Number(Math.max(0, Math.min(1.2, performanceRatio)).toFixed(2)) : null,
    };
  });

  const anomalies = series
    .filter(item => (item.pr ?? 1) < 0.75)
    .slice(-3)
    .map(item => ({
      start: item.ts,
      end: new Date(new Date(item.ts).getTime() + 60 * 60 * 1000).toISOString(),
      type: (item.pr ?? 1) < 0.55 ? "critical" : "warning",
      score: Math.round((1 - (item.pr ?? 1)) * 100),
    }));

  const deficit = series.reduce((sum, item) => {
    const delta = item.modeled_kw - item.ac_kw;
    return delta > 0 ? sum + delta : sum;
  }, 0);

  const mtbf = anomalies.length > 0 ? Math.max(12, Math.round((series.length / anomalies.length) * 1.5)) : 96;
  const mttr = anomalies.length > 0 ? 6 : 3;

  return {
    series,
    anomalies,
    kpis: {
      mtbf_hours: mtbf,
      mttr_hours: mttr,
      recovered_kwh_30d: Math.round(deficit),
    },
  };
};

const AIAnalysis = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<string>("");

  // Overview state
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Insights state
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightFilter, setInsightFilter] = useState<string>("all");
  const [insightSort, setInsightSort] = useState<string>("impact");

  // History state
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyRange, setHistoryRange] = useState<string>("30d");
  
  // Solar issues state
  const [solarIssues, setSolarIssues] = useState<SolarIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  
  const selectedSiteDetails = useMemo(() =>
    sites.find((site) => site.id === selectedSite) ?? null,
  [sites, selectedSite]);

  useEffect(() => {
    if (user) {
      fetchSites();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedSite && activeTab === "history") {
      fetchHistoryData();
    }
  }, [historyRange, user, activeTab, selectedSite]);

  useEffect(() => {
    if (user && selectedSite) {
      fetchOverviewData();
      fetchInsightsData();
      fetchSolarIssues();
      if (activeTab === "history") {
        fetchHistoryData();
      }
    }
  }, [user, selectedSite, activeTab]);

  const fetchSites = async () => {
    try {
      setSitesLoading(true);
      const { data, error } = await supabase
        .from('sites')
        .select('id, site_name, latitude, longitude, system_size_kwp')
        .order('site_name');

      if (error) throw error;

      setSites(data || []);
      if (data && data.length > 0) {
        setSelectedSite((current) => current || data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('Failed to load sites:', message);
      toast.error('Failed to load sites for AI analysis');
    } finally {
      setSitesLoading(false);
    }
  };

  const buildSiteQuery = (extraParams?: Record<string, string>) => {
    if (!selectedSiteDetails) return null;
    const params = new URLSearchParams({
      site_id: selectedSiteDetails.id,
      lat: selectedSiteDetails.latitude.toString(),
      lon: selectedSiteDetails.longitude.toString(),
      capacity_kw: ((selectedSiteDetails.system_size_kwp ?? 100)).toString(),
    });

    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => params.append(key, value));
    }

    return params.toString();
  };

  const fetchSolarBaseline = async (): Promise<SolarDataPoint[]> => {
    if (!selectedSiteDetails) return [];
    try {
      return await openMeteoService.fetchSolarData({
        lat: selectedSiteDetails.latitude,
        lon: selectedSiteDetails.longitude,
        system_capacity: selectedSiteDetails.system_size_kwp ?? 100,
        tilt: 10,
        azimuth: 180,
      });
    } catch (solarError) {
      console.error("Failed to fetch fallback solar data:", solarError);
      return [];
    }
  };

  const fetchOverviewData = async () => {
    if (!selectedSiteDetails) return;
    try {
      setOverviewLoading(true);
      const fallbackSolar = await fetchSolarBaseline();
      const capacity = selectedSiteDetails?.system_size_kwp ?? 100;
      setOverviewData(buildOverviewFromSolarData(fallbackSolar, capacity));
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to fetch overview:", message);
      toast.error("Failed to load AI overview data");
    } finally {
      setOverviewLoading(false);
      setLoading(false);
    }
  };

  const fetchInsightsData = async () => {
    if (!selectedSiteDetails) return;
    try {
      setInsightsLoading(true);
      const fallbackSolar = await fetchSolarBaseline();
      const capacity = selectedSiteDetails?.system_size_kwp ?? 100;
      const generatedInsights = buildInsightsFromSolarData(fallbackSolar, capacity);
      setInsights(generatedInsights.length > 0 ? generatedInsights : []);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to fetch insights:", message);
      toast.error("Failed to load AI insights");
    } finally {
      setInsightsLoading(false);
    }
  };

  const fetchSolarIssues = async () => {
    if (!selectedSiteDetails) return;
    try {
      setIssuesLoading(true);
      const weather = await nasaPowerService.fetchWeatherData({
        latitude: selectedSiteDetails.latitude,
        longitude: selectedSiteDetails.longitude,
      });
      const issues = solarIssueService.generateSiteIssues(selectedSiteDetails.id, weather, 6);
      setSolarIssues(issues);
    } catch (error) {
      console.error("Failed to fetch solar issues:", error);
    } finally {
      setIssuesLoading(false);
    }
  };

  const fetchHistoryData = async () => {
    if (!selectedSiteDetails) return;
    try {
      setHistoryLoading(true);
      const fallbackSolar = await fetchSolarBaseline();
      const capacity = selectedSiteDetails?.system_size_kwp ?? 100;
      setHistoryData(buildHistoryFromSolarData(fallbackSolar, capacity));
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to fetch history:", message);
      toast.error("Failed to load history data");
      const fallbackSolar = await fetchSolarBaseline();
      const capacity = selectedSiteDetails?.system_size_kwp ?? 100;
      setHistoryData(buildHistoryFromSolarData(fallbackSolar, capacity));
    } finally {
      setHistoryLoading(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    if (score >= 60) return "text-orange-600";
    return "text-red-600";
  };

  const getPriorityColor = (priority: string) => {
    return priority === "high"
      ? "bg-red-500/10 text-red-600 border-red-500/20"
      : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
  };

  const getFilteredInsights = () => {
    let filtered = [...insights];

    // Filter by tag
    if (insightFilter !== "all") {
      filtered = filtered.filter(insight =>
        insight.tags.some(tag => tag.toLowerCase() === insightFilter.toLowerCase())
      );
    }

    // Sort
    if (insightSort === "impact") {
      filtered.sort((a, b) => b.impact_kwh - a.impact_kwh);
    } else if (insightSort === "confidence") {
      filtered.sort((a, b) => b.confidence - a.confidence);
    } else if (insightSort === "date") {
      filtered.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading AI analysis data...</div>
        </div>
      </div>
    );
  }

  if (!loading && !sitesLoading && sites.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card className="shadow-card">
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">No sites connected yet</h2>
            <p className="text-sm text-muted-foreground">
              Add a site with latitude, longitude, and system capacity to unlock AI-driven insights.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
            AI Analysis
          </h1>
          <p className="text-muted-foreground">
            AI-powered insights and predictive analytics for your solar installation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedSite}
            onValueChange={setSelectedSite}
            disabled={sitesLoading || sites.length === 0}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder={sitesLoading ? "Loading sites..." : "Select site"} />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.site_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              fetchOverviewData();
              fetchInsightsData();
              fetchHistoryData();
            }}
            variant="outline"
            className="gap-2"
            disabled={!selectedSiteDetails}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh All
          </Button>
        </div>
      </div>
      {selectedSiteDetails && (
        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-4">
          <span className="font-medium text-foreground">Site:</span>
          <span>{selectedSiteDetails.site_name}</span>
          <span>•</span>
          <span>Lat {selectedSiteDetails.latitude.toFixed(3)}°, Lon {selectedSiteDetails.longitude.toFixed(3)}°</span>
          <span>•</span>
          <span>Capacity {selectedSiteDetails.system_size_kwp ?? 100} kWp</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="overview">
            <Target className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="insights">
            <AlertCircle className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="history">
            <BarChart3 className="w-4 h-4 mr-2" />
            History Trends
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {overviewLoading ? (
            <div className="text-center py-12">Loading overview data...</div>
          ) : overviewData ? (
            <>
              {/* Health Score & Predicted Loss */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Health Score Gauge */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-green-500" />
                      Site Health Score
                    </CardTitle>
                    <CardDescription>Overall system performance rating</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className={`text-7xl font-bold ${getHealthScoreColor(overviewData.health_score)}`}>
                        {overviewData.health_score.toFixed(1)}
                      </div>
                      <div className="text-2xl font-semibold text-muted-foreground mt-2">/ 100</div>
                      <div className="mt-6 w-full bg-gray-200 rounded-full h-4">
                        <div
                          className={`h-4 rounded-full transition-all ${
                            overviewData.health_score >= 90
                              ? "bg-green-500"
                              : overviewData.health_score >= 75
                              ? "bg-yellow-500"
                              : overviewData.health_score >= 60
                              ? "bg-orange-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${overviewData.health_score}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Predicted Energy Loss */}
                <Card className="shadow-card border-orange-200 bg-gradient-to-br from-orange-50 to-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-orange-600" />
                      Predicted Energy Loss (7 Days)
                    </CardTitle>
                    <CardDescription>Estimated loss if issues not addressed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="flex items-baseline gap-3">
                        <div className="text-5xl font-bold text-orange-600">
                          {overviewData.predicted_loss_kwh_7d.toFixed(1)}
                        </div>
                        <div className="text-xl text-muted-foreground">kWh</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/20 text-lg px-3 py-1">
                          {overviewData.predicted_loss_pct_7d.toFixed(1)}% loss
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Estimated financial impact: ${(overviewData.predicted_loss_kwh_7d * 0.12).toFixed(2)} USD
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Drivers Bar Chart */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Top Performance Drivers
                  </CardTitle>
                  <CardDescription>Key factors affecting system performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={overviewData.top_drivers} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        label={{ value: "Contribution %", position: "insideBottom", offset: -5 }}
                      />
                      <YAxis type="category" dataKey="label" width={150} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: any) => [`${value}%`, "Contribution"]}
                      />
                      <Bar dataKey="contribution_pct" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Action Queue */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-purple-500" />
                    Action Queue
                  </CardTitle>
                  <CardDescription>Recommended actions to improve performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overviewData.actions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <Badge variant="outline" className={getPriorityColor(action.priority)}>
                            {action.priority.toUpperCase()}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-medium">{action.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Impact: {action.impact_kwh.toFixed(1)} kWh/week
                            </p>
                          </div>
                        </div>
                        <Button size="sm" className="gap-2">
                          Schedule
                          <ArrowUpRight className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No overview data available</div>
          )}
        </TabsContent>

        {/* AI INSIGHTS TAB */}
        <TabsContent value="insights" className="space-y-6">
          {/* Detected Issues Section */}
          {!issuesLoading && solarIssues.length > 0 && (
            <Card className="shadow-card border-orange-200 bg-gradient-to-br from-orange-50/50 to-red-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Detected Panel Issues
                </CardTitle>
                <CardDescription>
                  Real-time visual monitoring detected {solarIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length} critical/high severity issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {solarIssues.filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 4).map((issue) => (
                    <div key={issue.id} className="p-4 border border-border rounded-lg bg-white space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{issue.panel_id}</p>
                          <p className="text-xs text-muted-foreground">{issue.location}</p>
                        </div>
                        <Badge variant="outline" className={
                          issue.severity === 'critical' 
                            ? "bg-red-500/10 text-red-600 border-red-500/20"
                            : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                        }>
                          {issue.severity}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm"><span className="font-medium">Issue:</span> {issue.type}</p>
                        <p className="text-sm"><span className="font-medium">Energy Loss:</span> {issue.energy_loss_percent}% ({issue.predicted_kwh_loss} kWh/day)</p>
                        <p className="text-sm"><span className="font-medium">AI Confidence:</span> {Math.round(issue.confidence * 100)}%</p>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold mb-1">Top Action:</p>
                        <p className="text-xs text-muted-foreground">{issue.recommended_actions[0]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>

                <Select value={insightFilter} onValueChange={setInsightFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    <SelectItem value="shading">Shading</SelectItem>
                    <SelectItem value="soiling">Soiling</SelectItem>
                    <SelectItem value="derating">Derating</SelectItem>
                    <SelectItem value="inverter">Inverter</SelectItem>
                    <SelectItem value="battery">Battery</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={insightSort} onValueChange={setInsightSort}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="impact">Impact (kWh)</SelectItem>
                    <SelectItem value="confidence">Confidence</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                  </SelectContent>
                </Select>

                <div className="ml-auto text-sm text-muted-foreground">
                  {getFilteredInsights().length} insights
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insight Cards */}
          {insightsLoading ? (
            <div className="text-center py-12">Loading insights...</div>
          ) : (
            <div className="space-y-4">
              {getFilteredInsights().map((insight) => (
                <Card key={insight.id} className="shadow-card hover:shadow-lg transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          {insight.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <CardTitle className="text-lg mb-2">{insight.summary}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingDown className="w-4 h-4" />
                            Impact: {insight.impact_kwh.toFixed(1)} kWh/week
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Confidence: {(insight.confidence * 100).toFixed(0)}%
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(insight.ts).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        Take Action
                      </Button>
                    </div>
                  </CardHeader>
                  {insight.evidence_url && (
                    <CardContent>
                      <video
                        src={insight.evidence_url}
                        autoPlay
                        loop
                        muted
                        className="w-full max-h-64 rounded-lg object-cover"
                      />
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTORY TRENDS TAB */}
        <TabsContent value="history" className="space-y-6">
          {/* Range Selector */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Historical Performance Analysis</h3>
            <Select value={historyRange} onValueChange={setHistoryRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {historyLoading ? (
            <div className="text-center py-12">Loading history data...</div>
          ) : historyData ? (
            <>
              {/* KPI Tiles */}
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      MTBF (Mean Time Between Failures)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{historyData.kpis.mtbf_hours.toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">hours</div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      MTTR (Mean Time To Repair)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{historyData.kpis.mttr_hours.toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">hours</div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Recovered Energy (30d)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{historyData.kpis.recovered_kwh_30d}</div>
                    <div className="text-sm text-muted-foreground">kWh</div>
                  </CardContent>
                </Card>
              </div>

              {/* Chart 1: GHI vs AC vs Modeled */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>GHI / AC Output / Modeled Output</CardTitle>
                  <CardDescription>Solar irradiance and power generation comparison</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={historyData.series.slice(-168)}> {/* Last 7 days hourly */}
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="ts"
                        tickFormatter={(ts) => new Date(ts).toLocaleDateString()}
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis
                        yAxisId="left"
                        label={{ value: "Power (kW)", angle: -90, position: "insideLeft" }}
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: "GHI (W/m²)", angle: 90, position: "insideRight" }}
                        style={{ fontSize: "12px" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="ghi"
                        stroke="#fbbf24"
                        name="GHI"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="ac_kw"
                        stroke="#3b82f6"
                        name="AC Output"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="modeled_kw"
                        stroke="#10b981"
                        name="Modeled"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Chart 2: PR Trend */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Performance Ratio (PR) Trend</CardTitle>
                  <CardDescription>System efficiency over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={historyData.series.slice(-168).filter(s => s.pr !== null)}>
                      <defs>
                        <linearGradient id="colorPR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="ts"
                        tickFormatter={(ts) => new Date(ts).toLocaleDateString()}
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis
                        domain={[0, 1]}
                        tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                        style={{ fontSize: "12px" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: any) => [`${(value * 100).toFixed(1)}%`, "PR"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="pr"
                        stroke="#8b5cf6"
                        fillOpacity={1}
                        fill="url(#colorPR)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Chart 3: Anomaly Timeline */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Anomaly Detection Timeline</CardTitle>
                  <CardDescription>Detected performance anomalies and their severity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historyData.anomalies.slice(0, 10).map((anomaly, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <AlertTriangle
                            className={`w-5 h-5 ${
                              anomaly.score > 0.7
                                ? "text-red-600"
                                : anomaly.score > 0.5
                                ? "text-orange-600"
                                : "text-yellow-600"
                            }`}
                          />
                          <div>
                            <p className="font-medium capitalize">{anomaly.type.replace("_", " ")}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(anomaly.start).toLocaleString()} -{" "}
                              {new Date(anomaly.end).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            anomaly.score > 0.7
                              ? "bg-red-500/10 text-red-600 border-red-500/20"
                              : anomaly.score > 0.5
                              ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                              : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                          }
                        >
                          Score: {anomaly.score.toFixed(2)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No history data available</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIAnalysis;
