import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Key, Save, Wifi, Calendar } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const [apiKeys, setApiKeys] = useState({
    nrelApi: "",
    openWeatherApi: "",
    weatherbitApi: "",
    visualCrossingApi: "",
  });

  const [mqttConfig, setMqttConfig] = useState({
    broker: "",
    port: "1883",
    username: "",
    password: "",
  });

  const [preferences, setPreferences] = useState({
    units: "metric",
    darkMode: false,
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

        {/* IoT/MQTT Configuration */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-solar-orange" />
              IoT/MQTT Configuration
            </CardTitle>
            <CardDescription>Configure MQTT broker for IoT sensor connectivity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mqttBroker">MQTT Broker URL</Label>
                <Input
                  id="mqttBroker"
                  placeholder="e.g., mqtt://broker.hivemq.com"
                  value={mqttConfig.broker}
                  onChange={(e) => setMqttConfig({ ...mqttConfig, broker: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqttPort">Port</Label>
                <Input
                  id="mqttPort"
                  type="number"
                  placeholder="1883"
                  value={mqttConfig.port}
                  onChange={(e) => setMqttConfig({ ...mqttConfig, port: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mqttUsername">Username (Optional)</Label>
                <Input
                  id="mqttUsername"
                  placeholder="MQTT username"
                  value={mqttConfig.username}
                  onChange={(e) => setMqttConfig({ ...mqttConfig, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqttPassword">Password (Optional)</Label>
                <Input
                  id="mqttPassword"
                  type="password"
                  placeholder="MQTT password"
                  value={mqttConfig.password}
                  onChange={(e) => setMqttConfig({ ...mqttConfig, password: e.target.value })}
                />
              </div>
            </div>

            <Button onClick={saveSettings} className="w-full gradient-energy text-white">
              <Save className="w-4 h-4 mr-2" />
              Save MQTT Configuration
            </Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-solar-orange" />
              Preferences
            </CardTitle>
            <CardDescription>Customize your platform experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium">Units</p>
                <p className="text-sm text-muted-foreground">Metric (kWh, °C) / Imperial (BTU, °F)</p>
              </div>
              <Switch
                checked={preferences.units === "metric"}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, units: checked ? "metric" : "imperial" })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
              </div>
              <Switch
                checked={preferences.darkMode}
                onCheckedChange={(checked) => setPreferences({ ...preferences, darkMode: checked })}
              />
            </div>
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

        {/* Data Retention */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-solar-orange" />
              Historical Data Retention
            </CardTitle>
            <CardDescription>Telemetry retention horizon for analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sensor telemetry and AI analysis now leverage the Open-Meteo archive with a retention window of <span className="font-semibold text-foreground">24 months</span>. No additional configuration is required—weekly, monthly, and yearly visualizations in the IoT Sensors page automatically use the extended history.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
