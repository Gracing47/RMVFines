import express from 'express';
import { registerRoutes } from '../server/routes';

const app = express();
app.use(express.json());

// Register routes
// We need to await this if registerRoutes does async setup, but for Vercel serverless
// we usually just need the routes registered on the app instance.
// Since registerRoutes is async returning a server, we just call it.
// However, we need to make sure we don't start a server (listen) inside registerRoutes if it does that.
// Our current registerRoutes just adds routes and returns createServer(app).
registerRoutes(app);

export default app;
