-- Solar Panel Image Analysis Schema

-- Defect types detected by YOLO model
CREATE TYPE public.defect_type AS ENUM (
  'hotspot',
  'crack',
  'delamination',
  'discoloration',
  'soiling',
  'snail_trail',
  'pid_effect',
  'broken_cell',
  'connection_issue',
  'physical_damage'
);

-- Analysis status
CREATE TYPE public.analysis_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- Severity levels
CREATE TYPE public.severity_level AS ENUM (
  'critical',
  'high',
  'medium',
  'low',
  'info'
);

-- Image analysis table
CREATE TABLE public.panel_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  image_url TEXT NOT NULL,
  image_filename TEXT NOT NULL,
  analysis_status public.analysis_status DEFAULT 'pending',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Detected defects table
CREATE TABLE public.detected_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES public.panel_images(id) ON DELETE CASCADE,
  defect_type public.defect_type NOT NULL,
  severity public.severity_level NOT NULL,
  confidence NUMERIC(5,2) NOT NULL, -- 0.00 to 100.00
  bounding_box JSONB, -- {x, y, width, height}
  description TEXT,
  recommended_action TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Action items generated from defects
CREATE TABLE public.action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  defect_id UUID REFERENCES public.detected_defects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity public.severity_level NOT NULL,
  priority INTEGER DEFAULT 0, -- Higher number = higher priority
  status TEXT DEFAULT 'open', -- open, in_progress, completed, dismissed
  assigned_to UUID REFERENCES auth.users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- YOLO model inference results (raw)
CREATE TABLE public.yolo_inference_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES public.panel_images(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL, -- e.g., "yolov11_det"
  inference_time_ms INTEGER,
  raw_output JSONB NOT NULL, -- Raw YOLO output
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.panel_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detected_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yolo_inference_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for panel_images
CREATE POLICY "Organization members can view images"
  ON public.panel_images FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization managers can upload images"
  ON public.panel_images FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Organization managers can update images"
  ON public.panel_images FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- RLS Policies for detected_defects
CREATE POLICY "Organization members can view defects"
  ON public.detected_defects FOR SELECT
  USING (
    image_id IN (
      SELECT id FROM public.panel_images
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Organization managers can update defects"
  ON public.detected_defects FOR UPDATE
  USING (
    image_id IN (
      SELECT id FROM public.panel_images
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
      )
    )
  );

-- RLS Policies for action_items
CREATE POLICY "Organization members can view action items"
  ON public.action_items FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization managers can create action items"
  ON public.action_items FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Organization members can update assigned action items"
  ON public.action_items FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for yolo_inference_results
CREATE POLICY "Organization members can view inference results"
  ON public.yolo_inference_results FOR SELECT
  USING (
    image_id IN (
      SELECT id FROM public.panel_images
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Indexes for performance
CREATE INDEX idx_panel_images_org_id ON public.panel_images(organization_id);
CREATE INDEX idx_panel_images_site_id ON public.panel_images(site_id);
CREATE INDEX idx_panel_images_status ON public.panel_images(analysis_status);
CREATE INDEX idx_panel_images_uploaded_at ON public.panel_images(uploaded_at DESC);

CREATE INDEX idx_detected_defects_image_id ON public.detected_defects(image_id);
CREATE INDEX idx_detected_defects_severity ON public.detected_defects(severity);
CREATE INDEX idx_detected_defects_is_resolved ON public.detected_defects(is_resolved);

CREATE INDEX idx_action_items_org_id ON public.action_items(organization_id);
CREATE INDEX idx_action_items_site_id ON public.action_items(site_id);
CREATE INDEX idx_action_items_severity ON public.action_items(severity);
CREATE INDEX idx_action_items_status ON public.action_items(status);
CREATE INDEX idx_action_items_assigned_to ON public.action_items(assigned_to);
CREATE INDEX idx_action_items_priority ON public.action_items(priority DESC);

CREATE INDEX idx_yolo_results_image_id ON public.yolo_inference_results(image_id);

-- Triggers
CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Function to auto-create action items from high severity defects
CREATE OR REPLACE FUNCTION public.create_action_item_from_defect()
RETURNS TRIGGER AS $$
DECLARE
  v_image_record RECORD;
BEGIN
  -- Only create action items for high and critical severity
  IF NEW.severity IN ('critical', 'high') THEN
    -- Get image and site info
    SELECT pi.organization_id, pi.site_id, s.name as site_name
    INTO v_image_record
    FROM public.panel_images pi
    LEFT JOIN public.sites s ON s.id = pi.site_id
    WHERE pi.id = NEW.image_id;

    -- Create action item
    INSERT INTO public.action_items (
      organization_id,
      site_id,
      defect_id,
      title,
      description,
      severity,
      priority,
      status
    ) VALUES (
      v_image_record.organization_id,
      v_image_record.site_id,
      NEW.id,
      format('%s detected: %s',
        INITCAP(REPLACE(NEW.defect_type::TEXT, '_', ' ')),
        v_image_record.site_name
      ),
      format('%s (Confidence: %s%%)', NEW.description, NEW.confidence),
      NEW.severity,
      CASE NEW.severity
        WHEN 'critical' THEN 100
        WHEN 'high' THEN 50
        ELSE 0
      END,
      'open'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create action items from defects
CREATE TRIGGER on_defect_detected
  AFTER INSERT ON public.detected_defects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_action_item_from_defect();

-- View for dashboard action items summary
CREATE OR REPLACE VIEW public.dashboard_action_items AS
SELECT
  ai.*,
  s.name as site_name,
  s.location as site_location,
  dd.defect_type,
  dd.confidence,
  pi.image_url,
  p.full_name as assigned_to_name
FROM public.action_items ai
LEFT JOIN public.sites s ON s.id = ai.site_id
LEFT JOIN public.detected_defects dd ON dd.id = ai.defect_id
LEFT JOIN public.panel_images pi ON pi.id = dd.image_id
LEFT JOIN public.profiles p ON p.id = ai.assigned_to
WHERE ai.status IN ('open', 'in_progress')
ORDER BY ai.priority DESC, ai.created_at DESC;

COMMENT ON TABLE public.panel_images IS 'Stores uploaded solar panel images for AI analysis';
COMMENT ON TABLE public.detected_defects IS 'Defects detected by YOLO model in panel images';
COMMENT ON TABLE public.action_items IS 'Action items generated from detected defects';
COMMENT ON TABLE public.yolo_inference_results IS 'Raw YOLO model inference results';
