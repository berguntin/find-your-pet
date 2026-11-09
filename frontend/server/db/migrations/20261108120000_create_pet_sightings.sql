-- migrate:up
-- Someone saw a pet with an open notice. Hidden until moderated, like pets. The author's account can be
-- deleted: the sighting stays, anonymous.
create table pet_sightings (
    id uuid primary key,
    pet_id uuid not null references pets (id) on delete cascade,
    author_id uuid references users (id) on delete set null,
    description text not null check (char_length(description) between 1 and 1000),
    -- An approximate area (a street or neighbourhood), never an exact address.
    area text not null check (char_length(area) between 1 and 120),
    seen_at timestamptz not null,
    images text[] not null default '{}' check (cardinality(images) <= 3),
    moderation_status text not null check (moderation_status in ('approved', 'pending_review')),
    moderation_scores jsonb,
    moderated_at timestamptz,
    verified_at timestamptz,
    verified_by text check (verified_by in ('community', 'owner')),
    -- Optimistic locking: concurrent validations must not miss the verification threshold.
    version integer not null default 0,
    created_at timestamptz not null,
    check ((verified_at is null) = (verified_by is null))
);

create index pet_sightings_pet_idx on pet_sightings (pet_id, seen_at desc);
create index pet_sightings_moderation_idx on pet_sightings (moderation_status, created_at desc);
create index pet_sightings_author_idx on pet_sightings (author_id) where author_id is not null;

-- One validation per user and sighting. Weight 3 when it comes from the pet's owner, 1 otherwise.
create table sighting_validations (
    sighting_id uuid not null references pet_sightings (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    weight smallint not null check (weight in (1, 3)),
    created_at timestamptz not null,
    primary key (sighting_id, user_id)
);

-- Moderation decisions about sightings are logged next to the ones about pets.
alter table moderation_decisions add column sighting_id uuid;

-- migrate:down
alter table moderation_decisions drop column sighting_id;
drop table sighting_validations;
drop table pet_sightings;
