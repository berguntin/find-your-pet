-- migrate:up
-- Supabase: the extension is called "vector" and can also be enabled from the dashboard.
create extension if not exists vector;

-- One vector per photo: image search and text-to-photo search.
create table pet_image_embeddings (
    pet_id uuid not null references pets (id) on delete cascade,
    image_url text not null,
    -- Vectors from different models are never compared; changing model means reindexing.
    model text not null,
    embedding vector(768) not null,
    created_at timestamptz not null default now(),
    primary key (pet_id, image_url, model)
);

-- One vector per report text (species, description, name, location): semantic text search.
create table pet_text_embeddings (
    pet_id uuid not null references pets (id) on delete cascade,
    model text not null,
    embedding vector(768) not null,
    created_at timestamptz not null default now(),
    primary key (pet_id, model)
);

create index pet_image_embeddings_hnsw_idx on pet_image_embeddings using hnsw (embedding vector_cosine_ops);
create index pet_text_embeddings_hnsw_idx on pet_text_embeddings using hnsw (embedding vector_cosine_ops);

-- migrate:down
drop table pet_text_embeddings;
drop table pet_image_embeddings;
