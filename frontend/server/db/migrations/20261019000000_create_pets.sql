-- migrate:up
create table pets (
    id uuid primary key,
    report_type text not null check (report_type in ('lost', 'found')),
    species text not null check (species in ('dog', 'cat', 'other')),
    name text,
    description text not null,
    location text not null,
    contact text not null,
    images text[] not null check (cardinality(images) between 1 and 10),
    alive boolean not null default true,
    event_date date not null,
    resolution text not null default 'open' check (resolution in ('open', 'reunited')),
    resolved_by text check (resolved_by in ('owner', 'community', 'admin')),
    resolved_at timestamptz,
    -- Filled once Google login exists; anonymous reports keep it null.
    owner_id uuid,
    created_at timestamptz not null default now(),
    check ((resolution = 'open') = (resolved_by is null and resolved_at is null))
);

create index pets_listing_idx on pets (created_at desc, id desc);
create index pets_filters_idx on pets (report_type, resolution, species);
create index pets_owner_idx on pets (owner_id) where owner_id is not null;

-- migrate:down
drop table pets;
