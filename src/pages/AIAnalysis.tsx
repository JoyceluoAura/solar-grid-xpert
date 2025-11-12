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
import axios from "axios";

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

  const fetchOverviewData = async () => {
    if (!selectedSiteDetails) return;
    try {
      setOverviewLoading(true);
      const query = buildSiteQuery();
      if (!query) return;
      const response = await axios.get(`${BACKEND_URL}/api/ai/overview?${query}`);
      setOverviewData(response.data);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to fetch overview:", message);
      toast.error("Failed to load AI overview data");
      // Set mock data as fallback
      setOverviewData({
        health_score: 87.5,
        predicted_loss_kwh_7d: 125.4,
        predicted_loss_pct_7d: 8.2,
        top_drivers: [
          { label: "Temperature Derating", contribution_pct: 35 },
          { label: "Partial Shading", contribution_pct: 28 },
          { label: "Soiling", contribution_pct: 22 },
          { label: "Inverter Clipping", contribution_pct: 15 }
        ],
        actions: [
          { title: "Schedule panel cleaning", impact_kwh: 50.2, priority: "high" },
          { title: "Investigate inverter", impact_kwh: 37.6, priority: "high" },
          { title: "Optimize tilt angle", impact_kwh: 25.1, priority: "med" }
        ],
        forecast_windows: []
      });
    } finally {
      setOverviewLoading(false);
      setLoading(false);
    }
  };

  const fetchInsightsData = async () => {
    if (!selectedSiteDetails) return;
    try {
      setInsightsLoading(true);
      const query = buildSiteQuery();
      if (!query) return;
      const response = await axios.get(`${BACKEND_URL}/api/ai/insights?${query}`);
      setInsights(response.data.insights);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to fetch insights:", message);
      toast.error("Failed to load AI insights");
      // Set mock insights as fallback
      setInsights([
        {
          id: "1",
          ts: new Date().toISOString(),
          kind: "soiling",
          confidence: 0.85,
          impact_kwh: 45.2,
          summary: "Heavy dust accumulation detected on panels - 15% coverage affecting output",
          evidence_url: "https://videos.pexels.com/video-files/7989442/7989442-uhd_2560_1440_24fps.mp4",
          tags: ["Soiling", "Visual", "Inspection"]
        },
        {
          id: "2",
          ts: new Date().toISOString(),
          kind: "inverter_derating",
          confidence: 0.78,
          impact_kwh: 38.5,
          summary: "Inverter derating suspected during peak hours - AC output 15-20% below expected",
          tags: ["Derating", "Inverter", "Performance"]
        }
      ]);
    } finally {
      setInsightsLoading(false);
    }
  };

  const fetchHistoryData = async () => {
    if (!selectedSiteDetails) return;
    try {
      setHistoryLoading(true);
      const query = buildSiteQuery({ range: historyRange });
      if (!query) return;
      const response = await axios.get(`${BACKEND_URL}/api/ai/history?${query}`);
      setHistoryData(response.data);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to fetch history:", message);
      toast.error("Failed to load history data");
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
