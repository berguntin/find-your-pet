import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import petsRoutes from './routes/pets.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = {
  origin: '*'
}
const corsConfig = process.env.ENVIRONMENT === 'development' ? corsOptions : {}

app.use(cors(corsConfig));
app.use(express.json());

app.use('/api/pets', petsRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});