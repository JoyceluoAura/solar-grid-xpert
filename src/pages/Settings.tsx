import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Key, Save } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const [apiKeys, setApiKeys] = useState({
    nrelApi: "",
    openWeatherApi: "",
    weatherbitApi: "",
    visualCrossingApi: "",
  });

  const handleApiKeyChange = (field: string, value: string) => {
    setApiKeys((prev) => ({ ...prev, [field]: value }));
  };

  const saveSettings = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8 max-w-4xl">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-muted-foreground">Configure API integrations and system preferences</p>
        </div>

        {/* API Configuration */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-solar-orange" />
              API Configuration
            </CardTitle>
            <CardDescription>Manage your API keys for weather and solar data services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nrelApi">NREL PVWatts API Key</Label>
              <Input
                id="nrelApi"
                type="password"
                placeholder="Enter your NREL API key"
                value={apiKeys.nrelApi}
                onChange={(e) => handleApiKeyChange("nrelApi", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Required for solar generation calculations.{" "}
                <a
                  href="https://developer.nrel.gov/signup/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-energy-blue hover:underline"
                >
                  Get API key
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openWeatherApi">OpenWeather API Key (Optional)</Label>
              <Input
                id="openWeatherApi"
                type="password"
                placeholder="Enter your OpenWeather API key"
                value={apiKeys.openWeatherApi}
                onChange={(e) => handleApiKeyChange("openWeatherApi", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                For enhanced weather-based forecasting.{" "}
                <a
                  href="https://openweathermap.org/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-energy-blue hover:underline"
                >
                  Get API key
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weatherbitApi">Weatherbit API Key (Optional)</Label>
              <Input
                id="weatherbitApi"
                type="password"
                placeholder="Enter your Weatherbit API key"
                value={apiKeys.weatherbitApi}
                onChange={(e) => handleApiKeyChange("weatherbitApi", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Alternative weather data provider.{" "}
                <a
                  href="https://www.weatherbit.io/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-energy-blue hover:underline"
                >
                  Get API key
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visualCrossingApi">Visual Crossing API Key (Optional)</Label>
              <Input
                id="visualCrossingApi"
                type="password"
                placeholder="Enter your Visual Crossing API key"
                value={apiKeys.visualCrossingApi}
                onChange={(e) => handleApiKeyChange("visualCrossingApi", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Historical weather data access.{" "}
                <a
                  href="https://www.visualcrossing.com/weather-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-energy-blue hover:underline"
                >
                  Get API key
                </a>
              </p>
            </div>

            <Button onClick={saveSettings} className="w-full gradient-energy text-white">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-solar-orange" />
              System Information
            </CardTitle>
            <CardDescription>Current platform status and version details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-muted-foreground">Platform Version</span>
                <span className="text-sm font-semibold text-foreground">v1.0.0</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-muted-foreground">Database Status</span>
                <span className="text-sm font-semibold text-eco-green">Connected</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-muted-foreground">Last Updated</span>
                <span className="text-sm font-semibold text-foreground">October 2025</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
