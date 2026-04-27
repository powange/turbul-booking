CREATE UNIQUE INDEX IF NOT EXISTS "Booking_bedId_date_guestId_key" ON "Booking"("bedId", "date", "guestId");
