/**
 * Express.js Backend CORS Configuration for Codespaces
 * 
 * This setup allows your Express backend to accept requests from both:
 * - Local development: http://localhost:5173
 * - GitHub Codespaces: https://<codespace-name>-5173.app.github.dev
 */

import cors from 'cors';
import express from 'express';

const app = express();

/**
 * Determine if running in GitHub Codespaces
 */
const isCodespaces = (): boolean => {
  return !!(process.env.CODESPACE_NAME);
};

/**
 * Get allowed origins based on environment
 */
const getAllowedOrigins = (): string[] => {
  const codespaceName = process.env.CODESPACE_NAME;
  const frontendPort = process.env.VITE_FRONTEND_PORT || '5173';

  if (isCodespaces() && codespaceName) {
    return [
      // Allow Codespaces URL
      `https://${codespaceName}-${frontendPort}.app.github.dev`,
      // Also allow localhost for local testing inside container
      `http://localhost:${frontendPort}`,
    ];
  }

  // Local development - allow localhost
  return [
    `http://localhost:${frontendPort}`,
    'http://127.0.0.1:3000', // Alternative local address
  ];
};

/**
 * CORS Configuration
 */
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (like mobile apps or server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },

  credentials: true, // Allow cookies and authentication headers
  optionsSuccessStatus: 200, // For legacy browsers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Number', 'X-Page-Size'],
  maxAge: 3600, // Cache CORS preflight responses for 1 hour
};

/**
 * Apply CORS middleware
 */
app.use(cors(corsOptions));

/**
 * Handle preflight requests explicitly (important for some browsers)
 */
app.options('*', cors(corsOptions));

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

/**
 * Logging middleware - useful for debugging Codespaces issues
 */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Origin:', req.get('origin'));
  console.log('Host:', req.get('host'));
  next();
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: isCodespaces() ? 'codespaces' : 'local',
    codespace: process.env.CODESPACE_NAME || 'N/A',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Example API route
 */
app.post('/api/data', (req, res) => {
  try {
    // Your endpoint logic here
    res.json({
      message: 'Data received successfully',
      data: req.body,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * Error handling middleware
 */
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  }
);

/**
 * Start server
 */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 CORS enabled for origins:`, getAllowedOrigins());
  console.log(`🌍 Environment: ${isCodespaces() ? 'GitHub Codespaces' : 'Local'}`);
  if (isCodespaces()) {
    console.log(`📦 Codespace: ${process.env.CODESPACE_NAME}`);
  }
  console.log('');
});

export { app, getAllowedOrigins, isCodespaces };
