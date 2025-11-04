# 🍝 It's 2025, Stop Guessing Pasta Portions

[Pasta Visual Estimator – try it now](https://pasta-visual-estimator.vercel.app/)

Camera-powered pasta estimating built in a single sprint so you can stop eyeballing dry spaghetti and start nailing servings.

![Pasta Visual Estimator screenshot](./docs/pasta-visual-estimator.png "Replace with a real screenshot")

## 🧩 Why This Exists

College cooking math is chaotic: you keep tossing extra strands into the pot until a “solo dinner” becomes a two-person feast. The estimator anchors the process with a familiar reference (one strand of spaghetti), lets you calibrate your bowl visually, and translates bundle thickness into raw grams and cooked volume in seconds.

## ✨ Key Features

- Rear-camera calibration with a draggable 10" spaghetti reference line.
- Bowl sizing via slider or presets, rendered as live canvas overlays.
- Real-time pasta bundle measurement, updating weight estimates as you drag.
- Cooked-volume visualisation that shows bowl fill percentage and overflow warnings.
- Works entirely in the browser—no frameworks, no install—just vanilla JS, Canvas, and the MediaDevices API.

## 🛠️ Tech Stack

- `index.html` + `styles.css` for layout and responsive UI.
- `app.js` for state management, camera control, and all canvas rendering logic.
- Optional `server.py` (HTTPS wrapper around `SimpleHTTPRequestHandler`) for mobile testing—camera access needs HTTPS on most devices.

## 🚀 Run It Locally

1. Clone the repo and `cd` into it.
2. Start the HTTPS dev server:
   ```bash
   python3 server.py
   ```
   _Tip: replace `cert.pem`/`key.pem` with your own self-signed pair if the bundled ones don’t work on your machine._
3. Visit the printed `https://` URL on your laptop or phone, accept the self-signed cert warning, and follow the 4 in-app steps to calibrate.

## 📌 Reflection & Next Steps

- Early versions asked users to type measurements manually; anchoring the experience to the spaghetti reference removed that friction.
- AR Quick Look looked tempting, but keeping Android parity won—Web APIs were the pragmatic choice.
- Bundle diameter calibration still feels clunky; future experiments could explore AI edge detection or dual-reference markers.

## 👋 Let’s Connect

- [LinkedIn](https://www.linkedin.com/in/sinclair-lim/)
- [Project on GitHub](https://github.com/sinclairlim/pasta-visual-estimator)
