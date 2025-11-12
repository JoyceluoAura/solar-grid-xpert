import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, MapPin, Battery, Zap, Cloud, Droplets, ChevronDown, Save } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const AddSite = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const addressContainerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    siteName: "",
    address: "",
    latitude: "",
    longitude: "",
    systemSize: "",
    panelEfficiency: "",
    tiltAngle: "",
    azimuth: "",
    dailyLoad: "",
    daysOfAutonomy: "",
    lookbackYears: "10",
    rainMmThreshold: "0.2",
  });

  const [addressSuggestions, setAddressSuggestions] = useState<
    Array<{ display_name: string; lat: string; lon: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [results, setResults] = useState<{
    dailyGeneration: number;
    monthlyGeneration: number;
    batteryCapacity: number;
    inverterSize: number;
  } | null>(null);

  const [weatherData, setWeatherData] = useState<{
    forecast: Array<{
      date: string;
      chanceOfRain: number;
      totalMm: number;
      rainHours: number;
    }>;
    historical: {
      probability: number;
      monthlyBreakdown: Array<{ month: string; probability: number }>;
    };
  } | null>(null);

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const fetchAddressSuggestions = async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setAddressSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch (error) {
      console.error("Address search error:", error);
    }
  };

  const handleAddressChange = (value: string) => {
    setFormData((prev) => ({ ...prev, address: value }));
  };

  const handleAddressSelect = (suggestion: { display_name: string; lat: string; lon: string }) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.display_name,
      latitude: suggestion.lat,
      longitude: suggestion.lon,
    }));
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current).setView([-2.5, 118.0], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);
  };

  useEffect(() => {
    setTimeout(() => initializeMap(), 100);
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !formData.latitude || !formData.longitude) return;

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    map.current.setView([lat, lng], 10);

    if (marker.current) {
      map.current.removeLayer(marker.current);
    }

    const customIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    marker.current = L.marker([lat, lng], { icon: customIcon }).addTo(map.current);
  }, [formData.latitude, formData.longitude]);

  // Debounce address input
  useEffect(() => {
    if (!formData.address) return;

    const timeoutId = setTimeout(() => {
      fetchAddressSuggestions(formData.address);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.address]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addressContainerRef.current &&
        !addressContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchWeatherData = async (lat: number, lon: number, xDays: number) => {
    try {
      const lookbackYears = parseInt(formData.lookbackYears) || 10;
      const rainThreshold = parseFloat(formData.rainMmThreshold) || 0.2;

      // Fetch 7-day forecast
      const forecastResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,precipitation_sum,precipitation_hours&forecast_days=7&timezone=auto`
      );
      const forecastData = await forecastResponse.json();

      // Fetch historical data
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 5);
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - lookbackYears);

      const historicalResponse = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}&timezone=auto`
      );
      const historicalData = await historicalResponse.json();

      // Process forecast
      const forecast = forecastData.daily.time.map((date: string, i: number) => ({
        date,
        chanceOfRain: forecastData.daily.precipitation_probability_max[i] || 0,
        totalMm: forecastData.daily.precipitation_sum[i] || 0,
        rainHours: forecastData.daily.precipitation_hours[i] || 0,
      }));

      // Calculate rolling 7-day windows for historical data
      const precipSums = historicalData.daily.precipitation_sum || [];
      const dates = historicalData.daily.time || [];

      if (precipSums.length < 30) {
        toast.error("Insufficient historical data");
        return;
      }

      const rainyDays = precipSums.map((sum: number | null) => (sum || 0) >= rainThreshold);
      let rainyWeeks = 0;
      let totalWindows = 0;
      const monthlyData: { [key: string]: { rainy: number; total: number } } = {};

      for (let i = 0; i <= rainyDays.length - 7; i++) {
        const window = rainyDays.slice(i, i + 7);
        const rainyCount = window.filter((r) => r).length;
        totalWindows++;

        if (rainyCount > xDays) {
          rainyWeeks++;
        }

        const monthKey = dates[i].substring(0, 7); // YYYY-MM
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { rainy: 0, total: 0 };
        }
        monthlyData[monthKey].total++;
        if (rainyCount > xDays) {
          monthlyData[monthKey].rainy++;
        }
      }

      const probability = totalWindows > 0 ? (rainyWeeks / totalWindows) * 100 : 0;

      const monthlyBreakdown = Object.entries(monthlyData)
        .slice(-12)
        .map(([month, data]) => ({
          month,
          probability: data.total > 0 ? (data.rainy / data.total) * 100 : 0,
        }));

      setWeatherData({
        forecast,
        historical: {
          probability: Math.round(probability * 10) / 10,
          monthlyBreakdown,
        },
      });
    } catch (error) {
      console.error("Weather fetch error:", error);
      toast.error("Failed to fetch weather data");
    }
  };

  const calculateResults = async () => {
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);
    const xDays = parseInt(formData.daysOfAutonomy) || 0;

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error("Latitude must be between -90 and 90");
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      toast.error("Longitude must be between -180 and 180");
      return;
    }
    if (xDays < 0 || xDays >= 7) {
      toast.error("Days of autonomy must be between 0 and 6");
      return;
    }

    // Calculate solar estimates
    const systemSize = parseFloat(formData.systemSize) || 0;
    const panelEfficiency = (parseFloat(formData.panelEfficiency) || 100) / 100;
    const dailyLoad = parseFloat(formData.dailyLoad) || 0;
    const daysOfAutonomy = parseFloat(formData.daysOfAutonomy) || 0;

    const dailyGeneration = systemSize * 4.5 * panelEfficiency;
    const monthlyGeneration = dailyGeneration * 30;
    const batteryCapacity = dailyLoad * daysOfAutonomy * 1.2;
    const inverterSize = systemSize * 1.1;

    setResults({
      dailyGeneration: Math.round(dailyGeneration * 10) / 10,
      monthlyGeneration: Math.round(monthlyGeneration * 10) / 10,
      batteryCapacity: Math.round(batteryCapacity * 10) / 10,
      inverterSize: Math.round(inverterSize * 10) / 10,
    });

    // Fetch weather data
    await fetchWeatherData(lat, lon, xDays);

    toast.success("Site evaluation complete!");
  };

  const saveSite = async () => {
    if (!user) {
      toast.error("You must be logged in to save a site");
      return;
    }

    if (!formData.siteName || !formData.latitude || !formData.longitude) {
      toast.error("Please provide site name and calculate potential first");
      return;
    }

    try {
      const { error } = await supabase.from("sites").insert({
        user_id: user.id,
        site_name: formData.siteName,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        address: formData.address,
        system_size_kwp: formData.systemSize ? parseFloat(formData.systemSize) : null,
        panel_efficiency: formData.panelEfficiency ? parseFloat(formData.panelEfficiency) : null,
        tilt_angle: formData.tiltAngle ? parseFloat(formData.tiltAngle) : null,
        azimuth: formData.azimuth ? parseFloat(formData.azimuth) : null,
        daily_load_kwh: formData.dailyLoad ? parseFloat(formData.dailyLoad) : null,
        days_of_autonomy: formData.daysOfAutonomy ? parseInt(formData.daysOfAutonomy) : null,
      });

      if (error) throw error;

      toast.success("Site saved successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to save site");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-energy-blue to-solar-orange bg-clip-text text-transparent">
            Add Site
          </h1>
          <p className="text-muted-foreground">Calculate solar potential, analyze weather patterns, and save your site</p>
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

              <div className="space-y-2 relative" ref={addressContainerRef}>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="e.g., Jakarta, Indonesia or 123 Main St, City"
                  value={formData.address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  autoComplete="off"
                />
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {addressSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0 text-sm"
                        onClick={() => handleAddressSelect(suggestion)}
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span>{suggestion.display_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {formData.latitude && formData.longitude && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Coordinates: {parseFloat(formData.latitude).toFixed(4)}, {parseFloat(formData.longitude).toFixed(4)}
                  </p>
                )}
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
                  <Label htmlFor="daysOfAutonomy">Days of Autonomy (X)</Label>
                  <Input
                    id="daysOfAutonomy"
                    type="number"
                    placeholder="e.g., 2"
                    value={formData.daysOfAutonomy}
                    onChange={(e) => handleInputChange("daysOfAutonomy", e.target.value)}
                  />
                </div>
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                  Advanced Options <ChevronDown className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lookbackYears">Lookback Years</Label>
                      <Input
                        id="lookbackYears"
                        type="number"
                        placeholder="e.g., 10"
                        value={formData.lookbackYears}
                        onChange={(e) => handleInputChange("lookbackYears", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rainMmThreshold">Rain Threshold (mm/day)</Label>
                      <Input
                        id="rainMmThreshold"
                        type="number"
                        step="0.1"
                        placeholder="e.g., 0.2"
                        value={formData.rainMmThreshold}
                        onChange={(e) => handleInputChange("rainMmThreshold", e.target.value)}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button onClick={calculateResults} className="w-full gradient-energy text-white">
                <Calculator className="w-4 h-4 mr-2" />
                Calculate Potential
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-6">
            {/* Map */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-solar-orange" />
                  Site Location
                </CardTitle>
                <CardDescription>Visual representation of selected coordinates</CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={mapContainer} className="h-[300px] rounded-lg border border-border" />
              </CardContent>
            </Card>

            {/* Solar Results */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-solar-orange" />
                  Solar Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-solar-orange/10 to-solar-orange/5 border border-solar-orange/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-solar-orange" />
                          <p className="text-xs font-medium text-muted-foreground">Daily Generation</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{results.dailyGeneration} kWh</p>
                      </div>

                      <div className="p-4 rounded-xl bg-gradient-to-br from-energy-blue/10 to-energy-blue/5 border border-energy-blue/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-energy-blue" />
                          <p className="text-xs font-medium text-muted-foreground">Monthly Generation</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{results.monthlyGeneration} kWh</p>
                      </div>

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

                    {/* Save Site Button */}
                    <Button
                      onClick={saveSite}
                      className="w-full gradient-energy text-white mt-4"
                      size="lg"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Site to Database
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center">
                    <Calculator className="w-12 h-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">Enter coordinates and calculate to see results</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weather Forecast */}
            {weatherData && (
              <>
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-energy-blue" />
                      Next 7 Days Forecast
                    </CardTitle>
                    <CardDescription>Precipitation probability and expected rainfall</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {weatherData.forecast.map((day, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{new Date(day.date).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Droplets className="w-4 h-4 text-energy-blue" />
                            <span className="text-sm font-semibold text-energy-blue">{day.chanceOfRain}%</span>
                          </div>
                          <div className="text-sm text-muted-foreground">{day.totalMm.toFixed(1)} mm</div>
                          <div className="text-sm text-muted-foreground">{day.rainHours.toFixed(1)} hrs</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-eco-green" />
                      Historical Rain Analysis
                    </CardTitle>
                    <CardDescription>
                      Probability of having &gt; {formData.daysOfAutonomy} rainy days in a week
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-6 rounded-xl bg-gradient-to-br from-eco-green/10 to-eco-green/5 border border-eco-green/20">
                      <p className="text-sm text-muted-foreground mb-2">Historical Likelihood</p>
                      <p className="text-4xl font-bold text-foreground">{weatherData.historical.probability}%</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        of weeks had &gt; {formData.daysOfAutonomy} rainy days (≥{formData.rainMmThreshold}mm/day)
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-3">Monthly Breakdown (Last 12 Months)</p>
                      <div className="space-y-2">
                        {weatherData.historical.monthlyBreakdown.map((month, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-20">{month.month}</span>
                            <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-eco-green to-energy-blue rounded-full"
                                style={{ width: `${month.probability}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-12 text-right">{month.probability.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                      Weather data by <strong>Open-Meteo</strong>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSite;
