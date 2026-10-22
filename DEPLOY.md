# Put Pitch Perfect on the internet (free, ~15 minutes)

You need two free accounts: **GitHub** (stores the files) and **Render** (runs the server).
No coding. Just clicking.

## Part 1: Put the game on GitHub

1. Go to **github.com** and sign up (or sign in).
2. Top-right, click the **+** button, then **New repository**.
3. Repository name: `pitch-perfect`. Leave it **Public**. Click **Create repository**.
4. On the new page, click the link **uploading an existing file**.
5. Open the `soccer-spacing-game` folder on your Mac. Select **everything inside it**
   (`index.html`, `package.json`, the `js`, `css`, `server`, `tests` folders, and so on).
   Do **not** include the `node_modules` folder if you have one.
6. Drag them all onto the GitHub upload page. Wait for the green check marks.
7. Scroll down and click **Commit changes**.

> Folders drag fine in Chrome and Safari. If a folder refuses, open it and drag its files, then use
> "Add file → Create new file" and type `js/filename.js` as the name to recreate the folder structure.

## Part 2: Run it on Render

1. Go to **render.com** and click **Get Started**. Sign up with your GitHub account (easiest).
2. In the Render dashboard click **New +** (top right) and choose **Web Service**.
3. Pick **Build and deploy from a Git repository**, click **Next**.
4. Find `pitch-perfect` in the list and click **Connect**. (If it is not listed, click
   **Configure account** and give Render access to that repository.)
5. Fill in the form:
   - **Name:** `pitch-perfect` (this becomes part of your web address)
   - **Region:** pick the one nearest you
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
6. Click **Create Web Service**. Watch the log scroll. After 1–2 minutes it says
   `⚽ Pitch Perfect running`.
7. At the top of the page is your address, something like
   `https://pitch-perfect-abcd.onrender.com`. Click it. That is the game.

## Part 3: Play with friends

1. Open your address on any laptop or iPad.
2. Tap **Online Match → Create a room**.
3. Share the 4-letter code or tap **Copy link** and text it to friends.
4. Everyone picks a team and a position. The host taps **Start match**.

## Good to know

- **Free tier naps.** If nobody has used it for 15 minutes, the first visitor waits about
  a minute while it wakes up. Open the address a minute before the kids do.
- **Updates.** Change a file on GitHub (click the file → pencil icon → Commit). Render
  redeploys itself in about a minute.
- **Change the match length.** In Render: your service → **Environment** → add
  `MATCH_SECONDS` = `300` (seconds) → Save. It redeploys.
- **One-click alternative.** The folder includes `render.yaml`. On Render choose
  **New + → Blueprint**, pick the repository, and it fills in everything above for you.
- **Other hosts.** Railway and Fly.io work the same way (Node app, build `npm install`,
  start `npm start`). The `Dockerfile` works anywhere Docker runs.

If a screen looks a little different from these steps, the names are usually the same.
Look for "Web Service", "Node", "npm install", "npm start", and "Free".
