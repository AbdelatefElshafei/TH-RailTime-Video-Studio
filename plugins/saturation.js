/**
 * Saturation Plugin for TH-RailTime-Video-Studio
 * Adjusts video saturation
 */

module.exports = {
    // Required properties
    name: 'Saturation',
    type: 'saturation',
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
        return `eq=saturation=${level}`;
    }
};
