# Changelog

All notable changes to TH Realtime Video Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Demo preview section in README
- Enhanced badges with GitHub issues and last commit
- "Why TH Realtime Video Studio?" section highlighting unique features
- Comprehensive CONTRIBUTING.md with code standards and PR guidelines
- CODE_OF_CONDUCT.md for community guidelines
- CHANGELOG.md for version tracking
- TODO.md for future development roadmap

### Changed
- Improved README structure and organization
- Enhanced project documentation

## [1.0.0] - 2024-01-XX

### Added
- Initial release of TH Realtime Video Studio
- Browser-based non-linear video editor interface
- Real-time previews with WebSocket connection
- High-performance proxy workflow for 4K+ editing
- Extensible Plugin API for custom effects
- Advanced color correction tools:
  - Professional Color Wheels (Lift, Gamma, Gain)
  - Custom .cube LUT support
  - RGB Curves control
  - Brightness, Contrast, and Saturation sliders
- Keyframe animations for position, scale, and opacity
- Essential editing tools:
  - Chroma Key (green screen)
  - Advanced polygon masking
  - Clip splitting and ripple delete
- Background rendering with real-time progress updates
- Node.js/Express backend with FFmpeg integration
- WebSocket real-time communication
- Vanilla JavaScript frontend with TailwindCSS
- Fabric.js integration for masking tools
- Example vignette plugin demonstrating Plugin API

### Technical Details
- **Backend**: Node.js, Express.js, FFmpeg, WebSocket (ws library)
- **Frontend**: Vanilla JavaScript (ES6+), TailwindCSS, Fabric.js
- **Dependencies**: multer, fluent-ffmpeg, sanitize-filename, cuid, cors
- **File Structure**: Organized directories for plugins, proxies, processed videos, uploads, and thumbnails

---

## Version History

### [1.0.0] - Initial Release
- Complete video editing suite with professional features
- Plugin system for extensibility
- Proxy workflow for performance
- Real-time preview capabilities

---

## How to Read This Changelog

- **[Unreleased]**: Changes that are not yet released
- **[Version]**: Released versions with dates
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

---

## Contributing to the Changelog

When making changes to the project:

1. Add your changes to the **[Unreleased]** section
2. Use the appropriate category (Added, Changed, Fixed, etc.)
3. Use present tense ("Add feature" not "Added feature")
4. Include PR numbers when available
5. Group related changes together
6. Move **[Unreleased]** items to a new version when releasing

### Example Entry

```markdown
### Added
- New blur effect plugin (#123)
- Keyboard shortcuts for timeline navigation (#124)

### Fixed
- Timeline scrubbing performance issue (#125)
- Memory leak in long video processing (#126)
```

---

*This changelog is automatically updated with each release. For the latest updates, check the [releases page](https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio/releases).*
