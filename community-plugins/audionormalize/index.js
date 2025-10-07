/**
 * AudioNormalize Plugin for TH-RailTime-Video-Studio
 * Normalizes audio levels for consistent volume
 */

module.exports = {
    name: 'AudioNormalize',
    type: 'effect',
    effectType: 'audio',
    version: '1.0.0',
    author: 'TH-RailTime-Video-Studio Team',
    description: 'Normalize audio levels for consistent volume across clips',
    
    params: [
        {
            name: 'target_level',
            type: 'number',
            default: -23,
            min: -60,
            max: 0,
            step: 0.1,
            description: 'Target audio level (dB)',
            unit: 'dB'
        },
        {
            name: 'method',
            type: 'select',
            default: 'peak',
            options: [
                { value: 'peak', label: 'Peak Normalization' },
                { value: 'rms', label: 'RMS Normalization' },
                { value: 'lufs', label: 'LUFS Normalization' }
            ],
            description: 'Normalization method'
        },
        {
            name: 'prevent_clipping',
            type: 'boolean',
            default: true,
            description: 'Prevent audio clipping during normalization'
        }
    ],
    
    generateFilter: function(clip, params) {
        const targetLevel = params.target_level || -23;
        const method = params.method || 'peak';
        const preventClipping = params.prevent_clipping !== false;
        
        let filters = [];
        
        switch (method) {
            case 'peak':
                if (preventClipping) {
                    filters.push(`loudnorm=I=${targetLevel}:TP=-1.5:LRA=11`);
                } else {
                    filters.push(`volume=${Math.pow(10, targetLevel / 20)}`);
                }
                break;
            case 'rms':
                filters.push(`dynaudnorm=p=${targetLevel}:s=0.95`);
                break;
            case 'lufs':
                filters.push(`loudnorm=I=${targetLevel}:TP=-1.5:LRA=11`);
                break;
            default:
                filters.push(`loudnorm=I=${targetLevel}:TP=-1.5:LRA=11`);
        }
        
        return {
            video: [],
            audio: filters
        };
    },
    
    validate: function(params) {
        if (params.target_level < -60 || params.target_level > 0) {
            throw new Error('Target level must be between -60 and 0 dB');
        }
        
        const validMethods = ['peak', 'rms', 'lufs'];
        if (!validMethods.includes(params.method)) {
            throw new Error('Invalid normalization method');
        }
        
        return true;
    },
    
    // Preview generation
    generatePreview: function(params) {
        // Use lighter normalization for preview to avoid processing delays
        return {
            video: [],
            audio: [`volume=${Math.pow(10, (params.target_level + 3) / 20)}`]
        };
    }
};
