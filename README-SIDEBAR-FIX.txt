ULTIMATECAD SIDEBAR VISIBILITY FIX

1. Extract this ZIP into:
   C:\Projects\ultimatecad

2. Replace:
   src\components\app-shell.tsx

3. Open:
   src\app\globals.css

4. Copy everything from:
   src\app\globals.css.append.txt

   and paste it at the very bottom of globals.css.

5. Delete:
   src\app\globals.css.append.txt

6. Run:
   rmdir /s /q .next
   pnpm build

7. Push:
   git add .
   git commit -m "fix: restore visible application sidebar"
   git push origin main
