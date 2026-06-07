import 'dotenv/config';
import { validateEnv } from './config/env.js';
import app from './app.js';

validateEnv();

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
