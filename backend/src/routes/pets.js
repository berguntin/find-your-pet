import express from 'express';
import multer from 'multer';

const storage = multer.memoryStorage(); // O usar diskStorage() para guardar en disco
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024,
    files: 10
   }
 });

import {
  getAllPets,
  getPetById,
  createPet,
  updatePet,
  deletePet
} from '../controllers/pets.js';

const router = express.Router();

router.get('/', getAllPets);
router.get('/:id', getPetById);
router.post('/',upload.array('images', 10), createPet);
router.put('/:id', updatePet);
router.delete('/:id', deletePet);

export default router;