/**
 * Blur Plugin for TH-RailTime-Video-Studio
 * Applies Gaussian blur effects to video clips
 */

module.exports = {
    // Required properties
    name: 'Blur',
    type: 'blur',
    effectType: 'video',
    
    // Plugin parameters
    params: [
        {
            name: 'Strength',
            key: 'strength',
            type: 'slider',
            min: 0,
            max: 10,
            step: 0.1,
            defaultValue: 1.0
        },
        {
            name: 'Type',
            key: 'type',
            type: 'select',
            options: [
                { value: 'gaussian', label: 'Gaussian Blur' },
                { value: 'box', label: 'Box Blur' },
                { value: 'motion', label: 'Motion Blur' }
            ],
            defaultValue: 'gaussian'
        },
        {
            name: 'Angle',
            key: 'angle',
            type: 'slider',
            min: 0,
            max: 360,
            step: 1,
            defaultValue: 0
        }
    ],
    
    // FFmpeg filter generation
    buildFilter: (params) => {
        const strength = params.strength ?? 1.0;
        const type = params.type ?? 'gaussian';
        const angle = params.angle ?? 0;
        
        switch (type) {
            case 'gaussian':
                return `gblur=sigma=${strength}`;
            case 'box':
                return `boxblur=${strength}`;
            case 'motion':
                return `motionblur=angle=${angle}:distance=${strength}`;
            default:
                return `gblur=sigma=${strength}`;
        }
    }
};
