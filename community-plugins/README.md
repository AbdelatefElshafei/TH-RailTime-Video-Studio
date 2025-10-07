# TH-RailTime-Video-Studio Community Plugins

Welcome to the community plugins repository for TH-RailTime-Video-Studio! This repository contains ready-to-use plugins that extend the video editing capabilities of the main application.

## Plugin Structure

Each plugin follows a standardized structure:

```
plugin-name/
├── index.js          # Main plugin file
├── README.md         # Plugin documentation
├── package.json      # Plugin metadata
└── examples/         # Usage examples
    └── example.json
```

## Available Plugins

### Visual Effects
- **Blur** - Apply Gaussian blur effects
- **Sepia** - Classic sepia tone filter
- **FadeIn** - Smooth fade-in transition
- **FadeOut** - Smooth fade-out transition

### Audio Effects
- **AudioNormalize** - Normalize audio levels
- **AudioEcho** - Add echo/reverb effects
- **AudioFade** - Audio fade in/out

### Color Grading
- **LUT Loader** - Load and apply Look-Up Tables
- **ColorCorrection** - Basic color correction tools
- **Vintage** - Vintage film look

### Transitions
- **SlideTransition** - Slide between clips
- **ZoomTransition** - Zoom-based transitions
- **WipeTransition** - Wipe transitions

## Plugin API Documentation

### Plugin Structure

```javascript
module.exports = {
    name: 'Plugin Name',
    type: 'effect', // 'effect', 'transition', 'filter'
    effectType: 'visual', // 'visual', 'audio', 'color'
    version: '1.0.0',
    author: 'Your Name',
    description: 'Plugin description',
    
    // Plugin parameters
    params: [
        {
            name: 'strength',
            type: 'number',
            default: 1.0,
            min: 0,
            max: 10,
            description: 'Effect strength'
        }
    ],
    
    // FFmpeg filter generation
    generateFilter: function(clip, params) {
        return {
            video: [`gblur=sigma=${params.strength}`],
            audio: []
        };
    },
    
    // Validation function
    validate: function(params) {
        if (params.strength < 0 || params.strength > 10) {
            throw new Error('Strength must be between 0 and 10');
        }
        return true;
    }
};
```

### Parameter Types

- `number` - Numeric values with min/max constraints
- `boolean` - True/false values
- `string` - Text values
- `select` - Dropdown selection
- `color` - Color picker
- `file` - File upload

### FFmpeg Compatibility

All plugins must generate FFmpeg-compatible filter strings. Common patterns:

```javascript
// Video filters
video: [`gblur=sigma=${strength}`]
video: [`eq=brightness=${brightness}:contrast=${contrast}`]
video: [`colorchannelmixer=rr=${r}:gg=${g}:bb=${b}`]

// Audio filters
audio: [`volume=${volume}`]
audio: [`aecho=0.8:0.9:1000:0.3`]
audio: [`highpass=f=${frequency}`]
```

## Testing

Each plugin includes comprehensive tests:

```bash
# Run plugin tests
npm test

# Test specific plugin
npm test -- --grep "Blur Plugin"

# Test FFmpeg compatibility
npm run test:ffmpeg
```

## Installation

1. Clone this repository
2. Copy desired plugins to your main project's `plugins/` directory
3. Restart the TH-RailTime-Video-Studio server
4. Plugins will be automatically loaded and available in the effects panel

## 🤝 Contributing

1. Fork this repository
2. Create a new plugin following the structure above
3. Add comprehensive tests
4. Update this README
5. Submit a pull request

## 📄 License

All plugins are released under the MIT License. See LICENSE file for details.

## 🆘 Support

- GitHub Issues: Report bugs or request features
- Documentation: Check individual plugin README files
- Community: Join our Discord server for help and discussions
