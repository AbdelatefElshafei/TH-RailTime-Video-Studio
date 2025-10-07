const path = require('path');
const fs = require('fs');

describe('FFmpeg Service', () => {
  let ffmpegService;

  beforeEach(() => {
    jest.resetModules();
    ffmpegService = require('../server/services/ffmpegService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Filter Generation', () => {
    test('should generate basic video filters', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        volume: 1,
        opacity: { value: 1 },
        effects: []
      };

      const filters = ffmpegService.buildVisualFilters(clip, 0);
      
      expect(filters).toBeInstanceOf(Array);
      expect(filters.length).toBeGreaterThan(0);
    });

    test('should handle opacity keyframes', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        volume: 1,
        opacity: {
          value: 1,
          keyframes: [
            { time: 0, value: 0 },
            { time: 5, value: 1 }
          ]
        },
        effects: []
      };

      const filters = ffmpegService.buildVisualFilters(clip, 0);
      
      expect(filters).toBeInstanceOf(Array);
      expect(filters.some(filter => filter.includes('colorchannelmixer'))).toBe(true);
    });

    test('should generate audio filters', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        volume: 0.8,
        effects: []
      };

      const filters = ffmpegService.buildAudioFilters(clip);
      
      expect(filters).toBeInstanceOf(Array);
      expect(filters.some(filter => filter.includes('volume'))).toBe(true);
    });

    test('should handle speed changes', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        speed: 2,
        volume: 1,
        effects: []
      };

      const videoFilters = ffmpegService.buildVisualFilters(clip, 0);
      const audioFilters = ffmpegService.buildAudioFilters(clip);
      
      expect(videoFilters.some(filter => filter.includes('setpts'))).toBe(true);
      expect(audioFilters.some(filter => filter.includes('atempo'))).toBe(true);
    });

    test('should handle reverse playback', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        reverse: true,
        volume: 1,
        effects: []
      };

      const videoFilters = ffmpegService.buildVisualFilters(clip, 0);
      const audioFilters = ffmpegService.buildAudioFilters(clip);
      
      expect(videoFilters.some(filter => filter.includes('reverse'))).toBe(true);
      expect(audioFilters.some(filter => filter.includes('areverse'))).toBe(true);
    });
  });

  describe('Keyframe Expression Building', () => {
    test('should build simple keyframe expressions', () => {
      const keyframes = [
        { time: 0, value: 0 },
        { time: 5, value: 1 }
      ];

      const expression = ffmpegService.buildKeyframeExpression(keyframes, 1, 0);
      
      expect(typeof expression).toBe('string');
      expect(expression).toContain('if');
    });

    test('should handle single keyframe', () => {
      const keyframes = [
        { time: 0, value: 0.5 }
      ];

      const expression = ffmpegService.buildKeyframeExpression(keyframes, 1, 0);
      
      expect(expression).toBe('0.5');
    });

    test('should handle empty keyframes', () => {
      const keyframes = [];

      const expression = ffmpegService.buildKeyframeExpression(keyframes, 1, 0);
      
      expect(expression).toBe('1');
    });

    test('should handle null keyframes', () => {
      const expression = ffmpegService.buildKeyframeExpression(null, 1, 0);
      
      expect(expression).toBe('1');
    });
  });

  describe('Effect Processing', () => {
    test('should process blur effects', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        volume: 1,
        effects: [
          {
            type: 'blur',
            params: { strength: 2 }
          }
        ]
      };

      const filters = ffmpegService.buildVisualFilters(clip, 0);
      
      expect(filters.some(filter => filter.includes('gblur'))).toBe(true);
    });

    test('should process color correction effects', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        volume: 1,
        effects: [
          {
            type: 'colorcorrection',
            params: { brightness: 0.2, contrast: 1.1, saturation: 1.2 }
          }
        ]
      };

      const filters = ffmpegService.buildVisualFilters(clip, 0);
      
      expect(filters.some(filter => filter.includes('eq'))).toBe(true);
    });

    test('should process LUT effects', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        volume: 1,
        effects: [
          {
            type: 'lut',
            params: { lut: 'test.cube' }
          }
        ]
      };

      const filters = ffmpegService.buildVisualFilters(clip, 0);
      
      // LUT processing should not throw errors
      expect(() => ffmpegService.buildVisualFilters(clip, 0)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid clip data gracefully', () => {
      const invalidClip = null;

      expect(() => {
        ffmpegService.buildVisualFilters(invalidClip, 0);
      }).not.toThrow();
    });

    test('should handle missing clip properties', () => {
      const incompleteClip = {
        id: 'test-clip'
        // Missing required properties
      };

      expect(() => {
        ffmpegService.buildVisualFilters(incompleteClip, 0);
      }).not.toThrow();
    });

    test('should handle invalid opacity values', () => {
      const clip = {
        id: 'test-clip',
        start: 0,
        duration: 10,
        volume: 1,
        opacity: 'invalid',
        effects: []
      };

      expect(() => {
        ffmpegService.buildVisualFilters(clip, 0);
      }).not.toThrow();
    });
  });
});
