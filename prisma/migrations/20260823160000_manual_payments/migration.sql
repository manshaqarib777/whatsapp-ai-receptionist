-- Milestone 12 repair: cash/offline settlement is a real auditable payment.
ALTER TYPE "payment_gateway" ADD VALUE 'manual' BEFORE 'stripe';
