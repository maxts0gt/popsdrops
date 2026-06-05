ALTER TYPE payment_status_type ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE payment_status_type ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE payment_status_type ADD VALUE IF NOT EXISTS 'disputed';
