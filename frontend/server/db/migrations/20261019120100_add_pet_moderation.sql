-- migrate:up
alter table pets
    add column moderation_status text not null default 'pending_review'
        check (moderation_status in ('approved', 'pending_review')),
    add column moderation_scores jsonb,
    add column moderated_at timestamptz;

-- The public listing only ever reads approved pets.
drop index pets_listing_idx;
create index pets_public_listing_idx on pets (created_at desc, id desc) where moderation_status = 'approved';
create index pets_moderation_idx on pets (moderation_status, created_at desc);

-- migrate:down
drop index pets_moderation_idx;
drop index pets_public_listing_idx;
create index pets_listing_idx on pets (created_at desc, id desc);
alter table pets drop column moderated_at, drop column moderation_scores, drop column moderation_status;
