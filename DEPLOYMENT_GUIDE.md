# Step-by-Step Guide: Deploying ProTech to Vercel

This guide will walk you through deploying your ProTech React application to Vercel.

## Prerequisites

- A GitHub account (or GitLab/Bitbucket)
- Your code pushed to a Git repository
- A Vercel account (free tier is fine)
- Your Supabase credentials (URL and Anon Key)

---

## Step 1: Prepare Your Repository

1. **Ensure your code is committed and pushed to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Verify your project structure:**
   - Make sure your `package.json` has a `build` script (✅ you have this)
   - Ensure your build output directory is `dist` (default for Vite)

---

## Step 2: Create a Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** or **"Log In"**
3. Sign up using your GitHub account (recommended for easier integration)

---

## Step 3: Import Your Project

1. **From Vercel Dashboard:**
   - Click **"Add New..."** → **"Project"**
   - You'll see a list of your GitHub repositories
   - Find and select your **ProTech** repository
   - Click **"Import"**

2. **Configure Project Settings:**
   - **Framework Preset:** Vercel should auto-detect "Vite"
   - **Root Directory:** Set to `Frontend/ProTech` (since your frontend is in a subdirectory)
   - **Build Command:** `npm run build` (should be auto-filled)
   - **Output Directory:** `dist` (should be auto-filled)
   - **Install Command:** `npm install` (should be auto-filled)

---

## Step 4: Configure Environment Variables

**This is crucial for your Supabase connection!**

1. In the Vercel project settings, scroll down to **"Environment Variables"**

2. **Add the following variables:**
   - **Name:** `VITE_SUPABASE_URL`
     - **Value:** Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
     - **Environments:** Select all (Production, Preview, Development)
   
   - **Name:** `VITE_SUPABASE_ANON_KEY`
     - **Value:** Your Supabase anonymous/public key
     - **Environments:** Select all (Production, Preview, Development)

3. **Where to find your Supabase credentials:**
   - Go to your Supabase project dashboard
   - Navigate to **Settings** → **API**
   - Copy the **Project URL** → This is your `VITE_SUPABASE_URL`
   - Copy the **anon/public key** → This is your `VITE_SUPABASE_ANON_KEY`

4. Click **"Save"** after adding each variable

---

## Step 5: Deploy

1. After configuring everything, click **"Deploy"**
2. Vercel will:
   - Install dependencies
   - Run the build command
   - Deploy your application
3. Wait for the deployment to complete (usually 1-3 minutes)

---

## Step 6: Verify Deployment

1. Once deployment completes, you'll see a success message with a URL like:
   - `https://protech-xxxxx.vercel.app`
2. Click the URL to visit your deployed site
3. Test your application:
   - Check if the homepage loads
   - Test authentication (if applicable)
   - Verify Supabase connection is working

---

## Step 7: Configure Custom Domain (Optional)

1. In your Vercel project dashboard, go to **Settings** → **Domains**
2. Enter your custom domain (e.g., `protech.com`)
3. Follow Vercel's instructions to configure DNS records
4. Wait for DNS propagation (can take up to 48 hours, usually much faster)

---

## Troubleshooting

### Build Fails

**Issue:** Build command fails
- **Solution:** Check the build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility (Vercel uses Node 18.x by default)

### Environment Variables Not Working

**Issue:** Supabase connection fails
- **Solution:** 
  - Double-check environment variable names (must start with `VITE_`)
  - Ensure variables are added to all environments (Production, Preview, Development)
  - Redeploy after adding environment variables

### Routing Issues (404 on refresh)

**Issue:** Getting 404 errors when refreshing pages
- **Solution:** The `vercel.json` file has been created to handle SPA routing. If issues persist:
  - Check that `vercel.json` is in the `Frontend/ProTech` directory
  - Ensure the `_redirects` file in `public/` is also present

### Root Directory Issues

**Issue:** Vercel can't find your project
- **Solution:** Make sure **Root Directory** is set to `Frontend/ProTech` in project settings

---

## Automatic Deployments

Vercel automatically deploys:
- **Production:** Every push to `main` branch
- **Preview:** Every push to other branches or pull requests

You can disable auto-deployments in **Settings** → **Git** if needed.

---

## Updating Your Deployment

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update features"
   git push origin main
   ```
3. Vercel will automatically detect the push and redeploy

---

## Useful Vercel Features

- **Analytics:** View visitor statistics (available on paid plans)
- **Logs:** Check server logs in the deployment dashboard
- **Preview Deployments:** Test changes before merging to main
- **Environment Variables:** Different values for production/preview/development

---

## Security Notes

- ✅ Never commit `.env` files with secrets to Git
- ✅ Use Vercel's environment variables for sensitive data
- ✅ Your Supabase anon key is safe to expose (it's designed for client-side use)
- ✅ Consider using Supabase Row Level Security (RLS) for data protection

---

## Need Help?

- Vercel Documentation: https://vercel.com/docs
- Vercel Support: Available in dashboard
- Check deployment logs for specific error messages

---

**Congratulations!** Your ProTech application should now be live on Vercel! 🚀

