-- migrate:up
-- The post that announces each pet on each social network of ours (its Facebook Page, for now).
create table pet_social_posts (
    -- No foreign key: the row must outlive the pet so the post can be deleted after the pet is.
    pet_id uuid not null,
    network text not null,
    post_id text not null,
    published_at timestamptz not null,
    primary key (pet_id, network)
);

-- migrate:down
drop table pet_social_posts;
