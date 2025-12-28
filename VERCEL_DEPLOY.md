# 🚀 Deployment Guide

Follow these steps to deploy Fibbage AI to the web.

## 1. Deploy PartyKit Server (Backend)

The game logic runs on PartyKit. You need to deploy this first to get your backend URL.

1.  **Login to PartyKit** (if you haven't):
    ```bash
    npx partykit login
    ```

2.  **Add your Anthropic API Key** (for Claude AI):
    ```bash
    npx partykit env add ANTHROPIC_API_KEY
    # Paste your key when prompted
    ```

3.  **Deploy the server**:
    ```bash
    npm run party:deploy
    ```

4.  **Copy the Deployed Host**:
    The command will output a URL like: `https://fibbage-server.your-username.partykit.dev`
    *Copy this URL - you will need it for the Vercel step.*

---

## 2. Deploy Next.js App (Frontend) on Vercel

1.  **Push your code to GitHub** (This is already done!).

2.  **Go to dashboard.vercel.com** and click **"Add New..."** -> **"Project"**.

3.  **Import** the `Fibbage` repository.

4.  **Configure Environment Variables**:
    In the "Environment Variables" section, add:

    | Name | Value |
    |------|-------|
    | `NEXT_PUBLIC_PARTYKIT_HOST` | Paste the PartyKit URL from Step 1 (without `https://`) |
    | `ANTHROPIC_API_KEY` | Your Claude API Key (Optional for frontend, but good practice) |

    *Note: `NEXT_PUBLIC_PARTYKIT_HOST` generally should NOT include `https://`, just the domain (e.g., `fibbage-server.user.partykit.dev`). If the app fails to connect, try adding `https://` or check the browser console.*

5.  **Click Deploy!**

---

## 3. Verify Deployment

1.  Open your Vercel URL (e.g., `https://fibbage.vercel.app`).
2.  Click "Host a Game".
3.  On your phone, go to the same URL and "Join Game" with the code.
4.  Enjoy deceiving your friends!
