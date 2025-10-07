# TH-RailTime-Video-Studio Plugin API Documentation

## Overview

The TH-RailTime-Video-Studio Plugin API allows developers to create custom effects, transitions, and filters that integrate seamlessly with the video editing workflow. This document provides comprehensive documentation for plugin development.

## Plugin Structure

### Basic Plugin Template

```javascript
module.exports = {
    // Required fields
    name: 'Plugin Name',
    type: 'effect', // 'effect', 'transition', 'filter'
    effectType: 'visual', // 'visual', 'audio', 'color'
    version: '1.0.0',
    author: 'Your Name',
    description: 'Plugin description',
    
    // Plugin parameters
    params: [
        {
            name: 'parameter_name',
            type: 'number',
            default: 1.0,
            min: 0,
            max: 10,
            step: 0.1,
            description: 'Parameter description',
            unit: 'px'
        }
    ],
    
    // FFmpeg filter generation
    generateFilter: function(clip, params) {
        return {
            video: ['gblur=sigma=1'],
            audio: []
        };
    },
    
    // Parameter validation
    validate: function(params) {
        if (params.parameter_name < 0) {
            throw new Error('Parameter must be positive');
        }
        return true;
    },
    
    // Optional: Preview generation
    generatePreview: function(params) {
        return {
            video: ['gblur=sigma=0.5'],
            audio: []
        };
    }
};
```

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name of the plugin |
| `type` | string | Plugin type: `'effect'`, `'transition'`, `'filter'` |
| `effectType` | string | Effect category: `'visual'`, `'audio'`, `'color'` |
| `version` | string | Semantic version (e.g., `'1.0.0'`) |
| `author` | string | Plugin author name |
| `description` | string | Brief description of the plugin |
| `params` | array | Array of parameter definitions |
| `generateFilter` | function | Function that generates FFmpeg filters |
| `validate` | function | Function that validates parameters |

## Parameter Types

### Number Parameters

```javascript
{
    name: 'strength',
    type: 'number',
    default: 1.0,
    min: 0,
    max: 10,
    step: 0.1,
    description: 'Effect strength',
    unit: 'px'
}
```

### Boolean Parameters

```javascript
{
    name: 'enabled',
    type: 'boolean',
    default: true,
    description: 'Enable the effect'
}
```

### String Parameters

```javascript
{
    name: 'text',
    type: 'string',
    default: 'Hello World',
    description: 'Text to display'
}
```

### Select Parameters

```javascript
{
    name: 'mode',
    type: 'select',
    default: 'normal',
    options: [
        { value: 'normal', label: 'Normal' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'overlay', label: 'Overlay' }
    ],
    description: 'Blend mode'
}
```

### Color Parameters

```javascript
{
    name: 'color',
    type: 'color',
    default: '#FF0000',
    description: 'Effect color'
}
```

### File Parameters

```javascript
{
    name: 'lut_file',
    type: 'file',
    accept: '.cube,.3dl,.png',
    description: 'LUT file'
}
```

## FFmpeg Filter Generation

### Video Filters

```javascript
generateFilter: function(clip, params) {
    return {
        video: [
            'gblur=sigma=1',           // Gaussian blur
            'eq=brightness=0.2',       // Brightness adjustment
            'colorchannelmixer=rr=1.2' // Color channel mixing
        ],
        audio: []
    };
}
```

### Audio Filters

```javascript
generateFilter: function(clip, params) {
    return {
        video: [],
        audio: [
            'volume=0.8',              // Volume adjustment
            'aecho=0.8:0.9:1000:0.3', // Echo effect
            'highpass=f=200'          // High-pass filter
        ]
    };
}
```

### Complex Filters

```javascript
generateFilter: function(clip, params) {
    const strength = params.strength || 1.0;
    
    return {
        video: [
            `gblur=sigma=${strength}[blurred]`,
            `[0:v][blurred]blend=all_mode=normal:all_opacity=0.5[output]`
        ],
        audio: [
            `volume=${params.volume || 1}`
        ]
    };
}
```

## Common Filter Patterns

### Blur Effects

```javascript
// Gaussian blur
video: [`gblur=sigma=${strength}`]

// Box blur
video: [`boxblur=${strength}`]

// Motion blur
video: [`motionblur=angle=${angle}:distance=${distance}`]
```

### Color Effects

```javascript
// Brightness/Contrast/Saturation
video: [`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`]

// Color channel mixing
video: [`colorchannelmixer=rr=${r}:gg=${g}:bb=${b}`]

// Sepia tone
video: [`sepia=intensity=${intensity}`]

// LUT application
video: [`lut3d=file='${lutPath}'`]
```

### Audio Effects

```javascript
// Volume control
audio: [`volume=${volume}`]

// Echo/Reverb
audio: [`aecho=0.8:0.9:1000:0.3`]

// High-pass filter
audio: [`highpass=f=${frequency}`]

// Low-pass filter
audio: [`lowpass=f=${frequency}`]

// Normalization
audio: [`loudnorm=I=-23:TP=-1.5:LRA=11`]
```

### Transitions

```javascript
// Fade in
video: [`fade=t=in:st=0:d=${duration}:color=${color}`]

// Fade out
video: [`fade=t=out:st=${startTime}:d=${duration}:color=${color}`]

// Crossfade
video: [`xfade=transition=fade:duration=${duration}:offset=${offset}`]
```

## Parameter Validation

### Basic Validation

```javascript
validate: function(params) {
    // Check numeric ranges
    if (params.strength < 0 || params.strength > 10) {
        throw new Error('Strength must be between 0 and 10');
    }
    
    // Check string formats
    if (!/^#[0-9A-Fa-f]{6}$/.test(params.color)) {
        throw new Error('Color must be in hex format (#RRGGBB)');
    }
    
    // Check file extensions
    const validExtensions = ['cube', '3dl', 'png'];
    const extension = params.lut_file.split('.').pop();
    if (!validExtensions.includes(extension)) {
        throw new Error('Invalid LUT file format');
    }
    
    return true;
}
```

### Advanced Validation

```javascript
validate: function(params) {
    // Conditional validation
    if (params.type === 'motion' && !params.angle) {
        throw new Error('Angle is required for motion blur');
    }
    
    // Cross-parameter validation
    if (params.min_value >= params.max_value) {
        throw new Error('Min value must be less than max value');
    }
    
    // File existence check
    if (params.lut_file && !fs.existsSync(`luts/${params.lut_file}`)) {
        throw new Error('LUT file not found');
    }
    
    return true;
}
```

## Preview Generation

Preview filters should be lighter versions of the main effect for real-time performance:

```javascript
generatePreview: function(params) {
    const strength = Math.min(params.strength * 0.5, 2); // Lighter effect
    
    return {
        video: [`gblur=sigma=${strength}`],
        audio: []
    };
}
```

## File Handling

### LUT Files

```javascript
generateFilter: function(clip, params) {
    const lutPath = `luts/${params.lut_file}`;
    const extension = params.lut_file.split('.').pop();
    
    if (extension === 'cube' || extension === '3dl') {
        return {
            video: [`lut3d=file='${lutPath}'`],
            audio: []
        };
    } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
        return {
            video: [`lut=file='${lutPath}'`],
            audio: []
        };
    }
}
```

### Image Overlays

```javascript
generateFilter: function(clip, params) {
    const imagePath = `overlays/${params.image_file}`;
    
    return {
        video: [
            `movie=${imagePath}[overlay]`,
            `[0:v][overlay]overlay=x=${params.x}:y=${params.y}[output]`
        ],
        audio: []
    };
}
```

## Testing Plugins

### Unit Tests

```javascript
describe('Blur Plugin', () => {
    const blurPlugin = require('./blur');
    
    test('should generate correct filter', () => {
        const result = blurPlugin.generateFilter({}, { strength: 2 });
        expect(result.video).toContain('gblur=sigma=2');
    });
    
    test('should validate parameters', () => {
        expect(() => {
            blurPlugin.validate({ strength: 15 });
        }).toThrow('Strength must be between 0 and 10');
    });
});
```

### Integration Tests

```javascript
describe('Plugin Integration', () => {
    test('should work with FFmpeg', async () => {
        const plugin = require('./blur');
        const filters = plugin.generateFilter({}, { strength: 1 });
        
        // Test FFmpeg command generation
        const command = ffmpeg()
            .input('test.mp4')
            .complexFilter(filters.video.join(';'));
        
        expect(command).toBeDefined();
    });
});
```

## Best Practices

### Performance

- Use preview filters for real-time effects
- Minimize complex filter chains
- Cache expensive calculations
- Use appropriate filter complexity for the task

### Error Handling

- Always validate parameters
- Provide meaningful error messages
- Handle edge cases gracefully
- Test with invalid inputs

### Documentation

- Document all parameters clearly
- Provide usage examples
- Include FFmpeg compatibility notes
- Add unit tests for all functions

### Compatibility

- Test with different FFmpeg versions
- Handle missing dependencies gracefully
- Provide fallbacks for unsupported features
- Document system requirements

## Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html)
- [Plugin Examples](../community-plugins/)
- [Testing Guide](./testing.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
