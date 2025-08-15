# Quick Database Setup Guide

## ⚡ Fastest Method - Supabase Dashboard

### 1. Get Your Supabase Credentials
1. Go to [supabase.com](https://supabase.com) and sign in
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** (starts with `https://`)
   - **anon/public key** 
   - **service_role key** (click to reveal)

### 2. Update Environment Variables
Edit `.env.local` and replace the placeholder values:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
```

### 3. Apply Database Schema
1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/001_create_map_data_tables.sql`
4. Paste into the SQL editor
5. Click **Run** (green play button)

### 4. Verify Setup
You should see these tables created:
- ✅ projects
- ✅ tags  
- ✅ pins
- ✅ lines
- ✅ areas
- ✅ pin_tags
- ✅ line_tags
- ✅ area_tags

### 5. Test the App
```bash
npm run dev
```
Navigate to `http://localhost:9002/map-drawing` and test the integration!

---

## 🛠️ Alternative: Using Node Script

If you prefer automation:
```bash
node setup-database.js
```

---

## 🚨 Common Issues

**"Invalid JWT" errors:** Check your service role key is correct
**"Table does not exist":** Re-run the SQL migration
**"Permission denied":** Ensure RLS policies were created

---

## ✅ Success Indicators

- Map loads without errors
- You can create pins/lines/areas when logged in
- Data persists after page refresh
- Supabase dashboard shows data in tables