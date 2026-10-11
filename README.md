# Afterglow — Retro Photobooth

A responsive, retro-film inspired digital photobooth built with React and Vite.

## Features
- Live camera preview with permission handling and front/back camera switching where supported
- Optional GIF booth mode that captures a short retro loop with the selected film filter, previews it, and downloads it as an animated GIF
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
Camera access is requested only after the user clicks the camera button. Photos and GIF frames are processed locally in the browser and are not uploaded to a server. GIFs and photos remain in browser memory until you download them or close/refresh the page.