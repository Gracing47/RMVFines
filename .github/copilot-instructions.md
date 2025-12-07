# RMV Voice - AI Coding Agent Instructions

## Project Overview
Voice-first public transport assistant for Rhine-Main area using German speech recognition and the public HAFAS API (`v6.db.transport.rest`). The app has **dual deployment modes**: Express server for local dev, Vercel serverless functions for production.

## Critical Architecture Patterns

### Dual Server Architecture
- **Development**: Express server in `server/routes.ts` (run via `npm run dev`)
- **Production**: Identical logic in `api/serverless.ts` for Vercel serverless
- **Key Rule**: When modifying API endpoints, update BOTH files identically
- Routes: `/api/locations/search`, `/api/locations/nearby`, `/api/trips`

### Voice Intent Parsing (German)
See `client/src/lib/voice.ts` - `parseIntent()` function extracts:
- `from`: "von X", "hier" (triggers GPS), or implicit current location
- `to`: "nach Y", "zu Z" (required)
- `time`: "in 20 Minuten", "um 14 Uhr", "jetzt" - supports relative and absolute times

Examples that must work:
```
"Nach Frankfurt" → GPS origin, destination: Frankfurt
"Von Wiesbaden nach Mainz um 14 Uhr" → explicit origin/destination + time
"Hier nach Darmstadt in 10 Minuten" → GPS + relative time
```

### Fuzzy Location Matching
`client/src/lib/fuzzy-search.ts` handles German-specific normalization:
- `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss` for voice recognition errors
- Levenshtein distance with prefix boost (common prefix = better match)
- Used in `searchLocation()` to retry with fuzzy matching if exact search fails

### Permission Handling Pattern
Both mic and GPS permissions need **friendly recovery flows**:
- Set `permissionDeniedType: "microphone" | "geolocation"` state
- Show modal with browser-specific instructions (Chrome, Firefox, Safari differ)
- Use `navigator.mediaDevices.getUserMedia()` to trigger mic prompt explicitly
- See `voice-interface.tsx` lines 150-200 for implementation pattern

## API Integration Details

### HAFAS API Response Mapping
The API uses different field names than our frontend - key mappings in `server/routes.ts`:
- `leg.departurePlatform` OR `leg.platform` → `Origin.track`
- `leg.arrivalPlatform` OR `leg.platform` → `Destination.track`
- `leg.line?.name` OR "Fußweg" → `Leg.name`
- Always include `&stopovers=true` to get intermediate stops

### Accessibility Features (Incomplete)
- `isWheelchair` state exists but NOT fully implemented
- Original plan: use `avoidPaths=SW,ES` and `changeTimePercent=200` params (see `API_USAGE.md`)
- Current: commented out in routes, needs proper HAFAS param implementation

## Development Workflow

### Running Locally
```bash
npm run dev          # Express server + Vite (port 5000)
npm run dev:client   # Vite only (if backend separate)
npm run check        # Type checking (always run before committing)
```

### Building & Deploying
```bash
npm run build        # Vite build → dist/public (for Vercel)
vercel --prod        # Auto-deploys, uses vercel.json routing
```

### Testing Voice Features
1. Must use HTTPS or localhost (browser security)
2. Chrome DevTools → Application → Permissions to reset mic/GPS
3. Test with real German voice inputs, not just text

## UI Component Patterns

### Radix UI Composition
- All UI components in `client/src/components/ui/` are Radix primitives
- Use `cn()` utility for conditional Tailwind classes (from `lib/utils.ts`)
- Never import Radix directly - use wrapper components (e.g., `Button`, `Dialog`)

### Voice Interface State Machine
`voice-interface.tsx` status: `idle → listening → processing → success/error`
- `idle`: Show mic button
- `listening`: Show pulsing animation + live transcript
- `processing`: Show spinner + status message
- `success`: Display trip cards, keep voice available
- `error`: Show error alert, allow retry

### Connection Cards
`connection-card.tsx` displays journey legs:
- Walking segments show distance (meters)
- Transit segments show line name, direction, platform
- Transfer times calculated between legs (see `transferDuration` logic)
- Expandable stopovers via Radix Accordion

## TypeScript Conventions

### Path Aliases
```typescript
"@/*"       → client/src/*
"@shared/*" → shared/* (types shared between client/server)
```

### Type Safety for Web APIs
Voice types manually declared in `lib/voice.ts` (Web Speech API not in @types/node)
- Must extend `Window` interface for `SpeechRecognition`/`webkitSpeechRecognition`

## Common Pitfalls

1. **Forgot to update serverless.ts**: Always sync `server/routes.ts` ↔ `api/serverless.ts`
2. **Voice parsing breaks on edge cases**: Add tests in `parseIntent()` for new German phrases
3. **Fuzzy search too aggressive**: Check `calculateSimilarity()` threshold (currently 0.6)
4. **Platform/track fields missing**: API returns either `platform`, `departurePlatform`, or `arrivalPlatform` - try all three
5. **CORS issues**: Community API (`v6.db.transport.rest`) allows CORS, but double-check for new endpoints

## Key Files Reference
- `server/routes.ts` + `api/serverless.ts`: API endpoints (keep in sync!)
- `client/src/lib/voice.ts`: Intent parsing and speech synthesis
- `client/src/lib/fuzzy-search.ts`: German location matching logic
- `client/src/hooks/use-voice-recognition.ts`: Voice recognition state management
- `API_USAGE.md`: Original German docs on HAFAS accessibility features
