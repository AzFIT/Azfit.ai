-- Allow soft-delete by adding 'archived' to the clients.status enum.
-- Run this on the live database before archiving clients from the UI.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check
  CHECK (status IN ('active', 'inactive', 'on_hold', 'archived'));
