import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { db } from './firebase.js';

const app = express();

const port = Number(process.env.PORT) || 8080;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

app.use(express.json({ limit: '2mb' }));

app.get('/', (_request, response) => {
  response.json({
    service: 'Roadshow Device Request API',
    environment: process.env.NODE_ENV || 'development',
    status: 'running'
  });
});

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/health/firestore', async (_request, response) => {
  try {
    await db.listCollections();

    response.status(200).json({
      status: 'healthy',
      firestore: 'connected'
    });
  } catch (error) {
    console.error('Firestore health check failed:', error);

    response.status(500).json({
      status: 'unhealthy',
      firestore: 'disconnected'
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`RDR API listening on port ${port}`);
});