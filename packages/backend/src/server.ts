import dotenv from 'dotenv';
import { createServer } from './app';

dotenv.config();

const port = Number(process.env.PORT) || 4000;

const app = createServer();

app.listen(port, () => {
  console.log(`SimpleStock API running on http://localhost:${port}`);
});
