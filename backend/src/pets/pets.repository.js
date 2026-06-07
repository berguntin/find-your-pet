import db from '../config/database.js';

export async function findAll() {
  const pets = await db`SELECT * FROM pets ORDER BY created_at DESC`;
  return pets.map((pet) => ({ ...pet, images: pet.images ?? [] }));
}

export async function findById(id) {
  const [pet] = await db`SELECT * FROM pets WHERE id = ${id}`;
  if (pet) pet.images = pet.images ?? [];
  return pet ?? null;
}

export async function insert(data) {
  const {
    type,
    images,
    description,
    name,
    status,
    location,
    alive,
    contact,
    date,
    created_by,
    created_at,
  } = data;

  const [pet] = await db`
    INSERT INTO pets
      (type, images, description, name, status, location, alive, contact, date, created_by, created_at)
    VALUES
      (${type}, ${db.json(images)}, ${description}, ${name}, ${status},
       ${location}, ${alive}, ${contact}, ${date}, ${created_by}, ${created_at})
    RETURNING *
  `;
  return pet;
}

export async function updateAtHome(id, atHome) {
  const result = await db`
    UPDATE pets SET athome = ${atHome} WHERE id = ${id}
  `;
  return result.count > 0;
}

export async function remove(id) {
  const result = await db`DELETE FROM pets WHERE id = ${id}`;
  return result.count > 0;
}
