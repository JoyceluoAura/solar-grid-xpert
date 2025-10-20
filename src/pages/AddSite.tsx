import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const AddSite = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [mapboxToken, setMapboxToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(true);
  const [formData, setFormData] = useState({
    siteName: "",
    address: "",
    latitude: "",
    longitude: "",
    systemSize: "",
    panelEfficiency: "95",
    tiltAngle: "30",
    azimuth: "180",
    dailyLoad: "",
    daysOfAutonomy: "2",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const initializeMap = (token: string) => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283], // Center of USA
      zoom: 4,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add click handler to place marker
    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;

      // Update form data
      setFormData((prev) => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));

      // Place marker
      if (marker.current) {
        marker.current.remove();
      }

      marker.current = new mapboxgl.Marker({ color: "#F79E1B" })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      // Reverse geocode to get address
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.features && data.features.length > 0) {
            setFormData((prev) => ({
              ...prev,
              address: data.features[0].place_name,
            }));
          }
        })
        .catch((err) => console.error("Geocoding error:", err));
    });
  };

  const handleTokenSubmit = () => {
    if (mapboxToken.trim()) {
      localStorage.setItem("mapbox_token", mapboxToken);
      setShowTokenInput(false);
      initializeMap(mapboxToken);
    } else {
      toast.error("Please enter a valid Mapbox token");
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("mapbox_token");
    if (savedToken) {
      setMapboxToken(savedToken);
      setShowTokenInput(false);
      setTimeout(() => initializeMap(savedToken), 100);
    }

    return () => {
      if (map.current) map.current.remove();
    };
  }, []);

  const saveSite = async () => {
    if (!user) {
      toast.error("You must be logged in to save a site");
      return;
    }

    if (!formData.siteName || !formData.latitude || !formData.longitude) {
      toast.error("Please fill in site name and select a location on the map");
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
            Add New Site
          </h1>
          <p className="text-muted-foreground">Enter site details and select location on the map</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Map Section */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-solar-orange" />
                Site Location
              </CardTitle>
              <CardDescription>Click on the map to select your site location</CardDescription>
            </CardHeader>
            <CardContent>
              {showTokenInput ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground mb-4">
                      To use the interactive map, you need a Mapbox public token. Get one for free at{" "}
                      <a
                        href="https://mapbox.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-energy-blue hover:underline"
                      >
                        mapbox.com
                      </a>
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="mapboxToken">Mapbox Public Token</Label>
                      <Input
                        id="mapboxToken"
                        type="text"
                        placeholder="pk.eyJ1..."
                        value={mapboxToken}
                        onChange={(e) => setMapboxToken(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleTokenSubmit} className="w-full mt-4 gradient-energy text-white">
                      Load Map
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div ref={mapContainer} className="h-[400px] rounded-lg border border-border" />
                  {formData.latitude && formData.longitude && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-sm font-medium">
                        Selected: {formData.latitude}, {formData.longitude}
                      </p>
                      {formData.address && <p className="text-xs text-muted-foreground mt-1">{formData.address}</p>}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Section */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Site Information</CardTitle>
              <CardDescription>Enter details about your solar installation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siteName">Site Name *</Label>
                <Input
                  id="siteName"
                  placeholder="e.g., Downtown Solar Farm"
                  value={formData.siteName}
                  onChange={(e) => handleInputChange("siteName", e.target.value)}
                />
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
                  <Label htmlFor="daysOfAutonomy">Days of Autonomy</Label>
                  <Input
                    id="daysOfAutonomy"
                    type="number"
                    placeholder="e.g., 2"
                    value={formData.daysOfAutonomy}
                    onChange={(e) => handleInputChange("daysOfAutonomy", e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={saveSite} className="w-full gradient-energy text-white">
                <Save className="w-4 h-4 mr-2" />
                Save Site
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AddSite;
