import * as petsService from './pets.service.js';

export async function getAllPets(req, res, next) {
  try {
    const pets = await petsService.getAllPets();
    res.json(pets);
  } catch (err) {
    next(err);
  }
}

export async function getPetById(req, res, next) {
  try {
    const pet = await petsService.getPetById(req.params.id);
    res.json(pet);
  } catch (err) {
    next(err);
  }
}

export async function createPet(req, res, next) {
  try {
    const pet = await petsService.createPet(req.body, req.files);
    res.status(201).json({ success: true, pet });
  } catch (err) {
    next(err);
  }
}

export async function updatePet(req, res, next) {
  try {
    await petsService.updatePetAtHome(req.params.id, req.body.athome);
    res.json({ success: true, message: 'Pet updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deletePet(req, res, next) {
  try {
    await petsService.deletePet(req.params.id);
    res.json({ success: true, message: 'Pet deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function searchSimilar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }
    const pets = await petsService.searchSimilarPets(req.file.buffer);
    res.json(pets);
  } catch (err) {
    next(err);
  }
}
