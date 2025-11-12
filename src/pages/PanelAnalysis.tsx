import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Camera,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ImageIcon,
  Zap,
  Info,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PanelImage {
  id: string;
  site_id: string;
  image_url: string;
  image_filename: string;
  analysis_status: string;
  uploaded_at: string;
  analyzed_at: string | null;
  sites: {
    name: string;
  };
}

interface Defect {
  id: string;
  defect_type: string;
  severity: string;
  confidence: number;
  description: string;
  recommended_action: string;
  is_resolved: boolean;
  detected_at: string;
}

const PanelAnalysis = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [images, setImages] = useState<PanelImage[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<PanelImage | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSites();
      fetchImages();
    }
  }, [user]);

  useEffect(() => {
    if (selectedImage) {
      fetchDefects(selectedImage.id);
    }
  }, [selectedImage]);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("name");

      if (error) throw error;
      setSites(data || []);
    } catch (error: any) {
      console.error("Error fetching sites:", error);
    }
  };

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from("panel_images")
        .select("*, sites(name)")
        .order("uploaded_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setImages(data || []);
    } catch (error: any) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDefects = async (imageId: string) => {
    try {
      const { data, error } = await supabase
        .from("detected_defects")
        .select("*")
        .eq("image_id", imageId)
        .order("severity", { ascending: false });

      if (error) throw error;
      setDefects(data || []);
    } catch (error: any) {
      console.error("Error fetching defects:", error);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedSite) {
      toast({
        title: "Error",
        description: "Please select a site first",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `panel-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("panel-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("panel-images")
        .getPublicUrl(filePath);

      // Get organization ID
      const { data: orgData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user?.id)
        .single();

      // Create image record
      const { data: imageData, error: insertError } = await supabase
        .from("panel_images")
        .insert({
          organization_id: orgData?.organization_id,
          site_id: selectedSite,
          uploaded_by: user?.id,
          image_url: publicUrl,
          image_filename: file.name,
          analysis_status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });

      // Trigger analysis
      await analyzeImage(imageData.id);

      fetchImages();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const analyzeImage = async (imageId: string) => {
    setAnalyzing(true);

    try {
      const response = await fetch("http://localhost:3001/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageId }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Analysis Complete",
          description: `Detected ${result.defectsCount} defect(s)`,
        });

        fetchImages();
      } else {
        throw new Error(result.error || "Analysis failed");
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "high":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case "medium":
        return <Zap className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Analyzed</Badge>;
      case "processing":
        return <Badge className="bg-blue-500">Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-500">Failed</Badge>;
      default:
        return <Badge className="bg-gray-500">Pending</Badge>;
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Camera className="h-8 w-8" />
            <span>AI Panel Analysis</span>
          </h1>
          <p className="text-muted-foreground">
            Detect defects using Qualcomm YOLO v11
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button disabled={!selectedSite || uploading} className="relative">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={handleImageUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={!selectedSite || uploading}
            />
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload Image
          </Button>
        </div>
      </div>

      {analyzing && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-sm">Analyzing image with YOLO v11 model...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Images List */}
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Images ({images.length})</CardTitle>
            <CardDescription>Recent panel images for analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {images.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No images uploaded yet</p>
                </div>
              ) : (
                images.map((image) => (
                  <div
                    key={image.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedImage?.id === image.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedImage(image)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{image.image_filename}</p>
                        <p className="text-sm text-muted-foreground">
                          {image.sites?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(image.uploaded_at).toLocaleString()}
                        </p>
                      </div>
                      {getStatusBadge(image.analysis_status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Image Details & Defects */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedImage ? "Defects Detected" : "Select an Image"}
            </CardTitle>
            <CardDescription>
              {selectedImage
                ? `Analysis results for ${selectedImage.image_filename}`
                : "Click on an image to view defects"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedImage ? (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select an image from the list to view analysis results</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Defects Summary */}
                {defects.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">
                        {defects.filter((d) => d.severity === "critical").length}
                      </div>
                      <div className="text-xs text-muted-foreground">Critical</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">
                        {defects.filter((d) => d.severity === "high").length}
                      </div>
                      <div className="text-xs text-muted-foreground">High</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-500">
                        {defects.filter((d) => d.severity === "medium").length}
                      </div>
                      <div className="text-xs text-muted-foreground">Medium</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">
                        {defects.filter((d) => d.severity === "low").length}
                      </div>
                      <div className="text-xs text-muted-foreground">Low</div>
                    </div>
                  </div>
                )}

                {/* Defects List */}
                {defects.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No defects detected</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[450px] overflow-y-auto">
                    {defects.map((defect) => (
                      <div
                        key={defect.id}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getSeverityIcon(defect.severity)}
                            <span className="font-semibold capitalize">
                              {defect.defect_type.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getSeverityColor(defect.severity)}>
                              {defect.severity}
                            </Badge>
                            <Badge variant="outline">
                              {defect.confidence}% confidence
                            </Badge>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">
                          {defect.description}
                        </p>

                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-xs font-medium mb-1">Recommended Action:</p>
                          <p className="text-sm">{defect.recommended_action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PanelAnalysis;
