import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle2, Camera, Battery, Zap, XCircle } from "lucide-react";
import { toast } from "sonner";

interface AnalysisIssue {
  id: string;
  component: string;
  issue: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  action: string;
  attachment?: string;
  created_at: string;
  alert_type: string;
}

const AIAnalysis = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<AnalysisIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAnalysisIssues();
    }
  }, [user]);

  const fetchAnalysisIssues = async () => {
    if (!user) return;

    try {
      const { data: alerts, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Map alerts to analysis issues format
      const mappedIssues: AnalysisIssue[] = (alerts || []).map(alert => {
        const severityMap: { [key: string]: "Low" | "Medium" | "High" | "Critical" } = {
          info: "Low",
          low: "Low",
          medium: "Medium",
          high: "High",
          critical: "Critical"
        };

        return {
          id: alert.id,
          component: getComponentName(alert.alert_type, alert.sensor_id),
          issue: alert.message,
          severity: severityMap[alert.severity] || "Medium",
          action: getRecommendedAction(alert.alert_type, alert.severity),
          created_at: alert.created_at,
          alert_type: alert.alert_type
        };
      });

      setIssues(mappedIssues);
    } catch (error: any) {
      toast.error("Failed to load analysis data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getComponentName = (alertType: string, sensorId: string | null) => {
    if (sensorId) return `Sensor ${sensorId.substring(0, 8)}`;
    
    const typeMap: { [key: string]: string } = {
      dust: "Solar Panel",
      battery_degraded: "Battery System",
      voltage_anomaly: "Inverter",
      thermal_warning: "Thermal Sensor",
      performance_drop: "Solar Array"
    };

    return typeMap[alertType] || "System Component";
  };

  const getRecommendedAction = (alertType: string, severity: string) => {
    const actions: { [key: string]: string } = {
      dust: "Please wipe the panel thoroughly with appropriate cleaning solution",
      battery_degraded: "Battery replacement required - schedule maintenance immediately",
      voltage_anomaly: "Check inverter connections and voltage regulator",
      thermal_warning: "Inspect cooling system and check for overheating causes",
      performance_drop: "Conduct full system diagnostics and performance audit",
      connection_issue: "Inspect all electrical connections and junction boxes"
    };

    if (severity === "critical" || severity === "high") {
      return `URGENT: ${actions[alertType] || "Schedule immediate inspection"}`;
    }

    return actions[alertType] || "Monitor system and schedule routine maintenance";
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      Low: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      Medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      High: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      Critical: "bg-red-500/10 text-red-600 border-red-500/20"
    };
    return colors[severity as keyof typeof colors] || colors.Medium;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "Critical":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "High":
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case "Medium":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-blue-600" />;
    }
  };

  const getTypeIcon = (alertType: string) => {
    switch (alertType) {
      case "dust":
        return <Camera className="w-5 h-5" />;
      case "battery_degraded":
        return <Battery className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const handleResolve = async (issueId: string) => {
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", issueId);

      if (error) throw error;

      toast.success("Issue marked as resolved");
      fetchAnalysisIssues();
    } catch (error: any) {
      toast.error("Failed to resolve issue");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading analysis data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Analysis & Recommendations</h1>
          <p className="text-muted-foreground mt-2">
            Real-time monitoring insights and recommended actions
          </p>
        </div>
        <Button onClick={fetchAnalysisIssues} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{issues.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {issues.filter(i => i.severity === "Critical").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {issues.filter(i => i.severity === "High").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Medium Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {issues.filter(i => i.severity === "Medium").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        {issues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">All Systems Operational</h3>
              <p className="text-muted-foreground">No issues detected at this time</p>
            </CardContent>
          </Card>
        ) : (
          issues.map((issue) => (
            <Card key={issue.id} className="border-l-4" style={{
              borderLeftColor: issue.severity === "Critical" ? "rgb(220, 38, 38)" :
                               issue.severity === "High" ? "rgb(249, 115, 22)" :
                               issue.severity === "Medium" ? "rgb(234, 179, 8)" : "rgb(59, 130, 246)"
            }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getTypeIcon(issue.alert_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg">
                          Affected Component: {issue.component}
                        </CardTitle>
                        <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                          {getSeverityIcon(issue.severity)}
                          <span className="ml-2">{issue.severity}</span>
                        </Badge>
                      </div>
                      <CardDescription className="text-base">
                        <strong>Issue:</strong> {issue.issue}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleResolve(issue.id)}
                    variant="outline"
                    size="sm"
                  >
                    Mark Resolved
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Action Needed:
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {issue.action}
                    </p>
                  </div>
                  {issue.attachment && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">
                        Attachment:
                      </p>
                      <img
                        src={issue.attachment}
                        alt={`${issue.component} inspection`}
                        className="rounded-lg border border-border max-w-md"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>Detected: {new Date(issue.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AIAnalysis;
