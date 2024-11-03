import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export const getAllPets = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pets');
    res.json(rows);
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
      image,
      description,
      name,
      status,
      location,
      alive,
      contact,
      date,
      atHome,
      createdBy
    } = req.body;

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const query = `
      INSERT INTO pets (
        id, type, image, description, name, status, 
        location, alive, contact, date, atHome, 
        createdBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(query, [
      id, type, image, description, name, status,
      location, alive, contact, date, atHome,
      createdBy, createdAt
    ]);

    res.status(201).json({ id, ...req.body, createdAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePet = async (req, res) => {
  try {
    const {
      type, image, description, name, status,
      location, alive, contact, date, atHome
    } = req.body;

    const query = `
      UPDATE pets 
      SET type = ?, image = ?, description = ?, name = ?, 
          status = ?, location = ?, alive = ?, contact = ?, 
          date = ?, atHome = ?
      WHERE id = ?
    `;

    const [result] = await pool.query(query, [
      type, image, description, name, status,
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