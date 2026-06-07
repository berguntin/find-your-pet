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
    embedding,
  } = data;

  const embeddingValue = embedding ? `[${embedding.join(',')}]` : null;

  const [pet] = await db`
    INSERT INTO pets
      (type, images, description, name, status, location, alive, contact, date, created_by, created_at, embedding)
    VALUES
      (${type}, ${db.json(images)}, ${description}, ${name}, ${status},
       ${location}, ${alive}, ${contact}, ${date}, ${created_by}, ${created_at},
       ${embeddingValue}::vector)
    RETURNING id, type, images, description, name, status, location, alive, contact, date, athome, created_by, created_at
  `;
  return pet;
}

export async function findSimilar(embedding, { excludeId = null, limit = 5, threshold = 0.6 } = {}) {
  const embeddingStr = `[${embedding.join(',')}]`;

  const pets = await db`
    SELECT
      id, type, images, description, name, status, location, contact, date, athome, created_at,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM pets
    WHERE
      embedding IS NOT NULL
      AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${threshold}
      ${excludeId ? db`AND id != ${excludeId}` : db``}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `;

  return pets.map((pet) => ({ ...pet, images: pet.images ?? [] }));
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
