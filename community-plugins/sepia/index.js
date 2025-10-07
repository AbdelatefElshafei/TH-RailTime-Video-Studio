/**
 * Sepia Plugin for TH-RailTime-Video-Studio
 * Applies classic sepia tone filter
 */

module.exports = {
    name: 'Sepia',
    type: 'effect',
    effectType: 'color',
    version: '1.0.0',
    author: 'TH-RailTime-Video-Studio Team',
    description: 'Apply classic sepia tone filter with adjustable intensity',
    
    params: [
        {
            name: 'intensity',
            type: 'number',
            default: 1.0,
            min: 0,
            max: 1,
            step: 0.01,
            description: 'Sepia intensity (0 = original, 1 = full sepia)',
            unit: '%'
        },
        {
            name: 'preserve_luminance',
            type: 'boolean',
            default: true,
            description: 'Preserve original luminance values'
        }
    ],
    
    generateFilter: function(clip, params) {
        const intensity = params.intensity || 1.0;
        const preserveLuminance = params.preserve_luminance !== false;
        
        // Sepia color matrix values
        const r = 0.393 + (0.607 * (1 - intensity));
        const g = 0.769 + (0.231 * (1 - intensity));
        const b = 0.189 + (0.811 * (1 - intensity));
        
        let filter;
        
        if (preserveLuminance) {
            // Use colorchannelmixer for better luminance preservation
            filter = `colorchannelmixer=rr=${r}:gg=${g}:bb=${b}`;
        } else {
            // Use sepia filter for classic look
            filter = `sepia=intensity=${intensity}`;
        }
        
        return {
            video: [filter],
            audio: []
        };
    },
    
    validate: function(params) {
        if (params.intensity < 0 || params.intensity > 1) {
            throw new Error('Sepia intensity must be between 0 and 1');
        }
        
        return true;
    },
    
    // Preview generation
    generatePreview: function(params) {
        const intensity = Math.min(params.intensity * 1.2, 1); // Slightly enhanced for preview
        return {
            video: [`sepia=intensity=${intensity}`],
            audio: []
        };
    }
};
