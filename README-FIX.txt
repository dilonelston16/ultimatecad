ULTIMATECAD VERCEL BUILD FIX

Copy the included src folder into the root of your project:
C:\Projects\ultimatecad

Allow Windows to merge the folders.

Then run:

cd C:\Projects\ultimatecad
pnpm add @supabase/supabase-js @supabase/ssr
pnpm build

If the build succeeds:

git add .
git commit -m "fix: restore app shell and Supabase clients"
git push origin main

Required Vercel environment variables:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
