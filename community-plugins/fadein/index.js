/**
 * FadeIn Plugin for TH-RailTime-Video-Studio
 * Creates smooth fade-in transitions
 */

module.exports = {
    name: 'FadeIn',
    type: 'effect',
    effectType: 'transition',
    version: '1.0.0',
    author: 'TH-RailTime-Video-Studio Team',
    description: 'Create smooth fade-in transitions with customizable duration',
    
    params: [
        {
            name: 'duration',
            type: 'number',
            default: 1.0,
            min: 0.1,
            max: 10,
            step: 0.1,
            description: 'Fade-in duration',
            unit: 's'
        },
        {
            name: 'color',
            type: 'color',
            default: '#000000',
            description: 'Fade color (usually black or white)'
        },
        {
            name: 'curve',
            type: 'select',
            default: 'linear',
            options: [
                { value: 'linear', label: 'Linear' },
                { value: 'quadratic', label: 'Quadratic' },
                { value: 'cubic', label: 'Cubic' },
                { value: 'exponential', label: 'Exponential' }
            ],
            description: 'Fade curve type'
        }
    ],
    
    generateFilter: function(clip, params) {
        const duration = params.duration || 1.0;
        const color = params.color || '#000000';
        const curve = params.curve || 'linear';
        
        // Convert hex color to RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        
        // Generate fade expression based on curve
        let fadeExpr;
        switch (curve) {
            case 'quadratic':
                fadeExpr = `(t/${duration})^2`;
                break;
            case 'cubic':
                fadeExpr = `(t/${duration})^3`;
                break;
            case 'exponential':
                fadeExpr = `1-exp(-3*t/${duration})`;
                break;
            default: // linear
                fadeExpr = `t/${duration}`;
        }
        
        // Create fade-in filter
        const filter = `fade=t=in:st=0:d=${duration}:color=${color}:alpha=1`;
        
        return {
            video: [filter],
            audio: []
        };
    },
    
    validate: function(params) {
        if (params.duration < 0.1 || params.duration > 10) {
            throw new Error('Fade duration must be between 0.1 and 10 seconds');
        }
        
        // Validate color format
        if (!/^#[0-9A-Fa-f]{6}$/.test(params.color)) {
            throw new Error('Color must be in hex format (#RRGGBB)');
        }
        
        return true;
    },
    
    // Preview generation
    generatePreview: function(params) {
        const duration = Math.min(params.duration * 0.5, 2); // Shorter duration for preview
        return {
            video: [`fade=t=in:st=0:d=${duration}:color=${params.color}`],
            audio: []
        };
    }
};
