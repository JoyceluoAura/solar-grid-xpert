-- Create enum for sensor types
CREATE TYPE public.sensor_type AS ENUM (
  'thermal',
  'inverter', 
  'voltage',
  'irradiance',
  'environmental',
  'battery',
  'ev_charger',
  'camera'
);

-- Create enum for sensor protocols
CREATE TYPE public.sensor_protocol AS ENUM (
  'mqtt',
  'modbus',
  'http_api',
  'websocket'
);

-- Create enum for sensor status
CREATE TYPE public.sensor_status AS ENUM (
  'online',
  'offline',
  'error'
);

-- Create sensors table
CREATE TABLE public.sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  sensor_name TEXT NOT NULL,
  sensor_type public.sensor_type NOT NULL,
  protocol public.sensor_protocol NOT NULL,
  device_id TEXT NOT NULL,
  endpoint_url TEXT,
  status public.sensor_status DEFAULT 'offline',
  last_reading_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sensor readings table
CREATE TABLE public.sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES public.sensors(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- Create alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sensors
CREATE POLICY "Users can view own sensors"
  ON public.sensors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sensors"
  ON public.sensors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sensors"
  ON public.sensors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sensors"
  ON public.sensors FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for sensor_readings
CREATE POLICY "Users can view own sensor readings"
  ON public.sensor_readings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sensors
      WHERE sensors.id = sensor_readings.sensor_id
      AND sensors.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sensor readings"
  ON public.sensor_readings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sensors
      WHERE sensors.id = sensor_readings.sensor_id
      AND sensors.user_id = auth.uid()
    )
  );

-- RLS Policies for alerts
CREATE POLICY "Users can view own alerts"
  ON public.alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON public.alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON public.alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_sensors_updated_at
  BEFORE UPDATE ON public.sensors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create index for better query performance
CREATE INDEX idx_sensor_readings_sensor_id ON public.sensor_readings(sensor_id);
CREATE INDEX idx_sensor_readings_timestamp ON public.sensor_readings(timestamp);
CREATE INDEX idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX idx_alerts_resolved ON public.alerts(is_resolved);