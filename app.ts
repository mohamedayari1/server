import express from 'express';
import { geminiEndpoint } from './gemeniEndpoint';

const app = express();

// Middleware
app.use(express.json());

// Routes
app.post('/api/gemini', geminiEndpoint);

export default app;