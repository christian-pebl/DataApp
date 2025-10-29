# 🌅 START HERE TOMORROW

**Date:** October 30, 2025
**Task:** Complete Project Sharing Feature
**Time Estimate:** 5-6 hours

---

## ⚡ QUICK START (Do This First!)

### **Step 1: Apply Database Migration** (5 minutes)

```bash
# Copy migration SQL to clipboard
cat supabase/migrations/20251029_project_sharing.sql | clip
```

Then:
1. Go to: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql/new
2. Paste (Ctrl+V) and click **RUN**
3. Wait for success message
4. Mark as applied:
```bash
npx supabase migration repair --status applied 20251029
```

### **Step 2: Start Dev Server** (if not running)

```bash
npm run dev
# Opens at http://localhost:9002
```

---

## ✅ TODAY'S CHECKLIST

### **Morning (2-3 hours)**
- [ ] Apply database migration ⬆️ (above)
- [ ] Create `src/lib/supabase/project-sharing-service.ts`
  - [ ] `shareProject()` function
  - [ ] `inviteToProject()` function
  - [ ] `getProjectShares()` function
  - [ ] `removeProjectShare()` function
- [ ] Update `src/lib/supabase/project-service.ts`
  - [ ] Modify `getProjects()` to include shared projects
  - [ ] Add `checkProjectPermission()` method

### **Afternoon (2-3 hours)**
- [ ] Update Project Settings dialog in `src/app/map-drawing/page.tsx`
  - [ ] Add "Manage Sharing" button
  - [ ] Add permission badges
- [ ] Create `src/components/project/ProjectSharingDialog.tsx`
  - [ ] Email input field
  - [ ] Permission dropdown
  - [ ] Send invitation button
  - [ ] List current users with access
  - [ ] Remove access functionality
- [ ] Add permission checks before edit/delete operations

### **Testing (1 hour)**
- [ ] Login as christian@pebl-cic.co.uk
- [ ] Share "Blakeney Overfalls" project with peblapp9@gmail.com
- [ ] Logout and login as peblapp9@gmail.com
- [ ] Verify shared project appears
- [ ] Test View permission (can see, can't edit)
- [ ] Test Edit permission (can edit pins/lines/areas)
- [ ] Test Admin permission (can share with others)

---

## 📖 FULL DOCUMENTATION

**See:** `PROJECT_SHARING_IMPLEMENTATION.md` for:
- Complete technical details
- Code templates to copy
- Database schema
- Testing plan
- Troubleshooting

---

## 🎯 SUCCESS = All These Work:

1. ✅ Migration applied (no errors in Supabase)
2. ✅ Share button visible in Project Settings
3. ✅ Can invite peblapp9@gmail.com via email
4. ✅ Shared project appears for second user
5. ✅ Permission levels work (View vs Edit vs Admin)
6. ✅ Only owner can delete project
7. ✅ No console errors

---

## 🆘 IF YOU GET STUCK

### **Migration errors?**
- Check `PROJECT_SHARING_IMPLEMENTATION.md` → "Technical Details"
- Verify tables exist: `SELECT * FROM project_shares;`

### **Can't see shared projects?**
- Check RLS policies are applied
- Verify `has_project_access()` function exists
- Test function: `SELECT has_project_access('project_id', 'user_id');`

### **Permission errors?**
- Check `get_project_permission()` function
- Verify user_id in project_shares table
- Check browser console for detailed errors

### **UI not updating?**
- Hard refresh: Ctrl+Shift+R
- Check dev server is running
- Verify no TypeScript errors

---

## 📱 TEST ACCOUNTS

- **Owner:** christian@pebl-cic.co.uk / password
- **Test User:** peblapp9@gmail.com / password

---

## 🚀 AFTER COMPLETION

1. Commit changes:
```bash
git add .
git commit -m "Add project sharing feature with multi-user collaboration"
git push origin master
```

2. Test on production (Vercel will auto-deploy)

3. Document in CLAUDE.md as completed

---

**You've got this! The hard part (database design) is done.** 💪

**Now just connect the UI to the backend!** 🎨
