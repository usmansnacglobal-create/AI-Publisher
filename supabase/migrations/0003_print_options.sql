-- Hardcover pricing for submissions. Safe to run more than once.
alter table public.submissions add column if not exists hardcover_price numeric(10,2);

-- Make the API see the new column straight away.
notify pgrst, 'reload schema';
