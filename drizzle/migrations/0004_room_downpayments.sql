ALTER TABLE public.room_bookings ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.room_bookings DROP CONSTRAINT IF EXISTS room_bookings_payment_status_check;
ALTER TABLE public.room_bookings ADD CONSTRAINT room_bookings_payment_status_check CHECK (payment_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text, 'refunded'::text]));
ALTER TABLE public.room_bookings ADD CONSTRAINT room_bookings_amount_paid_check CHECK (amount_paid >= 0);
UPDATE public.room_bookings SET amount_paid = amount_due WHERE payment_status IN ('paid', 'refunded') AND amount_paid = 0;