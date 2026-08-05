Copy tsconfig.json into C:\Projects\ultimatecad and replace the existing file.
Then run:
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
pnpm build
