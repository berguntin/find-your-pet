-- migrate:up
create table outbox (
    id uuid primary key default gen_random_uuid(),
    type text not null,
    payload jsonb not null,
    occurred_at timestamptz not null,
    attempts integer not null default 0,
    -- Next time the event may be claimed; also used as the lease while a processor handles it.
    available_at timestamptz not null default now(),
    processed_at timestamptz,
    -- Set when the event exceeded its retries; it stays stored for inspection.
    dead_at timestamptz,
    last_error text
);

create index outbox_pending_idx on outbox (available_at) where processed_at is null and dead_at is null;

-- migrate:down
drop table outbox;
