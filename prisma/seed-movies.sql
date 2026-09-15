-- Development movie booking inventory. Safe to run more than once.
DO $$
DECLARE
  organizer_id TEXT;
  venue_id TEXT;
  event_id TEXT;
  recliner_type_id TEXT;
  prime_type_id TEXT;
  classic_type_id TEXT;
  recliner_section_id TEXT;
  prime_section_id TEXT;
  classic_section_id TEXT;
BEGIN
  SELECT id INTO organizer_id FROM "User" ORDER BY "createdAt" LIMIT 1;
  IF organizer_id IS NULL THEN
    RAISE EXCEPTION 'Create a user account before seeding movie data.';
  END IF;

  SELECT id INTO event_id FROM "Event" WHERE name = 'The Midnight Archive' LIMIT 1;
  IF event_id IS NOT NULL THEN RETURN; END IF;

  venue_id := md5(random()::text || clock_timestamp()::text);
  INSERT INTO "Venue" (id, "createdById", name, address, city, capacity, "createdAt", "updatedAt")
  VALUES (venue_id, organizer_id, 'Grand Cinema', '18 Regent Street', 'Bengaluru', 110, now(), now());

  recliner_section_id := md5(random()::text || clock_timestamp()::text);
  prime_section_id := md5(random()::text || clock_timestamp()::text);
  classic_section_id := md5(random()::text || clock_timestamp()::text);
  INSERT INTO "VenueSection" (id, "venueId", name, capacity, "createdAt", "updatedAt") VALUES
    (recliner_section_id, venue_id, 'RECLINER', 8, now(), now()),
    (prime_section_id, venue_id, 'PRIME', 60, now(), now()),
    (classic_section_id, venue_id, 'CLASSIC', 42, now(), now());

  INSERT INTO "Seat" (id, "sectionId", "rowNumber", "seatNumber", "seatType", "createdAt")
    SELECT md5(random()::text || gs::text || clock_timestamp()::text), recliner_section_id, 8, gs, 'VIP', now() FROM generate_series(1, 8) gs;
  INSERT INTO "Seat" (id, "sectionId", "rowNumber", "seatNumber", "seatType", "createdAt")
    SELECT md5(random()::text || row_num::text || seat_num::text || clock_timestamp()::text), prime_section_id, row_num, seat_num, 'PREMIUM', now()
    FROM generate_series(3, 7) row_num CROSS JOIN generate_series(1, 12) seat_num;
  INSERT INTO "Seat" (id, "sectionId", "rowNumber", "seatNumber", "seatType", "createdAt")
    SELECT md5(random()::text || row_num::text || seat_num::text || clock_timestamp()::text), classic_section_id, row_num, seat_num, 'REGULAR', now()
    FROM generate_series(0, 2) row_num CROSS JOIN generate_series(1, 14) seat_num;

  event_id := md5(random()::text || clock_timestamp()::text);
  INSERT INTO "Event" (id, "organizerId", "venueId", name, description, type, "startTime", "endTime", status, "createdAt", "updatedAt")
  VALUES (event_id, organizer_id, venue_id, 'The Midnight Archive', 'UA · 2h 18m · English · Mystery Drama', 'MOVIE', now() + interval '7 days', now() + interval '7 days 2 hours 18 minutes', 'PUBLISHED', now(), now());

  recliner_type_id := md5(random()::text || clock_timestamp()::text);
  prime_type_id := md5(random()::text || clock_timestamp()::text);
  classic_type_id := md5(random()::text || clock_timestamp()::text);
  INSERT INTO "TicketType" (id, "eventId", name, description, "basePrice", quantity, "createdAt", "updatedAt") VALUES
    (recliner_type_id, event_id, 'RECLINER', 'Premium recliner seats', 570, 8, now(), now()),
    (prime_type_id, event_id, 'PRIME', 'Best view seats', 350, 60, now(), now()),
    (classic_type_id, event_id, 'CLASSIC', 'Comfortable value seats', 220, 42, now(), now());

  INSERT INTO "TicketInventory" (id, "eventId", "seatId", "ticketTypeId", "currentPrice", status, version, "createdAt", "updatedAt")
  SELECT md5(random()::text || s.id || clock_timestamp()::text), event_id, s.id,
    CASE vs.name WHEN 'RECLINER' THEN recliner_type_id WHEN 'PRIME' THEN prime_type_id ELSE classic_type_id END,
    CASE vs.name WHEN 'RECLINER' THEN 570 WHEN 'PRIME' THEN 350 ELSE 220 END, 'AVAILABLE', 0, now(), now()
  FROM "Seat" s JOIN "VenueSection" vs ON vs.id = s."sectionId";

  INSERT INTO "PricingPolicy" (id, "eventId", enabled, "minimumPrice", "maximumPrice", "createdAt", "updatedAt")
  VALUES (md5(random()::text || clock_timestamp()::text), event_id, true, 180, 800, now(), now());
  INSERT INTO "PricingRule" (id, "policyId", name, type, "adjustmentType", "adjustmentValue", conditions, priority, enabled, "createdAt", "updatedAt")
  SELECT md5(random()::text || clock_timestamp()::text), id, 'High demand uplift', 'INVENTORY', 'PERCENTAGE', 12, '{"remainingPercentage":30}', 10, true, now(), now()
  FROM "PricingPolicy" WHERE "eventId" = event_id;
END $$;
