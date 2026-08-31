-- Owner Tasks (feat/session-nav-polish), Task 4b — ONE-TIME data fix.
-- Event titles read "PT with {ClientName}"; the house style is now
-- "{ClientName} PT" (shorter, truncates better on week tiles). New bookings
-- already use it (BookSessionDialog); this renames existing rows.
-- Idempotent: after one run no 'PT with %' titles remain.
-- NOT a schema change — do not mirror into schema.sql.

update public.sessions
set title = substr(title, 9) || ' PT'
where title like 'PT with %';
