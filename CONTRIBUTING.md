# Contributing to TH Realtime Video Studio

Thank you for your interest in contributing to TH Realtime Video Studio! This document provides guidelines and information for contributors.

## How to Contribute

### Reporting Issues

Before creating an issue, please:
1. Check if the issue already exists
2. Use the issue templates when available
3. Provide clear steps to reproduce the problem
4. Include system information (OS, Node.js version, browser)

### Suggesting Features

We welcome feature suggestions! Please:
1. Check existing issues and discussions first
2. Provide a clear description of the proposed feature
3. Explain the use case and potential benefits
4. Consider implementation complexity

## 🛠️ Development Setup

### Prerequisites

- Node.js (v14 or newer)
- FFmpeg installed and accessible in PATH
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/AbdelatefElshafei/TH-RailTime-Video-Studio.git
   cd TH-RailTime-Video-Studio
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   node server.js
   ```

## Code Standards

### JavaScript Style Guide

- Use **ES6+** features (arrow functions, const/let, template literals)
- Follow **camelCase** for variables and functions
- Use **PascalCase** for constructors and classes
- Use **UPPER_SNAKE_CASE** for constants
- Use **kebab-case** for file names (except plugins)

### Code Formatting

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Add **trailing commas** in objects and arrays
- Use **semicolons** at the end of statements

### Example Code Style

```javascript
// Good
const processVideo = (videoData, options = {}) => {
  const { quality = 'high', format = 'mp4' } = options;
  
  return new Promise((resolve, reject) => {
    // Implementation
  });
};

// Bad
function processVideo(videoData, options) {
  var quality = options.quality || 'high';
  var format = options.format || 'mp4';
  // Implementation
}
```

## Plugin Development

### Plugin Structure

All plugins must follow this structure:

```javascript
module.exports = {
  // Required properties
  name: 'Plugin Name',
  type: 'unique_identifier',
  effectType: 'video', // or 'audio'
  
  // Optional parameters for UI generation
  params: [
    {
      name: 'Parameter Name',
      key: 'paramKey',
      type: 'slider', // or 'number'
      min: 0,
      max: 1,
      step: 0.1,
      defaultValue: 0.5
    }
  ],
  
  // Required: FFmpeg filter generation
  buildFilter: (params) => {
    // Return FFmpeg filter string
    return 'filter=param1=value1:param2=value2';
  }
};
```

### Plugin Guidelines

- **Naming**: Use descriptive, user-friendly names
- **Parameters**: Provide sensible defaults and ranges
- **Documentation**: Include comments explaining complex filters
- **Testing**: Test with various video formats and resolutions
- **Performance**: Avoid computationally expensive operations when possible

### Plugin Testing

Before submitting a plugin:
1. Test with different video formats (MP4, MOV, AVI)
2. Test with various resolutions (720p, 1080p, 4K)
3. Verify parameter ranges work correctly
4. Check for memory leaks with long videos

## Pull Request Process

### Before Submitting

1. **Fork and branch**: Create a feature branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Code quality**: Ensure your code follows the style guide
3. **Testing**: Test your changes thoroughly
4. **Documentation**: Update relevant documentation
5. **Commits**: Write clear, descriptive commit messages

### Commit Message Format

Use conventional commits format:
```
type(scope): description

feat(plugin): add blur effect plugin
fix(ui): resolve timeline scrubbing issue
docs(readme): update installation instructions
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Template

When creating a PR, include:

- **Description**: What changes were made and why
- **Type**: Bug fix, feature, documentation, etc.
- **Testing**: How the changes were tested
- **Screenshots**: For UI changes
- **Breaking changes**: If any

### Review Process

1. **Automated checks**: All PRs must pass automated checks
2. **Code review**: At least one maintainer must approve
3. **Testing**: Changes must be tested on multiple systems
4. **Documentation**: Documentation must be updated if needed

## Bug Reports

When reporting bugs, include:

- **Environment**: OS, Node.js version, browser
- **Steps to reproduce**: Clear, numbered steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots/Logs**: Visual evidence when possible

## Feature Requests

For feature requests:

- **Use case**: Why is this feature needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Other ways to solve the problem
- **Additional context**: Any other relevant information

## Documentation

### Code Documentation

- **Functions**: Document parameters, return values, and side effects
- **Complex logic**: Add comments explaining the reasoning
- **API endpoints**: Document request/response formats
- **Plugin API**: Keep plugin documentation up to date

### README Updates

When adding features:
- Update the feature list
- Add installation instructions if needed
- Update the project structure if files were added
- Include usage examples

## Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Changelog

All changes must be documented in `CHANGELOG.md`:
- Group changes by type (Added, Changed, Fixed, Removed)
- Include PR numbers and contributors
- Use present tense ("Add feature" not "Added feature")

##  Questions?

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Use issues for bugs and feature requests
- **Discord**: Join our community Discord (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.


