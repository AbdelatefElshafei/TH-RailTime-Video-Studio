# Real-Time Web Video Editor

![Untitled](https://github.com/user-attachments/assets/63ab07aa-017b-4786-8998-07a222826f4a)

A full-stack, browser-based video editor that provides a near-desktop editing experience with a multi-track timeline, interactive preview, and server-side rendering powered by Node.js and FFmpeg.

This project is built from the ground up to be a robust, feature-rich application. It features a sophisticated hybrid preview system that uses WebSockets for frame-accurate still previews during editing and dynamically generated video segments for fluid, real-time playback. The backend is a powerful render engine capable of processing complex timelines with multiple layers of video, audio, and text effects.

---

## ✨ Features

*   **Multi-Track Timeline**: Add and manage multiple video and audio tracks for complex compositions.
*   **Real-Time Hybrid Preview**:
    *   **Video Playback Mode**: Plays a server-rendered, low-quality MP4 of the timeline for fluid playback.
    *   **Editing/Scrubbing Mode**: Uses WebSockets to deliver frame-accurate, high-quality still image previews for precise editing.
*   **Interactive Preview Window**:
    *   **Drag-and-Drop Positioning**: Visually move video and text clips (for Picture-in-Picture and titles).
    *   **Live Resizing**: Drag the corners of a selected clip in the preview to adjust its scale.
*   **Full Timeline Control**:
    *   Drag and drop media from the bin to the timeline.
    *   Reposition clips by dragging them.
    *   Resize clips by dragging their edges to trim or extend them.
    *   Delete clips and add/remove tracks.
*   **Dynamic Properties Panel**: A context-aware panel that allows you to edit the properties of any selected clip:
    *   **Video**: Opacity, Scale, Filters (Grayscale, Sepia, Invert).
    *   **Audio**: Volume.
    *   **Text**: Content, Font Size, Color, Position.
*   **Server-Side Rendering**: All heavy lifting is done by a powerful Node.js and FFmpeg backend, keeping the client UI fast and responsive.
*   **Safe File Handling**: All user-uploaded files are renamed to unique, safe IDs to prevent errors with special characters in filenames.

---

## 🏛️ Architecture

The application is built on a modern full-stack architecture, separating the client-side user interface from the server-side processing engine.



### Frontend

The frontend is a single-page application built with vanilla JavaScript, HTML, and Tailwind CSS. It is responsible for:
1.  **Rendering the UI**: Drawing the media bin, properties panel, and timeline.
2.  **State Management**: Maintaining a `project` JSON object that represents the entire state of the user's edit.
3.  **User Interaction**: Handling all drag-and-drop, resizing, and property editing.
4.  **Preview Engine**: Managing the hybrid preview system by communicating with the backend via **Fetch** (for video segments) and **WebSockets** (for still frames).

### Backend

The backend is a Node.js server built with the Express.js framework. It acts as a powerful, headless render engine.
1.  **API Server**: Exposes endpoints for file uploading, final rendering, and preview generation.
2.  **FFmpeg Wrapper**: Uses the `fluent-ffmpeg` library to programmatically construct and execute complex `filter_complex` FFmpeg commands.
3.  **Job Queue**: Manages long-running render jobs asynchronously, allowing the client to poll for status updates.
4.  **WebSocket Server**: Provides a low-latency communication channel for the real-time still preview engine.

---

## 🚀 Getting Started

Follow these instructions to get the project running on your local machine.

### Prerequisites

*   **Node.js**: v14.x or later. [Download Node.js](https://nodejs.org/)
*   **FFmpeg**: This is a critical dependency and must be installed and accessible from your system's command line.
    *   **macOS (via Homebrew):**
        ```bash
        brew install ffmpeg
        ```
    *   **Ubuntu/Debian:**
        ```bash
        sudo apt update && sudo apt install ffmpeg
        ```
    *   **Windows:**
        1.  Download a static build from the [FFmpeg Official Site](https://ffmpeg.org/download.html).
        2.  Unzip the file.
        3.  Add the `bin` directory within the unzipped folder to your system's PATH environment variable.

### Installation & Running the App

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/real-time-web-video-editor.git
    cd real-time-web-video-editor
    ```

2.  **Install backend dependencies:**
    The backend uses Express, Multer, Fluent-FFmpeg, and more.
    ```bash
    npm install
    ```

3.  **Start the server:**
    This command will launch the Node.js server, which also serves the frontend files.
    ```bash
    node server.js
    ```

4.  **Open the editor:**
    Navigate to the following URL in your web browser:
    [http://localhost:3000](http://localhost:3000)

    You should now see the video editor interface, and the backend console will log "Backend server with preview support running on http://localhost:3000".

---

