-- migrate:up
-- Every moderation decision, automatic or by an admin. Rejected reports are never stored as pets, so this
-- is the only trace of them; pet_id has no foreign key for the same reason (and survives deleted pets).
create table moderation_decisions (
    id uuid primary key,
    pet_id uuid,
    source text not null check (source in ('automatic', 'admin')),
    decision text not null check (decision in ('approved', 'pending_review', 'rejected')),
    scores jsonb,
    model text,
    -- Set when the moderator failed and the report went to review because of it.
    error text,
    latency_ms integer,
    -- What was reviewed, without contact details or images, to audit rejections.
    submission jsonb,
    decided_at timestamptz not null
);

create index moderation_decisions_decided_at_idx on moderation_decisions (decided_at desc);

-- migrate:down
drop table moderation_decisions;
