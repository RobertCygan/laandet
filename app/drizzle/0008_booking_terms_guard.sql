-- N6 (TEST_STRATEGY §4): nobody can change the money terms of a booking after the request — no refund or
-- deduction of a deposit through the platform, and no price change behind the agreement's back.
-- A change of period or handover method (a new agreement revision) only touches period/units/total/methods.
-- rollback: DROP TRIGGER booking_terms_guard ON bookings; DROP FUNCTION check_booking_terms();
CREATE OR REPLACE FUNCTION check_booking_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.listing_id <> OLD.listing_id OR NEW.owner_id <> OLD.owner_id OR NEW.renter_id <> OLD.renter_id
     OR NEW.conversation_id <> OLD.conversation_id OR NEW.value_category <> OLD.value_category
     OR NEW.declared_value_ore <> OLD.declared_value_ore OR NEW.price_ore <> OLD.price_ore
     OR NEW.price_unit <> OLD.price_unit OR NEW.deposit_ore <> OLD.deposit_ore THEN
    RAISE EXCEPTION 'the parties and money terms of booking % cannot change', OLD.id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER booking_terms_guard BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_booking_terms();
