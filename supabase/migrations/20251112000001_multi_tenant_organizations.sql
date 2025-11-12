-- Multi-tenant Organizations Schema for SaaS

-- Subscription tiers enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'starter', 'professional', 'enterprise');

-- Organization roles enum
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'manager', 'viewer');

-- Site connection status enum
CREATE TYPE public.connection_status AS ENUM ('online', 'low_power', 'offline');

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_tier public.subscription_tier DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  max_sites INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb,
  billing_email TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT
);

-- Organization members (users belong to organizations)
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- User profiles (extended user info)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing sites table to be org-scoped
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS connection_status public.connection_status DEFAULT 'offline';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS power_mode TEXT DEFAULT 'normal'; -- normal, low_power, offline
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS battery_level NUMERIC;

-- Update sensors table to track organization
ALTER TABLE public.sensors ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add cached data tracking
CREATE TABLE public.cached_sensor_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES public.sensors(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_at TIMESTAMP WITH TIME ZONE,
  is_uploaded BOOLEAN DEFAULT FALSE
);

-- Site heartbeats table
CREATE TABLE public.site_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  power_mode TEXT NOT NULL,
  battery_level NUMERIC,
  network_type TEXT, -- '4g', '5g', 'lora', 'satellite'
  signal_strength NUMERIC,
  metadata JSONB
);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_sensor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_heartbeats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organizations"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can update"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for organization_members
CREATE POLICY "Members can view their organization members"
  ON public.organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage members"
  ON public.organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Update sites RLS policies for multi-tenancy
DROP POLICY IF EXISTS "Users can view own sites" ON public.sites;
CREATE POLICY "Organization members can view sites"
  ON public.sites FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own sites" ON public.sites;
CREATE POLICY "Organization managers can create sites"
  ON public.sites FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Users can update own sites" ON public.sites;
CREATE POLICY "Organization managers can update sites"
  ON public.sites FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Users can delete own sites" ON public.sites;
CREATE POLICY "Organization admins can delete sites"
  ON public.sites FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Update sensors RLS for multi-tenancy
DROP POLICY IF EXISTS "Users can view own sensors" ON public.sensors;
CREATE POLICY "Organization members can view sensors"
  ON public.sensors FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own sensors" ON public.sensors;
CREATE POLICY "Organization managers can create sensors"
  ON public.sensors FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- RLS for cached data
CREATE POLICY "Organization members can view cached data"
  ON public.cached_sensor_data FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM public.sites
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS for heartbeats
CREATE POLICY "Organization members can view heartbeats"
  ON public.site_heartbeats FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM public.sites
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Indexes for performance
CREATE INDEX idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_sites_org_id ON public.sites(organization_id);
CREATE INDEX idx_sites_connection_status ON public.sites(connection_status);
CREATE INDEX idx_sites_last_heartbeat ON public.sites(last_heartbeat_at);
CREATE INDEX idx_sensors_org_id ON public.sensors(organization_id);
CREATE INDEX idx_cached_data_uploaded ON public.cached_sensor_data(is_uploaded);
CREATE INDEX idx_heartbeats_site_id ON public.site_heartbeats(site_id);
CREATE INDEX idx_heartbeats_received_at ON public.site_heartbeats(received_at DESC);

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check site heartbeat status
CREATE OR REPLACE FUNCTION public.check_site_heartbeat_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If last heartbeat is older than 30 minutes, mark as offline
  IF NEW.last_heartbeat_at < NOW() - INTERVAL '30 minutes' THEN
    NEW.connection_status = 'offline';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger updates
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
