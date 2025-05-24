-- Add fields to track payment method actions for frontend notifications
ALTER TABLE customers 
ADD COLUMN last_payment_method_action VARCHAR(50),
ADD COLUMN last_payment_method_action_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN customers.last_payment_method_action IS 'Tracks the last payment method action for frontend notifications (e.g., updated_existing)';
COMMENT ON COLUMN customers.last_payment_method_action_at IS 'Timestamp of the last payment method action'; 