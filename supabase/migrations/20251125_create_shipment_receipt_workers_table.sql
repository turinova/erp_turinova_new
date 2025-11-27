-- Create shipment_receipt_workers table to track which workers received shipments
CREATE TABLE IF NOT EXISTS public.shipment_receipt_workers (
  shipment_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shipment_receipt_workers_pkey PRIMARY KEY (shipment_id, worker_id),
  CONSTRAINT shipment_receipt_workers_shipment_id_fkey FOREIGN KEY (shipment_id) 
    REFERENCES public.shipments(id) ON DELETE CASCADE,
  CONSTRAINT shipment_receipt_workers_worker_id_fkey FOREIGN KEY (worker_id) 
    REFERENCES public.workers(id) ON DELETE RESTRICT
) TABLESPACE pg_default;

-- Index for querying by shipment
CREATE INDEX IF NOT EXISTS idx_shipment_receipt_workers_shipment_id 
  ON public.shipment_receipt_workers(shipment_id) 
  TABLESPACE pg_default;

-- Index for querying by worker (for bonus calculations)
CREATE INDEX IF NOT EXISTS idx_shipment_receipt_workers_worker_id 
  ON public.shipment_receipt_workers(worker_id) 
  TABLESPACE pg_default;

-- Index for querying by received_at (for date range queries)
CREATE INDEX IF NOT EXISTS idx_shipment_receipt_workers_received_at 
  ON public.shipment_receipt_workers(received_at) 
  TABLESPACE pg_default;

