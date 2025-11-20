-- Create PIN lookup table
CREATE TABLE IF NOT EXISTS public.user_pins (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  pin VARCHAR(6) NOT NULL UNIQUE,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  failed_attempts INT DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE NULL
);

-- Index for fast PIN lookup
CREATE INDEX idx_user_pins_pin_active ON public.user_pins(pin) WHERE is_active = true;

-- Index for worker_id lookups
CREATE INDEX IF NOT EXISTS idx_user_pins_worker_id ON public.user_pins(worker_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_user_pins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trigger_update_user_pins_updated_at
  BEFORE UPDATE ON public.user_pins
  FOR EACH ROW
  EXECUTE FUNCTION update_user_pins_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_pins TO authenticated;

