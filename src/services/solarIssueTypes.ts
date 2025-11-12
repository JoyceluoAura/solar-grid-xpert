export type IssueType =
  | 'hotspot'
  | 'crack'
  | 'soiling'
  | 'delamination'
  | 'shadow'
  | 'snow'
  | 'none';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SolarIssueHistoryTemplate {
  label: string;
  hoursAgo: number;
  notes: string;
  severity?: SeverityLevel;
}

export interface IssueAssetDefinition {
  videoUrl: string;
  poster: {
    title: string;
    subtitle: string;
    accentFrom: string;
    accentTo: string;
  };
  description: string;
  typicalSeverity: SeverityLevel;
  energyLossRange: [number, number];
  visualEffect: string;
  recommendations: string[];
  accent: { from: string; to: string };
  historyTimeline: SolarIssueHistoryTemplate[];
}
