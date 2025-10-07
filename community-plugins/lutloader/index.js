/**
 * LUT Loader Plugin for TH-RailTime-Video-Studio
 * Loads and applies Look-Up Tables for color grading
 */

module.exports = {
    name: 'LUT Loader',
    type: 'effect',
    effectType: 'color',
    version: '1.0.0',
    author: 'TH-RailTime-Video-Studio Team',
    description: 'Load and apply Look-Up Tables (LUTs) for professional color grading',
    
    params: [
        {
            name: 'lut_file',
            type: 'file',
            accept: '.cube,.3dl,.png,.jpg,.jpeg',
            description: 'LUT file (.cube, .3dl, or image format)'
        },
        {
            name: 'intensity',
            type: 'number',
            default: 1.0,
            min: 0,
            max: 2,
            step: 0.01,
            description: 'LUT application intensity',
            unit: '%'
        },
        {
            name: 'interpolation',
            type: 'select',
            default: 'trilinear',
            options: [
                { value: 'trilinear', label: 'Trilinear (3D LUTs)' },
                { value: 'nearest', label: 'Nearest Neighbor' },
                { value: 'linear', label: 'Linear' }
            ],
            description: 'Interpolation method for 3D LUTs'
        },
        {
            name: 'preserve_alpha',
            type: 'boolean',
            default: true,
            description: 'Preserve alpha channel when applying LUT'
        }
    ],
    
    generateFilter: function(clip, params) {
        const lutFile = params.lut_file;
        const intensity = params.intensity || 1.0;
        const interpolation = params.interpolation || 'trilinear';
        const preserveAlpha = params.preserve_alpha !== false;
        
        if (!lutFile) {
            throw new Error('LUT file is required');
        }
        
        let filters = [];
        
        // Determine LUT type by file extension
        const extension = lutFile.toLowerCase().split('.').pop();
        
        if (extension === 'cube' || extension === '3dl') {
            // 3D LUT files
            const lutPath = `luts/${lutFile}`;
            
            if (intensity < 1.0) {
                // Blend with original for intensity control
                filters.push(`lut3d=file='${lutPath}':interp=${interpolation}[lut]`);
                filters.push(`[0:v][lut]blend=all_mode=normal:all_opacity=${intensity}`);
            } else {
                filters.push(`lut3d=file='${lutPath}':interp=${interpolation}`);
            }
        } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
            // Image-based LUT
            const lutPath = `luts/${lutFile}`;
            
            if (intensity < 1.0) {
                filters.push(`lut=file='${lutPath}'[lut]`);
                filters.push(`[0:v][lut]blend=all_mode=normal:all_opacity=${intensity}`);
            } else {
                filters.push(`lut=file='${lutPath}'`);
            }
        } else {
            throw new Error('Unsupported LUT file format');
        }
        
        return {
            video: filters,
            audio: []
        };
    },
    
    validate: function(params) {
        if (!params.lut_file) {
            throw new Error('LUT file is required');
        }
        
        if (params.intensity < 0 || params.intensity > 2) {
            throw new Error('Intensity must be between 0 and 2');
        }
        
        const validExtensions = ['cube', '3dl', 'png', 'jpg', 'jpeg'];
        const extension = params.lut_file.toLowerCase().split('.').pop();
        
        if (!validExtensions.includes(extension)) {
            throw new Error('Unsupported LUT file format. Supported: .cube, .3dl, .png, .jpg, .jpeg');
        }
        
        return true;
    },
    
    // Preview generation
    generatePreview: function(params) {
        if (!params.lut_file) return { video: [], audio: [] };
        
        const extension = params.lut_file.toLowerCase().split('.').pop();
        const lutPath = `luts/${params.lut_file}`;
        
        if (extension === 'cube' || extension === '3dl') {
            return {
                video: [`lut3d=file='${lutPath}':interp=trilinear`],
                audio: []
            };
        } else {
            return {
                video: [`lut=file='${lutPath}'`],
                audio: []
            };
        }
    }
};
