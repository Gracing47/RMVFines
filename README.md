# RMV Voice

RMV Voice is a voice-controlled journey planner for the Rhein-Main-Verkehrsverbund (RMV). It allows users to search for connections using natural language commands.

## Features

*   **Voice Control:** Speak your destination (e.g., "Nach Wiesbaden") or a route ("Von Mainz nach Frankfurt").
*   **Smart Location:** Automatically detects your current location if no start point is specified.
*   **Visual Feedback:** An animated "Voice Orb" visualizes listening and speaking states.
*   **Accessibility:** Optimized for accessibility with specific routing profiles (e.g., wheelchair friendly).
*   **Real-time Data:** Uses the RMV HAFAS API for real-time connection data.

## Tech Stack

*   **Frontend:** React, Vite, Tailwind CSS, Radix UI, Lucide Icons
*   **Backend:** Express (Node.js)
*   **Voice:** Web Speech API (Recognition & Synthesis)

## Setup & Development

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    This starts the backend on port 5000 and the frontend via Vite.

3.  **Build for Production:**
    ```bash
    npm run build
    ```

## Vercel Deployment

This project is configured for deployment on Vercel.

1.  **Install Vercel CLI:**
    ```bash
    npm i -g vercel
    ```

2.  **Deploy:**
    ```bash
    vercel
    ```

### Configuration
The project uses `vercel.json` to route API requests to a serverless function in `api/index.ts`, while serving the static frontend assets from the build output.
