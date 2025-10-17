-- Create hozzáadott_panelek table for optimization
CREATE TABLE IF NOT EXISTS public.hozzáadott_panelek (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    táblásAnyag character varying NOT NULL,
    hosszúság character varying NOT NULL,
    szélesség character varying NOT NULL,
    darab character varying NOT NULL,
    jelölés character varying,
    élzárás character varying,
    élzárásA character varying,
    élzárásB character varying,
    élzárásC character varying,
    élzárásD character varying,
    customer_id uuid REFERENCES customers(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone NULL,
    CONSTRAINT hozzáadott_panelek_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hozzáadott_panelek_customer_id ON public.hozzáadott_panelek USING btree (customer_id) TABLESPACE pg_default WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_hozzáadott_panelek_táblásAnyag ON public.hozzáadott_panelek USING btree (táblásAnyag) TABLESPACE pg_default WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_hozzáadott_panelek_deleted_at ON public.hozzáadott_panelek USING btree (deleted_at) TABLESPACE pg_default WHERE (deleted_at IS NULL);

-- Create updated_at trigger
CREATE TRIGGER update_hozzáadott_panelek_updated_at 
    BEFORE UPDATE ON hozzáadott_panelek 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data
INSERT INTO public.hozzáadott_panelek (táblásAnyag, hosszúság, szélesség, darab, jelölés, élzárás, élzárásA, élzárásB, élzárásC, élzárásD) VALUES
('103 FS3', '600', '400', '2', 'Első panel', '0.4mm', '0.4mm', '0.4mm', '0.4mm', '0.4mm'),
('103 FS3', '800', '600', '1', 'Második panel', '0.4mm', '0.4mm', '0.4mm', '0.4mm', '0.4mm'),
('103 FS3', '1200', '800', '3', 'Harmadik panel', '0.4mm', '0.4mm', '0.4mm', '0.4mm', '0.4mm');
