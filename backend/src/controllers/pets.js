import supabase from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { uploadImages } from '../services/cloudinary.js';

export const getAllPets = async (req, res) => {
  try {
    const { data, error } = await supabase.from('pets').select('*').order('created_at', {ascending: false});
    
    if (error) throw error;

    const pets = data.map(pet => ({
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
    const { data, error } = await supabase.from('pets').select('*').eq('id', req.params.id).single();
    
    if (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: 'Pet not found' });
      }
      throw error;
    }

    res.json(data);
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
    const created_by = 'web'; //TODO add users?

    const cloudinaryResponse = await uploadImages(req.files);
    const uploadedImageJSON = JSON.stringify(cloudinaryResponse);

    const { error } = await supabase.from('pets').insert([{
      type,
      images: uploadedImageJSON,
      description,
      name,
      status,
      location,
      alive,
      contact,
      date,
      created_by, 
      created_at
    }]);

    if (error) throw error;

    res.status(201).json({ success: true, message: 'Pet created successfully' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const updatePet = async (req, res) => {
  try {
    const { athome } = req.body;

    const { error } = await supabase
      .from('pets')
      .update({ athome })
      .eq('id', req.params.id);

    if (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Pet not found' });
      }
      throw error;
    }

    res.json({ success: true, message: 'Pet updated successfully' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePet = async (req, res) => {
  try {
    const { error } = await supabase.from('pets').delete().eq('id', req.params.id);
    
    if (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Pet not found' });
      }
      throw error;
    }

    res.json({ message: 'Pet deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
