# Afterglow — Retro Photobooth

A responsive, retro-film inspired digital photobooth built with React and Vite.

## Features
- Live camera preview with permission handling and front/back camera switching where supported
- 3-second countdown and capture flow
- Two-, three-, and four-photo strips
- Original, vintage, black-and-white, golden-hour, and blue-hour filter effects
- Film, Polaroid, kraft-paper, and no-frame options
- Editable caption
- Download the completed strip as PNG or JPEG
- Responsive desktop and mobile layouts
- Photos are processed locally in the browser; no photo upload backend

## Requirements
- Node.js 18+ recommended
- A browser with camera support
- Camera access requires HTTPS or localhost

## Run locally
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
npm run preview
```

## Deploy
Import this repository into Vercel or Netlify. Build command: `npm run build`; output directory: `dist`.

## Privacy
Camera access is requested only after the user clicks the camera button. Captured images stay in browser memory for the current session and are not uploaded to a server.