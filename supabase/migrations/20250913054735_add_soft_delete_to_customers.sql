-- Add deleted_at and updated_at columns to customers table
ALTER TABLE customers ADD COLUMN deleted_at timestamptz;
ALTER TABLE customers ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_customers_deleted_at ON customers(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for customers table to automatically update updated_at
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
