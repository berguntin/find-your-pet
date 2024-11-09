import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import petsRoutes from './routes/pets.js';
import { ACCEPTED_ORIGINS } from './config/cors.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: (origin, callback) => {
        
    if (!origin || ACCEPTED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(null, false);
  }
}));

app.use(express.json());

app.use('/api/pets', petsRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

