import { Router } from 'express';
import upload from '../middleware/upload.js';
import { validateCaptcha } from '../middleware/validateCaptcha.js';
import * as petsController from './pets.controller.js';

const router = Router();

router.get('/', petsController.getAllPets);
router.get('/:id', petsController.getPetById);
router.post('/search/similar', upload.single('image'), petsController.searchSimilar);
router.post('/', upload.array('images', 10), validateCaptcha, petsController.createPet);
router.put('/:id', petsController.updatePet);
router.delete('/:id', petsController.deletePet);

export default router;
