/**
 * Brightness Plugin for TH-RailTime-Video-Studio
 * Adjusts video brightness
 */

module.exports = {
    // Required properties
    name: 'Brightness',
    type: 'brightness',
    effectType: 'video',
    
    // Plugin parameters
    params: [
        {
            name: 'Level',
            key: 'level',
            type: 'slider',
            min: -1,
            max: 1,
            step: 0.01,
            defaultValue: 0
        }
    ],
    
    // FFmpeg filter generation
    buildFilter: (params) => {
        const level = params.level ?? 0;
        return `eq=brightness=${level}`;
    }
};
