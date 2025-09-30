# ProTech - Dashboard for UCD Football

A React + Vite frontend for athlete performance tracking.

## Prerequisites
- Node.js 18+
- npm 8+

## Install & Run (Frontend)
1. Navigate to the frontend app:
   
   ```bash
   cd Frontend/ProTech
   ```

2. Install dependencies:
   
   ```bash
   npm install
   ```

3. Create a `.env` file in `Frontend/ProTech` with your Supabase credentials:
   
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   
   - Do not include a trailing `/` on the URL.
   - Use the anon key (not the service role key) for frontend.

4. Start the dev server:
   
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`.

## Build & Preview
- Build for production:
  
  ```bash
  npm run build
  ```

- Preview the production build locally:
  
  ```bash
  npm run preview
  ```

## Supabase Setup Notes
- Storage bucket name for images: `athlete-images`.
- Uploaded images are stored at paths like `/<athleteId>/<year>.jpg`.
- Ensure the bucket has public read access or generate signed URLs for private buckets.

## Troubleshooting
- TypeError: Load failed
  - Remove any trailing `/` from `VITE_SUPABASE_URL`.
  - Ensure `.env` exists in `Frontend/ProTech` and you restarted `npm run dev` after changes.
  - Reinstall deps: `rm -rf node_modules package-lock.json && npm install`.

## Project Structure (partial)
- `Frontend/ProTech/` – React + Vite app
  - `src/utils/supabase.js` – Supabase client
  - `src/components/` – UI components
  - `src/pages/` – Routes and pages
- `Data/` – Data scripts and CSVs

