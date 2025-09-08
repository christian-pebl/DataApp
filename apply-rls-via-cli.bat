@echo off
echo 🔧 Applying RLS Policy Fix via Supabase CLI...
echo.

REM Check if Supabase CLI is installed
supabase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Supabase CLI is not installed or not in PATH
    echo 📥 Please install it: npm install -g supabase
    echo 🔗 Or visit: https://supabase.com/docs/guides/cli
    pause
    exit /b 1
)

echo ✅ Supabase CLI found
echo.

REM Apply the SQL file
echo ⚡ Executing RLS policy fix...
supabase db reset --db-url "postgresql://postgres:[YOUR_DB_PASSWORD]@db.tujjhrliibqgstbrohfn.supabase.co:5432/postgres" --file fix-rls-policies.sql

if errorlevel 1 (
    echo.
    echo ❌ Failed to apply via CLI. Please try manual approach:
    echo.
    echo 📋 Manual Steps:
    echo 1. Open Supabase Dashboard: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn
    echo 2. Go to SQL Editor
    echo 3. Copy and paste the contents of fix-rls-policies.sql
    echo 4. Click Run
    echo.
    pause
    exit /b 1
)

echo.
echo 🎉 RLS policies applied successfully!
echo 🔄 Please refresh your application and test pin operations
echo.
pause