-- Sprint 8.2D-C: vehicle registration captured at EV charger hold time.
ALTER TABLE "ev_sessions" ADD COLUMN "vehicle_number" VARCHAR(20);
