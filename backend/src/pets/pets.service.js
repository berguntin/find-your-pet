import { uploadImages } from '../services/cloudinary.js';
import * as petsRepository from './pets.repository.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getAllPets() {
  return petsRepository.findAll();
}

export async function getPetById(id) {
  const pet = await petsRepository.findById(id);
  if (!pet) throw new AppError('Pet not found', 404);
  return pet;
}

export async function createPet(fields, files) {
  const { type, description, name, status, location, alive, contact, date } = fields;

  const images = files?.length ? await uploadImages(files) : [];

  return petsRepository.insert({
    type,
    images,
    description,
    name,
    status,
    location,
    alive: alive !== undefined ? alive : true,
    contact,
    date,
    created_by: 'web',
    created_at: new Date(),
  });
}

export async function updatePetAtHome(id, atHome) {
  const updated = await petsRepository.updateAtHome(id, atHome);
  if (!updated) throw new AppError('Pet not found', 404);
}

export async function deletePet(id) {
  const deleted = await petsRepository.remove(id);
  if (!deleted) throw new AppError('Pet not found', 404);
}
