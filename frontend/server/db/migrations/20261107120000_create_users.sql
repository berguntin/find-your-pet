-- migrate:up
-- People who sign in to manage their reports. Kept minimal: only the first name, the one thing others may
-- see. No email or photo is stored (the admin check uses the email in the sealed session).
create table users (
    id uuid primary key,
    display_name text not null check (char_length(display_name) between 1 and 80),
    created_at timestamptz not null
);

-- How each user signs in: one row per provider account (Google `sub`, stable even if the email changes).
create table auth_identities (
    provider text not null check (provider in ('google')),
    subject text not null,
    user_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null,
    primary key (provider, subject)
);

create index auth_identities_user_idx on auth_identities (user_id);

-- Reports keep existing when their owner deletes the account; they just lose the owner.
alter table pets
    add constraint pets_owner_id_fkey foreign key (owner_id) references users (id) on delete set null;

-- migrate:down
alter table pets drop constraint pets_owner_id_fkey;
drop table auth_identities;
drop table users;
