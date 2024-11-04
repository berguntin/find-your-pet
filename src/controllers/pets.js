import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { uploadImages } from '../services/cloudinary.js'

export const getAllPets = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pets');
    
    const pets = rows.map(pet => ({
      ...pet,
      images: pet.images ? JSON.parse(pet.images) : [] 
    }));

    res.json(pets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPetById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    res.json(rows[0]);
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
  
    const insert_id = uuidv4();
    
    const created_at = new Date()
    const created_by = 'admin' // TODO create users?
   
    const cloudinaryResponse = await uploadImages(req.files)

    const uploadedImageJSON = JSON.stringify(cloudinaryResponse)
    
    const query = `
      INSERT INTO pets (
        id, type, images, description, name, status, 
        location, alive, contact, date, 
        created_by, created_at
      ) VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;


    await pool.query(query, [
      insert_id, type, uploadedImageJSON, description, name, status,
      location, Boolean(alive), contact, date,
      created_by, created_at
    ]);

    res.status(201).json({ insert_id, ...req.body, created_at });

  } catch (error) {

    res.status(500).json({ message: error.message });

  }
};

export const updatePet = async (req, res) => {
  try {
    const {
      type, images, description, name, status,
      location, alive, contact, date, atHome
    } = req.body;

    let uploadedImages = await processImages(images)

    uploadedImages = uploadedImages.map(image => image.secure_url)

    const query = `
      UPDATE pets 
      SET type = ?, image = ?, description = ?, name = ?, 
          status = ?, location = ?, alive = ?, contact = ?, 
          date = ?, atHome = ?
      WHERE id = ?
    `;

    const [result] = await pool.query(query, [
      type, uploadedImages, description, name, status,
      location, alive, contact, date, atHome,
      req.params.id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    res.json({ message: 'Pet updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePet = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM pets WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    res.json({ message: 'Pet deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

