/*
  # Customer Payment Methods Table

  1. Purpose
    - Support multiple payment methods per customer
    - Track which payment method is active/default
    - Maintain history of payment methods

  2. New Table Structure
    - customer_payment_methods table
    - Links to existing customers table
    - Supports multiple payment methods with one default

  3. Migration Strategy
    - Create new table
    - Migrate existing data from customers table
    - Keep old columns for backward compatibility initially
*/

-- Create customer_payment_methods table
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    stripe_payment_method_id text NOT NULL,
    stripe_mandate_status text CHECK (stripe_mandate_status IN ('pending', 'inactive', 'active', 'failed')) DEFAULT 'pending',
    payment_method_type text NOT NULL DEFAULT 'sepa_debit',
    is_default boolean DEFAULT false,
    nickname text, -- Optional friendly name like "Personal Account", "Business Account"
    last_four text, -- Last 4 digits for display
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure only one default payment method per customer
    CONSTRAINT unique_default_per_customer EXCLUDE (customer_id WITH =) WHERE (is_default = true)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer_id ON public.customer_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_default ON public.customer_payment_methods(customer_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_stripe_pm_id ON public.customer_payment_methods(stripe_payment_method_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies that match the customers table policies
CREATE POLICY "Users can view payment methods for their customers" 
ON public.customer_payment_methods 
FOR SELECT 
TO authenticated 
USING (
  customer_id IN (
    SELECT id FROM public.customers 
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can insert payment methods for their customers" 
ON public.customer_payment_methods 
FOR INSERT 
TO authenticated 
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customers 
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can update payment methods for their customers" 
ON public.customer_payment_methods 
FOR UPDATE 
TO authenticated 
USING (
  customer_id IN (
    SELECT id FROM public.customers 
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete payment methods for their customers" 
ON public.customer_payment_methods 
FOR DELETE 
TO authenticated 
USING (
  customer_id IN (
    SELECT id FROM public.customers 
    WHERE created_by = auth.uid()
  )
);

-- Function to ensure only one default payment method per customer
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a payment method as default, unset others for same customer
  IF NEW.is_default = true THEN
    UPDATE public.customer_payment_methods 
    SET is_default = false, updated_at = now()
    WHERE customer_id = NEW.customer_id 
      AND id != COALESCE(NEW.id, gen_random_uuid())
      AND is_default = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for the function
DROP TRIGGER IF EXISTS trigger_ensure_single_default_payment_method ON public.customer_payment_methods;
CREATE TRIGGER trigger_ensure_single_default_payment_method
  BEFORE INSERT OR UPDATE ON public.customer_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_payment_method();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_customer_payment_methods_updated_at ON public.customer_payment_methods;
CREATE TRIGGER trigger_update_customer_payment_methods_updated_at
  BEFORE UPDATE ON public.customer_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_payment_methods_updated_at();

-- Migrate existing payment method data from customers table
INSERT INTO public.customer_payment_methods (
  customer_id, 
  stripe_payment_method_id, 
  stripe_mandate_status, 
  is_default, 
  nickname,
  created_at
)
SELECT 
  id as customer_id,
  stripe_payment_method_id,
  COALESCE(stripe_mandate_status, 'pending') as stripe_mandate_status,
  true as is_default, -- Set as default since it's the only one
  'Primary Payment Method' as nickname,
  created_at
FROM public.customers 
WHERE stripe_payment_method_id IS NOT NULL
ON CONFLICT DO NOTHING; -- In case migration is run multiple times

-- Add helpful comment
COMMENT ON TABLE public.customer_payment_methods IS 'Stores multiple payment methods per customer with support for default selection';
COMMENT ON COLUMN public.customer_payment_methods.is_default IS 'Only one payment method per customer can be default';
COMMENT ON COLUMN public.customer_payment_methods.nickname IS 'User-friendly name for the payment method';
COMMENT ON COLUMN public.customer_payment_methods.last_four IS 'Last 4 digits of account for display purposes'; 