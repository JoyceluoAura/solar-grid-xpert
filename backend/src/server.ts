import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3001;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Import routes
import overviewRouter from './routes/overview';
import insightsRouter from './routes/insights';
import historyRouter from './routes/history';

// Mount routes
app.use('/api/ai', overviewRouter);
app.use('/api/ai', insightsRouter);
app.use('/api/ai', historyRouter);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend API server running on port ${PORT}`);
  console.log(`AI Service URL: ${AI_SERVICE_URL}`);
});

export default app;
