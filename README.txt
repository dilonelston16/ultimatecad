ULTIMATECAD DMV REDIRECT FIX

WHY IT HAPPENED
The DMV page called has_permission() using:
  p_community_id
  p_permission_key

The actual database function expects:
  target_community_id
  requested_permission

Supabase RPC argument names must match exactly, so the check returned no access
and redirected the user to /dashboard.

INSTALL

1. Extract this ZIP into:
   C:\Projects\ultimatecad

2. Replace:
   src\app\dmv\page.tsx

3. Run this SQL once in Supabase SQL Editor:
   supabase/hotfixes/202608050005_fix_dmv_access.sql

4. Build:
   cd C:\Projects\ultimatecad
   rmdir /s /q .next
   pnpm build

5. Push:
   git add .
   git commit -m "fix: restore DMV administration access"
   git push origin main
