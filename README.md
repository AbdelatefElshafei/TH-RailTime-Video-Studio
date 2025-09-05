
# TH Realtime Video Studio

![Untitled](https://github.com/user-attachments/assets/63ab07aa-017b-4786-8998-07a222826f4a)

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/pulls)
[![GitHub stars](https://img.shields.io/github/stars/AbdelatefElshafei/TH-RailTime-Video-Studio)](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/AbdelatefElshafei/TH-RailTime-Video-Studio)](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/network)

A powerful, open-source, browser-based video editor designed for performance and extensibility.

</div>

---

**TH Realtime Video Studio** brings a near-real-time, non-linear video editing experience to your web browser. It combines a modern, intuitive frontend interface with a robust Node.js backend that harnesses the full power of **FFmpeg** for all media processing.

The project is architected with two core principles in mind: **performance** and **extensibility**. It features a seamless proxy workflow for buttery-smooth editing of high-resolution footage and a simple-yet-powerful Plugin API that allows the community to create and share new effects and features with ease.
---

### ✨ Key Features

*   **💻 Browser-Based NLE:** A familiar multi-track, non-linear editing interface that runs anywhere.
*   ⚡ **Real-time Previews:** Scrub the timeline and see frame-accurate previews instantly, powered by a WebSocket connection to the FFmpeg backend.
*   **🚀 High-Performance Proxy Workflow:** Automatically generates low-resolution proxies for smooth 4K+ editing, while intelligently using original high-resolution files for the final export.
*   **🔌 Extensible Plugin API:** Add custom video and audio effects by simply adding a JavaScript file. The studio dynamically loads them on startup.
*   **🎨 Advanced Color Correction:**
    *   Professional **Color Wheels** (Lift, Gamma, Gain).
    *   Support for applying custom **`.cube` LUTs**.
    *   Fine-grained **RGB Curves** control.
    *   Standard Brightness, Contrast, and Saturation sliders.
*   **🎬 Keyframe Animations:** Animate properties like position, scale, and opacity over time with a simple keyframe editor.
*   **✂️ Essential Tools:** Includes Chroma Key (green screen), advanced polygon masking, clip splitting, ripple delete, and more.
*   **📤 Background Rendering:** Export your final video without locking up the user interface, with real-time progress updates.

### 🖼️ Screenshot


![WhatsApp Image 2025-09-05 at 9 05 19 PM](https://github.com/user-attachments/assets/fb7e959c-27c7-4115-a8e0-3b7162793e2a)

---

### 🛠️ Tech Stack

*   **Backend:** **Node.js**, **Express.js**
*   **Video Processing:** **FFmpeg** (the core engine)
*   **Real-time Communication:** **WebSocket** (via `ws` library)
*   **Frontend:** **Vanilla JavaScript (ES6+)**, **TailwindCSS**, **Fabric.js** (for masking)
*   **Core Dependencies:** `multer` for file uploads, `fluent-ffmpeg` for a developer-friendly FFmpeg API.

---

### 🚀 Getting Started

Follow these instructions to get a local instance of the studio running on your machine.

#### Prerequisites

1.  **Node.js:** You must have Node.js (v14 or newer) and npm installed.
    *   [Download Node.js](https://nodejs.org/)

2.  **FFmpeg:** This is the core of the video processing engine. **It must be installed on your system and accessible in your system's PATH.**
    *   **Windows:** Download from the [official website](https://ffmpeg.org/download.html) and add the `bin` directory to your PATH environment variable.
    *   **macOS (using Homebrew):** `brew install ffmpeg`
    *   **Linux (Debian/Ubuntu):** `sudo apt update && sudo apt install ffmpeg`

#### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio.git
    cd TH-RailTime-Video-Studio
    ```

2.  **Install backend dependencies:**
    ```bash
    npm install
    ```

3.  **Run the server:**
    ```bash
    node server.js
    ```

4.  **Open the application:**
    Open your web browser and navigate to `http://localhost:3000`. You should see the video editor interface.

---

### 📂 Project Structure

```
/
├── plugins/              # ★ Extensible plugins are loaded from here
│   └── vignette.js       # An example custom effect plugin
├── processed/            # Final rendered videos are stored here
├── proxies/              # Low-resolution proxy files are automatically generated here
├── public/               # All frontend files (HTML, CSS, JS)
│   ├── client.js
│   ├── index.html
│   └── Logo.png
├── uploads/              # Original uploaded media files
├── node_modules/
├── package.json
├── README.md             # You are here!
└── server.js             # The Node.js/Express backend logic
```

---

### ⚙️ Core Concepts

#### 1. The JSON-Powered Render Pipeline

The entire editing process is non-destructive. The frontend maintains a single `project` object in JSON format that describes the timeline, all clip placements, effects, keyframes, and global settings.

When a preview or final render is requested:
1.  The frontend sends this `project` object to the backend.
2.  The `server.js` backend parses this object.
3.  It dynamically constructs a single, complex FFmpeg command with a `filter_complex` graph that perfectly represents the entire timeline—all layers, effects, and animations.
4.  FFmpeg executes this command to generate the final output video.

#### 2. The Proxy Workflow

To solve the performance bottleneck of editing high-resolution files in a browser, a proxy system is seamlessly integrated:
1.  When a video is uploaded, the server starts a background FFmpeg job to create a low-resolution (540p) version of the video in the `/proxies` directory.
2.  The frontend's **"Use Proxies"** toggle allows the user to switch between high-res and low-res files for editing.
3.  When enabled, all previews and timeline scrubbing use the lightweight proxy files, ensuring a smooth and responsive experience.
4.  When the final **Export** button is clicked, the backend **always** uses the original, full-quality source files to ensure the best possible output quality.

---

### ⭐ Extensibility: The Plugin API

The heart of this project's potential is its Plugin API. You can easily create and share new video and audio effects by adding a simple JavaScript file to the `/plugins` directory—no need to modify the core application code.

#### How to Create a Plugin

1.  Create a new `.js` file in the `/plugins` directory (e.g., `my-cool-effect.js`).
2.  In this file, use `module.exports` to export a JavaScript object with a specific structure. The server will automatically discover and load it on the next startup.

**Example: A "Vignette" Plugin (`/plugins/vignette.js`)**

```javascript
module.exports = {
  // --- Required Properties ---
  name: 'Vignette',         // User-friendly name displayed in the UI's Effects Bin.
  type: 'vignette',        // Unique internal identifier for this effect.
  effectType: 'video',     // Can be 'video' or 'audio'.

  // --- Optional: Define parameters to auto-generate UI controls ---
  params: [
    {
      name: 'Strength',      // Label for the UI control.
      key: 'strength',     // Key used to access this value in the params object.
      type: 'slider',      // Type of UI control ('slider' or 'number').
      min: 0,              // Minimum value for the slider.
      max: 1,              // Maximum value for the slider.
      step: 0.05,          // Step value for the slider.
      defaultValue: 0.5    // Initial value when the effect is applied.
    },
  ],

  // --- Required: Function to generate the FFmpeg filter string ---
  // This function receives the 'params' object with the current values from the UI.
  buildFilter: (params) => {
    // Read the 'strength' value, using the default if it's not set.
    const strength = params.strength ?? 0.5;

    // Map the 0-1 strength value to a reasonable FFmpeg angle for the vignette.
    const angle = Math.PI / 2.5 * (1 - strength);

    // Return the final FFmpeg filter string for the filter_complex graph.
    return `vignette=angle=${angle}`;
  }
};
```
That's it! After restarting the server, "Vignette" will appear in the Effects Bin, and dragging it onto a clip will automatically create a "Strength" slider in the properties panel.

---

### 🤝 How to Contribute

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  **Fork the Project**
2.  **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3.  **Commit your Changes** (`git commit -m 'feat: Add some AmazingFeature'`)
4.  **Push to the Branch** (`git push origin feature/AmazingFeature`)
5.  **Open a Pull Request**

**Ways you can contribute:**
*   **Create new plugins!** This is the easiest and most impactful way to add value.
*   Report bugs and suggest features by [opening an issue](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/issues).
*   Improve the UI/UX of the frontend.
*   Add new core features to the backend rendering engine.
*   Write documentation.


---

### 📄 License

This project is distributed under the MIT License. See the `LICENSE` file for more information.
