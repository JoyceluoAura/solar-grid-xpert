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
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const AddSite = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);

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

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    // Initialize Leaflet map with OpenStreetMap tiles
    map.current = L.map(mapContainer.current).setView([-2.5, 118.0], 5);

    // Add OpenStreetMap tile layer with proper attribution
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Add click handler to place marker
    map.current.on("click", (e) => {
      const { lat, lng } = e.latlng;

      // Update form data
      setFormData((prev) => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));

      // Place marker
      if (marker.current) {
        map.current?.removeLayer(marker.current);
      }

      // Create custom icon
      const customIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      marker.current = L.marker([lat, lng], { icon: customIcon }).addTo(map.current!);

      // Reverse geocode using Nominatim (OSM service)
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: {
          "User-Agent": "SolarGridX/1.0 (Solar monitoring platform)",
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.display_name) {
            setFormData((prev) => ({
              ...prev,
              address: data.display_name,
            }));
          }
        })
        .catch((err) => console.error("Geocoding error:", err));
    });
  };

  useEffect(() => {
    // Initialize map on mount
    setTimeout(() => initializeMap(), 100);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
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
