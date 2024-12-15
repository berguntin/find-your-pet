CREATE DATABASE IF NOT EXISTS pets_db;
USE pets_db;

create type pet_type as enum('Perro', 'Gato', 'Otro');

create type pet_status as enum('lost', 'found');

create table if not exists
  pets (
    id uuid primary key default gen_random_uuid (),
    type text check (
      type in ('Perro', 'Gato', 'Otro')
    ) not null,
    images JSONB,
    description text,
    name text,
    status text check (status in ('lost', 'found')) not null,
    location text not null,
    alive boolean default true,
    contact text not null,
    date timestamp with time zone not null,
    atHome boolean default false,
    created_by text not null,
    created_at timestamp with time zone default current_timestamp
  );