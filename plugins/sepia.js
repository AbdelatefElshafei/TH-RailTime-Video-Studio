/**
 * Sepia Plugin for TH-RailTime-Video-Studio
 * Applies classic sepia tone filter
 */

module.exports = {
    // Required properties
    name: 'Sepia',
    type: 'sepia',
    effectType: 'video',
    
    // Plugin parameters
    params: [
        {
            name: 'Intensity',
            key: 'intensity',
            type: 'slider',
            min: 0,
            max: 1,
            step: 0.01,
            defaultValue: 1.0
        }
    ],
    
    // FFmpeg filter generation
    buildFilter: (params) => {
        const intensity = params.intensity ?? 1.0;
        return `sepia=intensity=${intensity}`;
    }
};
