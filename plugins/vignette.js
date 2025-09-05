// Example custom effect plugin: /plugins/vignette.js
module.exports = {
    // --- Required Properties ---
    name: 'Vignette',         // User-friendly name displayed in the UI
    type: 'vignette',        // Unique internal identifier for this effect
    effectType: 'video',     // Can be 'video' or 'audio'
  
    // --- Optional: Define parameters for the UI ---
    params: [
      { 
        name: 'Strength',      // Label for the UI control
        key: 'strength',     // Key to access this value in the params object
        type: 'slider',      // Type of UI control ('slider' or 'number')
        min: 0,              // Minimum value for slider
        max: 1,              // Maximum value for slider
        step: 0.05,          // Step value for slider
        defaultValue: 0.5    // Initial value when effect is applied
      },
    ],
  
    // --- Required: Function to generate the FFmpeg filter string ---
    // It receives the 'params' object with values from the UI
    buildFilter: (params) => {
      // Read the 'strength' value, using the default if it's not set
      const strength = params.strength ?? 0.5;
      
      // Map the 0-1 strength value to a reasonable FFmpeg angle for the vignette effect.
      // A smaller angle creates a stronger, more focused vignette.
      const angle = Math.PI / 2.5 * (1 - strength); 
      
      // Return the final FFmpeg filter string
      return `vignette=angle=${angle}`;
    }
  };