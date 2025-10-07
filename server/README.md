# Server Architecture

This directory contains the modular server architecture for TH Realtime Video Studio.

## 📁 Directory Structure

```
server/
├── routes/           # API route handlers
│   ├── upload.js     # File upload endpoints
│   ├── render.js     # Video rendering endpoints
│   └── plugins.js    # Plugin management endpoints
├── services/         # Business logic services
│   ├── ffmpegService.js  # FFmpeg operations
│   └── proxyService.js   # Proxy file management
├── utils/            # Utility functions
│   └── fileHelpers.js    # File system utilities
├── server.js         # Main server application
└── README.md         # This file
```

## 🚀 Getting Started

### Environment Configuration

Create a `.env` file in the project root with the following variables:

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

# FFmpeg Configuration
FFMPEG_PATH=
FFPROBE_PATH=

# Upload Configuration
MAX_UPLOAD_SIZE=50mb

# Development Configuration
NODE_ENV=development

# WebSocket Configuration
WS_ENABLED=true

# Cleanup Configuration (in milliseconds)
PREVIEW_CLEANUP_AGE=900000
THUMBNAIL_CLEANUP_AGE=300000
```

### Running the Server

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or run directly
node server.js

# Or run the modular server directly
node server/server.js
```

## 📋 API Endpoints

### Upload Routes (`/routes/upload.js`)

- `POST /upload` - Upload media files
- `POST /upload-lut` - Upload LUT files
- `GET /upload/stats` - Get upload statistics
- `DELETE /upload/:filename` - Delete uploaded file

### Render Routes (`/routes/render.js`)

- `POST /render` - Start video rendering job
- `GET /status/:jobId` - Get render job status
- `POST /preview` - Generate video preview
- `POST /thumbnail` - Generate thumbnail
- `GET /waveform/:filename` - Get audio waveform data

### Plugin Routes (`/routes/plugins.js`)

- `GET /api/plugins` - Get all available plugins
- `GET /api/plugins/:type` - Get specific plugin
- `POST /api/plugins/reload` - Reload all plugins
- `GET /api/plugins/stats` - Get plugin statistics
- `POST /api/plugins/validate` - Validate plugin structure

### System Routes

- `GET /api/health` - Health check
- `GET /api/info` - Server information

## 🔧 Services

### FFmpeg Service (`/services/ffmpegService.js`)

Handles all FFmpeg operations:
- Video processing
- Filter generation
- Keyframe expressions
- Audio processing

### Proxy Service (`/services/proxyService.js`)

Manages proxy file generation and retrieval:
- Generate low-resolution proxies
- File path resolution
- Cleanup operations
- Statistics

## 🛠️ Utilities

### File Helpers (`/utils/fileHelpers.js`)

Common file operations:
- Directory management
- File validation
- Cleanup operations
- File statistics

## 🔌 Plugin System

Plugins are automatically loaded from the `plugins/` directory. Each plugin must export an object with:

```javascript
module.exports = {
  name: 'Plugin Name',
  type: 'unique_identifier',
  effectType: 'video', // or 'audio'
  params: [
    {
      name: 'Parameter Name',
      key: 'paramKey',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.1,
      defaultValue: 0.5
    }
  ],
  buildFilter: (params) => {
    // Return FFmpeg filter string
    return 'filter=param1=value1';
  }
};
```

## 🌐 WebSocket Support

Real-time preview generation is supported via WebSocket connections:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.send(JSON.stringify({
  type: 'preview_request',
  project: projectData,
  timestamp: 10.5,
  duration: 3,
  sessionId: 'unique-session-id',
  useProxy: true
}));
```

## 🧹 Cleanup

The server automatically cleans up old files:
- Previews: 15 minutes (configurable)
- Thumbnails: 5 minutes (configurable)

## 📊 Monitoring

The server provides several monitoring endpoints:
- Health check for load balancers
- Server information and statistics
- Upload and proxy statistics
- Plugin statistics

## 🔒 Security

- CORS enabled for cross-origin requests
- File upload size limits
- Input validation and sanitization
- Error handling and logging

## 🚀 Performance

- Modular architecture for better maintainability
- Efficient proxy workflow
- Background processing for heavy operations
- Automatic cleanup to prevent disk space issues

## 📝 Development

### Adding New Routes

1. Create a new file in `routes/`
2. Export a router with your endpoints
3. Import and use in `server.js`

### Adding New Services

1. Create a new file in `services/`
2. Export a class or object with your methods
3. Import and use in your routes

### Adding New Utilities

1. Create a new file in `utils/`
2. Export your utility functions
3. Import and use throughout the application

## 🐛 Troubleshooting

### Common Issues

1. **FFmpeg not found**: Set `FFMPEG_PATH` in `.env`
2. **Permission errors**: Check directory permissions
3. **Memory issues**: Reduce `MAX_UPLOAD_SIZE`
4. **WebSocket errors**: Check `WS_ENABLED` setting

### Logs

The server provides detailed logging for:
- File operations
- FFmpeg commands
- WebSocket connections
- Error conditions

## 📚 Further Reading

- [Main README](../README.md) - Project overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [TODO.md](../TODO.md) - Future development plans
