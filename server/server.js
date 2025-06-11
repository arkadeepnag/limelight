import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import cluster from 'cluster';
import os from 'os';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import searchRoutes from './routes/search.js';
import userRoutes from './routes/userRoutes.js';
import { startTrendingJob } from './services/trendingService.js';


const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
console.log("MONGO_URI loaded:", process.env.MONGO_URI);
// Middleware
app.use(cors());


const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit per IP
});
app.use(limiter);

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=86400');
  }
}));

// in server.js

app.use(compression());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/utilities', searchRoutes);
app.use('/api/user', userRoutes);
const PORT = process.env.PORT;
// Connect to MongoDB

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined. Check your .env file.');
  process.exit(1);
}


mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    mongoose.set('debug', false);
    console.log('MongoDB connected');
    // server.js (replace app.listen part)

    const numCPUs = os.cpus().length;

    if (cluster.isMaster) {
      for (let i = 0; i < numCPUs / 2; i++) cluster.fork();
      cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
      });
    } else {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} (Worker ${process.pid})`);
      });
    }
    startTrendingJob();






  })
  .catch(err => console.error(err));
cluster.on('exit', (worker, code, signal) => {
  console.error(`Worker ${worker.process.pid} crashed (code: ${code}, signal: ${signal})`);
  cluster.fork(); // restart the worker
});

