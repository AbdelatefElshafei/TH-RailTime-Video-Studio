/**
 * Contrast Plugin for TH-RailTime-Video-Studio
 * Adjusts video contrast
 */

module.exports = {
    // Required properties
    name: 'Contrast',
    type: 'contrast',
    effectType: 'video',
    
    // Plugin parameters
    params: [
        {
            name: 'Level',
            key: 'level',
            type: 'slider',
            min: 0,
            max: 2,
            step: 0.01,
            defaultValue: 1
        }
    ],
    
    // FFmpeg filter generation
    buildFilter: (params) => {
        const level = params.level ?? 1;
        return `eq=contrast=${level}`;
    }
};
