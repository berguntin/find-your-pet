import db from '../config/database.js';
import { uploadImages } from '../services/cloudinary.js';

export const getAllPets = async (req, res) => {

  try {
    const pets = await db`SELECT * FROM pets;`;
    
    res.json(pets);
  } catch (error) {
    
    res.status(500).json({ message: error.message });
  }
};

export const getPetById = async (req, res) => {
  try {
    const [pet] = await db`
      SELECT * FROM pets
      WHERE id = ${req.params.id}
    `;

    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    res.json(pet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createPet = async (req, res) => {
  try {
    const {
      type,
      description,
      name,
      status,
      location,
      alive,
      contact,
      date
    } = req.body;

    const created_at = new Date();
    const created_by = 'web'; // TODO: Add user context
    const cloudinaryResponse = await uploadImages(req.files);
    const uploadedImageJSON = JSON.stringify(cloudinaryResponse);

    await db`
      INSERT INTO pets (
        type, to_jsonb(images), description, name, status,
        location, alive, contact, date, created_by, created_at
      )
      VALUES (
        ${type}, ${uploadedImageJSON}, ${description}, ${name}, ${status},
        ${location}, ${alive}, ${contact}, ${date}, ${created_by}, ${created_at}
      )
    `;

    res.status(201).json({ success: true, message: 'Pet created successfully', id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePet = async (req, res) => {
  try {
    const { athome } = req.body;

    const result = await db`
      UPDATE pets
      SET athome = ${athome}
      WHERE id = ${req.params.id}
    `;

    if (result.count === 0) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    res.json({ success: true, message: 'Pet updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePet = async (req, res) => {
  try {
    const result = await db`
      DELETE FROM pets
      WHERE id = ${req.params.id}
    `;

    if (result.count === 0) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    res.json({ message: 'Pet deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
