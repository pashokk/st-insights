# Creative Intelligence

Competitor creative analysis tool — pulls top-performing creatives from SensorTower and analyzes them with Claude. Built for the Appodeal Accelerator creative producer workflow.

## How it works

1. User enters SensorTower API key + competitor app IDs in the UI
2. Next.js API route (`/api/creative-intel`) fetches creatives from SensorTower server-side (no CORS)
3. Claude analyzes the creative metadata and writes per-creative tactical insights
4. Results render as cards with status badges, metrics, and Claude insights

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 3. Run dev server
npm run dev
# → open http://localhost:3000/creative-intel
```

## File structure

```
app/
  api/creative-intel/route.ts   ← server-side proxy (SensorTower + Claude)
  creative-intel/page.tsx       ← main UI page
  layout.tsx
  globals.css
components/
  CreativeCard.tsx              ← individual creative result card
types/
  index.ts                      ← shared TypeScript types
```

## Adding to existing Next.js project

If dropping into `mgp-ai-challenge` rather than running standalone:

1. Copy `app/api/creative-intel/route.ts` into your existing `app/api/` directory
2. Copy `app/creative-intel/page.tsx` into your `app/` directory  
3. Copy `components/CreativeCard.tsx` and `types/index.ts`
4. Copy the CSS from `globals.css` into your existing global stylesheet (or keep separate)
5. Make sure `ANTHROPIC_API_KEY` is in your `.env.local`

## SensorTower endpoint

The route calls:
```
GET /v1/{platform}/creative_intelligence/top_creatives
```

If your SensorTower plan uses a different endpoint path, update `stUrl` in `app/api/creative-intel/route.ts`.

## Optional: hardcode ST key server-side

If you don't want users to enter the ST key in the UI, add it to `.env.local`:
```
SENSORTOWER_API_KEY=your-key
```
Then in `route.ts`, replace `stKey` with `process.env.SENSORTOWER_API_KEY`.
