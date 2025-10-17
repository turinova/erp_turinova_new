-- Add deleted_at and updated_at columns to brands table
ALTER TABLE brands ADD COLUMN deleted_at timestamptz;
ALTER TABLE brands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_brands_deleted_at ON brands(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for brands table to automatically update updated_at
CREATE TRIGGER update_brands_updated_at 
    BEFORE UPDATE ON brands 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
