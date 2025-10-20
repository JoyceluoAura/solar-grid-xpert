import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  unit: string;
  change?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  gradient?: "solar" | "energy" | "eco";
}

const KPICard = ({ title, value, unit, change, icon: Icon, trend = "neutral", gradient = "energy" }: KPICardProps) => {
  const gradientClass = {
    solar: "gradient-solar",
    energy: "gradient-energy",
    eco: "gradient-eco",
  }[gradient];

  return (
    <Card className="overflow-hidden shadow-card hover:shadow-elevated transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", gradientClass)}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {change && (
            <div
              className={cn(
                "text-xs font-semibold px-2 py-1 rounded-full",
                trend === "up" && "bg-accent/20 text-accent",
                trend === "down" && "bg-destructive/20 text-destructive",
                trend === "neutral" && "bg-muted text-muted-foreground"
              )}
            >
              {change}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground font-medium">{unit}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default KPICard;
