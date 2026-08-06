ULTIMATECAD BANKING ACTIVATION FIX

The original Milestone 1.9 ZIP included the Banking pages, API routes and SQL,
but it did not replace app-shell.tsx. Banking therefore remained marked "Soon".

1. Extract this ZIP into:
   C:\Projects\ultimatecad

2. Replace:
   src\components\app-shell.tsx

3. Confirm these files from Milestone 1.9 already exist:
   src\app\banking\page.tsx
   src\app\banking\banking-client.tsx
   src\app\banking\banking.module.css
   src\app\api\banking\accounts\route.ts
   src\app\api\banking\transfer\route.ts

4. In Supabase SQL Editor, optionally run:
   supabase/checks/202608060001_verify_banking.sql

   Every result should show a table or function name, not null.

5. Build:
   cd C:\Projects\ultimatecad
   rmdir /s /q .next
   pnpm build

6. Push:
   git add .
   git commit -m "fix: activate banking navigation"
   git push origin main

After Vercel deploys, open:
   /banking
