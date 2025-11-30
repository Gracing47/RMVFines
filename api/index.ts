import { app } from "../server/app";
import { registerRoutes } from "../server/routes";

// Initialize routes
// We ignore the returned server instance as we only need the side-effect of route registration on 'app'
registerRoutes(app);

export default async function handler(req: any, res: any) {
    // Vercel serverless function entry point
    // Pass the request to the Express app
    return app(req, res);
}
