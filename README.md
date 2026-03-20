<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1sVlZV6_YCz06Nk1KwKlMeM8OnPd82yQn

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## View on your phone (public tunnel)

Your dev server runs on **port 3000** (see `vite.config.ts`).

1. Start the app: `npm run dev`
2. In a **second** terminal, start a tunnel: `npm run tunnel`
3. Copy the `https://…` URL it prints and open it on your phone (any network).

**Note:** The URL changes each time unless you use a paid/stable tunnel service.

### More reliable option: Cloudflare Quick Tunnel

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (Cloudflare’s CLI).
2. With `npm run dev` running, execute:

   `cloudflared tunnel --url http://localhost:3000`

3. Use the `https://*.trycloudflare.com` URL on your phone.

**Security:** A public tunnel exposes your **local dev server** to the internet. Only use while developing, and stop the tunnel when you’re done.
