import express from 'express';
import cors from 'cors';
import { ACCEPTED_ORIGINS } from './config/cors.js';
import petsRoutes from './pets/pets.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

if (process.env.ENVIRONMENT === 'development') {
  app.use(cors({ origin: '*' }));
} else {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || ACCEPTED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
    })
  );
}

app.use(express.json());

app.use('/api/pets', petsRoutes);

app.use(errorHandler);

export default app;
