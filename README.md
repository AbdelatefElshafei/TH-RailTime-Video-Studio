# TH Realtime Video Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/pulls)
[![GitHub stars](https://img.shields.io/github/stars/AbdelatefElshafei/TH-RailTime-Video-Studio)](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/AbdelatefElshafei/TH-RailTime-Video-Studio)](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/network)
[![GitHub issues](https://img.shields.io/github/issues/AbdelatefElshafei/TH-RailTime-Video-Studio)](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/AbdelatefElshafei/TH-RailTime-Video-Studio)](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/commits)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![FFmpeg Required](https://img.shields.io/badge/FFmpeg-Required-red)](https://ffmpeg.org/)

A high-performance, browser-based non-linear video editor built with modern web technologies and powered by FFmpeg. Features real-time previews, proxy workflow, extensible plugin architecture, and professional-grade video processing capabilities.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Key Features](#key-features)
- [Technical Stack](#technical-stack)
- [Installation & Setup](#installation--setup)
- [Project Structure](#project-structure)
- [Core Systems](#core-systems)
- [Plugin Development](#plugin-development)
- [API Documentation](#api-documentation)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Performance Optimizations](#performance-optimizations)
- [Contributing](#contributing)
- [License](#license)

## Architecture Overview

TH Realtime Video Studio follows a modular, client-server architecture designed for scalability and maintainability:

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Frontend      │◄──────────────►│   Backend       │
│   (Browser)     │    HTTP/REST    │   (Node.js)     │
└─────────────────┘                 └─────────────────┘
         │                                   │
         │                                   │
    ┌─────────┐                        ┌─────────┐
    │  UI/UX  │                        │ FFmpeg  │
    │ Engine  │                        │ Engine  │
    └─────────┘                        └─────────┘
```

### Core Components

- **Frontend**: Vanilla JavaScript SPA with real-time WebSocket communication
- **Backend**: Node.js/Express server with modular architecture
- **Video Engine**: FFmpeg with fluent-ffmpeg wrapper for complex filter chains
- **Plugin System**: Extensible JavaScript-based effect framework
- **Proxy System**: Intelligent media optimization for smooth editing

## Key Features

### Video Editing Capabilities

- **Multi-track Timeline**: Support for unlimited video and audio tracks
- **Real-time Preview**: WebSocket-powered frame-accurate scrubbing
- **Proxy Workflow**: Automatic low-res proxy generation for 4K+ editing
- **Non-destructive Editing**: JSON-based project files with full undo/redo
- **Background Rendering**: Non-blocking export with progress tracking

### Professional Tools

- **Color Correction**: Color wheels, LUT support, RGB curves, HSL adjustments
- **Keyframe Animation**: Smooth property transitions with easing curves
- **Chroma Key**: Advanced green screen compositing
- **Masking**: Polygon-based masking with real-time preview
- **Audio Processing**: Volume, panning, normalization, and effects

### Extensibility

- **Plugin API**: Create custom effects without touching core code
- **Community Plugins**: Pre-built effects library
- **Hot Reloading**: Dynamic plugin loading without server restart
- **Parameter Validation**: Type-safe parameter handling

## Technical Stack

### Backend Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | Node.js 14+ | JavaScript server environment |
| **Framework** | Express.js 5.x | Web application framework |
| **Video Processing** | FFmpeg | Core video/audio processing engine |
| **FFmpeg Wrapper** | fluent-ffmpeg 2.x | Developer-friendly FFmpeg API |
| **Real-time Communication** | WebSocket (ws) | Live preview updates |
| **File Upload** | Multer 2.x | Multipart file handling |
| **Environment** | dotenv | Configuration management |

### Frontend Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Language** | Vanilla JavaScript (ES6+) | No framework dependencies |
| **Styling** | TailwindCSS | Utility-first CSS framework |
| **Canvas** | Fabric.js | Advanced masking and drawing |
| **Communication** | WebSocket API | Real-time server communication |
| **Build Tools** | None | Zero-configuration setup |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Jest** | Unit and integration testing |
| **ESLint** | Code quality and style enforcement |
| **Prettier** | Code formatting |
| **GitHub Actions** | Continuous integration/deployment |

## Installation & Setup

### Prerequisites

1. **Node.js** (v14.0.0 or higher)
   ```bash
   # Check version
   node --version
   ```

2. **FFmpeg** (Required for video processing)
   ```bash
   # Windows (using Chocolatey)
   choco install ffmpeg
   
   # macOS (using Homebrew)
   brew install ffmpeg
   
   # Linux (Ubuntu/Debian)
   sudo apt update && sudo apt install ffmpeg
   
   # Verify installation
   ffmpeg -version
   ```

### Quick Start

    ```bash
# Clone repository
    git clone https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio.git
    cd TH-RailTime-Video-Studio
    npm install
    npm run setup

    npm start

     Open browser to http://localhost:3000
```

### Environment Configuration

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000

# Media Paths
MEDIA_PATH=./uploads
PROXY_PATH=./proxies
PROCESSED_PATH=./processed
PREVIEWS_PATH=./previews
THUMBNAILS_PATH=./thumbnails
WAVEFORMS_PATH=./waveforms
LUTS_PATH=./luts
PLUGINS_PATH=./plugins

# FFmpeg Configuration (optional)
# FFMPEG_PATH=C:\\ffmpeg\\bin\\ffmpeg.exe
# FFPROBE_PATH=C:\\ffmpeg\\bin\\ffprobe.exe

# Upload Settings
MAX_UPLOAD_SIZE=50mb

# WebSocket Settings
ENABLE_WEBSOCKET_PREVIEW=true

# Cleanup Settings (milliseconds)
PREVIEW_CLEANUP_AGE=900000
THUMBNAIL_CLEANUP_AGE=300000
```

## Project Structure

```
TH-RailTime-Video-Studio/
├── 📁 server/                     # Backend modules
│   ├── 📁 routes/                 # API route handlers
│   │   ├── upload.js             # File upload endpoints
│   │   ├── render.js             # Video rendering & previews
│   │   └── plugins.js            # Plugin management API
│   ├── 📁 services/              # Core business logic
│   │   ├── ffmpegService.js      # FFmpeg filter generation
│   │   └── proxyService.js       # Proxy file management
│   ├── 📁 utils/                 # Utility functions
│   │   └── fileHelpers.js        # File system operations
│   └── server.js                 # Main server entry point
├── 📁 public/                    # Frontend application
│   ├── index.html               # Main HTML template
│   ├── client.js                # Frontend JavaScript
│   └── Logo.png                 # Application logo
├── 📁 plugins/                   # Built-in plugins
│   ├── blur.js                  # Blur effects
│   ├── brightness.js            # Brightness adjustment
│   ├── contrast.js              # Contrast adjustment
│   ├── saturation.js            # Saturation adjustment
│   ├── sepia.js                 # Sepia tone filter
│   └── vignette.js              # Vignette effect
├── 📁 community-plugins/         # Community plugin library
│   ├── README.md                # Plugin documentation
│   ├── 📁 blur/                 # Blur plugin package
│   ├── 📁 sepia/                # Sepia plugin package
│   ├── 📁 fadein/               # Fade-in transition
│   ├── 📁 audionormalize/       # Audio normalization
│   └── 📁 lutloader/            # LUT loading system
├── 📁 tests/                     # Test suite
│   ├── setup.js                 # Jest configuration
│   ├── plugins.test.js          # Plugin system tests
│   ├── ffmpeg.test.js           # FFmpeg service tests
│   └── proxy.test.js            # Proxy workflow tests
├── 📁 docs/                      # Documentation
│   ├── PLUGIN_API.md            # Plugin development guide
│   └── TESTING.md               # Testing documentation
├── 📁 .github/workflows/         # CI/CD pipelines
│   └── ci.yml                   # GitHub Actions workflow
├── 📁 uploads/                   # User uploaded media
├── 📁 proxies/                   # Generated proxy files
├── 📁 processed/                 # Final rendered videos
├── 📁 previews/                  # Real-time preview files
├── 📁 thumbnails/                # Timeline thumbnails
├── 📁 waveforms/                 # Audio waveform data
├── 📁 luts/                      # Look-Up Table files
├── package.json                  # Dependencies & scripts
├── jest.config.js               # Jest configuration
├── .eslintrc.js                 # ESLint configuration
├── .prettierrc                  # Prettier configuration
└── README.md                    # This file
```

## Core Systems

### 1. Video Processing Pipeline

The video processing system converts JSON project data into FFmpeg filter chains:

```javascript
// Project data structure
const project = {
  settings: { width: 1920, height: 1080, fps: 30 },
  tracks: [
    {
      type: 'video',
      clips: [
        {
          src: 'video.mp4',
          start: 0,
          duration: 10,
          timelineStart: 5,
          effects: [
            { type: 'blur', params: { strength: 2 } }
          ]
        }
      ]
    }
  ]
};

// Generated FFmpeg command
ffmpeg -i video.mp4 -filter_complex \
  "[0:v]trim=0:10,setpts=PTS-STARTPTS,gblur=sigma=2[outv]" \
  -map "[outv]" -c:v libx264 output.mp4
```

### 2. Proxy Workflow System

Intelligent media optimization for smooth editing:

```javascript
// Proxy generation process
const proxyService = {
  generateProxy: async (originalPath, filename) => {
    return ffmpeg(originalPath)
      .size('?x540')                    // Scale to 540p height
      .outputOptions([
        '-preset', 'ultrafast',         // Fast encoding
        '-crf', '35',                   // Lower quality for speed
        '-c:v', 'libx264',              // H.264 codec
        '-c:a', 'aac',                  // Audio codec
        '-b:a', '128k',                 // Lower audio bitrate
        '-movflags', 'faststart'        // Web optimization
      ])
      .save(proxyPath);
  }
};
```

### 3. Real-time Preview System

WebSocket-powered live preview updates:

```javascript
// WebSocket communication
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  if (type === 'preview_ready') {
    updatePreviewPlayer(data.previewUrl);
  }
};

// Request preview generation
ws.send(JSON.stringify({
  type: 'generate_preview',
  project: currentProject,
  timestamp: currentTime,
  duration: 30
}));
```

### 4. Plugin System Architecture

Extensible effect framework with type safety:

```javascript
// Plugin structure
module.exports = {
  name: 'Custom Effect',
  type: 'custom_effect',
  effectType: 'video',
  
  params: [
    {
      name: 'Strength',
      key: 'strength',
      type: 'slider',
      min: 0,
      max: 10,
      step: 0.1,
      defaultValue: 1.0
    }
  ],
  
  buildFilter: (params) => {
    return `custom_filter=strength=${params.strength}`;
  }
};
```

## Plugin Development

### Creating a New Plugin

1. **Create plugin file** in `plugins/` directory:
```javascript
// plugins/my-effect.js
module.exports = {
  name: 'My Effect',
  type: 'my_effect',
  effectType: 'video',
  
  params: [
    {
      name: 'Intensity',
      key: 'intensity',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.5
    }
  ],
  
  buildFilter: (params) => {
    return `eq=brightness=${params.intensity}`;
  }
};
```

2. **Restart server** to load the plugin
3. **Plugin appears** in the effects panel automatically

### Supported Parameter Types

| Type | Description | Example |
|------|-------------|---------|
| `slider` | Numeric range with min/max | `{ min: 0, max: 100, step: 1 }` |
| `number` | Direct numeric input | `{ defaultValue: 50 }` |
| `select` | Dropdown selection | `{ options: [{value: 'a', label: 'A'}] }` |
| `text` | String input | `{ defaultValue: 'Hello' }` |
| `color` | Color picker | `{ defaultValue: '#FF0000' }` |
| `boolean` | Checkbox | `{ defaultValue: true }` |

### Advanced Plugin Features

```javascript
module.exports = {
  name: 'Advanced Effect',
  type: 'advanced_effect',
  effectType: 'video',
  
  // Complex parameter with conditional visibility
  params: [
    {
      name: 'Effect Type',
      key: 'type',
      type: 'select',
      options: [
        { value: 'blur', label: 'Blur' },
        { value: 'sharpen', label: 'Sharpen' }
      ],
      defaultValue: 'blur'
    },
    {
      name: 'Blur Strength',
      key: 'blurStrength',
      type: 'slider',
      min: 0,
      max: 10,
      defaultValue: 1,
      condition: 'type === "blur"'  // Only show when blur is selected
    }
  ],
  
  buildFilter: (params) => {
    if (params.type === 'blur') {
      return `gblur=sigma=${params.blurStrength}`;
    } else {
      return `unsharp=luma_amount=${params.sharpenStrength}`;
    }
  }
};
```

## API Documentation

### REST Endpoints

#### File Upload
```http
POST /api/upload
Content-Type: multipart/form-data

Response:
{
  "success": true,
  "filename": "video_123.mp4",
  "originalName": "my_video.mp4",
  "hasProxy": true,
  "fileSize": 1048576,
  "mimetype": "video/mp4"
}
```

#### Video Rendering
```http
POST /api/render
Content-Type: application/json

{
  "project": { /* project data */ },
  "settings": {
    "width": 1920,
    "height": 1080,
    "fps": 30
  }
}

Response:
{
  "success": true,
  "jobId": "render_123",
  "status": "processing",
  "progress": 0
}
```

#### Plugin Management
```http
GET /api/plugins
Response: [
  {
    "name": "Blur",
    "type": "blur",
    "effectType": "video",
    "params": [...],
    "version": "1.0.0"
  }
]

GET /api/plugins/:type
POST /api/plugins/reload
GET /api/plugins/stats
```

### WebSocket Events

#### Client to Server
```javascript
// Generate preview
{
  "type": "generate_preview",
  "project": { /* project data */ },
  "timestamp": 5.5,
  "duration": 30
}

// Request render status
{
  "type": "get_render_status",
  "jobId": "render_123"
}
```

#### Server to Client
```javascript
// Preview ready
{
  "type": "preview_ready",
  "previewUrl": "/previews/preview_123.mp4",
  "timestamp": 5.5
}

// Render progress
{
  "type": "render_progress",
  "jobId": "render_123",
  "progress": 45,
  "message": "Processing video..."
}

// Render complete
{
  "type": "render_complete",
  "jobId": "render_123",
  "downloadUrl": "/processed/final_123.mp4"
}
```

## Testing & Quality Assurance

### Test Suite

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:plugins    # Plugin system tests
npm run test:ffmpeg     # FFmpeg service tests
npm run test:coverage   # Coverage report

# Watch mode for development
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Test Coverage

Current coverage targets:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

### Continuous Integration

GitHub Actions workflow includes:
- Multi-Node.js version testing (16.x, 18.x, 20.x)
- Code quality checks (ESLint, Prettier)
- Comprehensive test suite execution
- Security vulnerability scanning
- Plugin validation
- Coverage reporting

## Performance Optimizations

### Frontend Optimizations

- **Virtual Scrolling**: Efficient timeline rendering for large projects
- **Canvas Optimization**: Hardware-accelerated preview rendering
- **Memory Management**: Automatic cleanup of unused preview files
- **Debounced Updates**: Reduced API calls during timeline scrubbing

### Backend Optimizations

- **Proxy System**: 90% reduction in preview generation time
- **Background Processing**: Non-blocking video operations
- **Memory Pooling**: Reused FFmpeg instances for better performance
- **Caching**: Intelligent thumbnail and preview caching

### FFmpeg Optimizations

- **Hardware Acceleration**: GPU-accelerated encoding when available
- **Multi-threading**: Parallel processing for complex filter chains
- **Preset Optimization**: Balanced quality/speed encoding settings
- **Stream Copying**: Unchanged audio/video stream passthrough

## Contributing

### Development Workflow

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** with proper testing
4. **Run quality checks**: `npm run lint && npm test`
5. **Commit changes**: `git commit -m 'feat: add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open Pull Request**

### Contribution Guidelines

- **Code Style**: Follow ESLint and Prettier configurations
- **Testing**: Add tests for new features and bug fixes
- **Documentation**: Update relevant documentation
- **Plugins**: Consider creating plugins for new effects
- **Performance**: Consider performance impact of changes

### Plugin Contributions

The easiest way to contribute is by creating plugins:

1. **Create plugin** in `community-plugins/` directory
2. **Add tests** for plugin functionality
3. **Document usage** in plugin README
4. **Submit PR** for community review

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **FFmpeg** - The powerful video processing engine
- **Express.js** - Web application framework
- **TailwindCSS** - Utility-first CSS framework
- **Fabric.js** - Canvas library for advanced interactions
- **Community** - Plugin developers and contributors

---