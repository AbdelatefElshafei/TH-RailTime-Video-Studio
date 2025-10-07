# Testing Guide for TH-RailTime-Video-Studio

## Overview

This guide covers testing strategies, best practices, and implementation details for the TH-RailTime-Video-Studio project.

## Testing Infrastructure

### Jest Configuration

The project uses Jest as the primary testing framework with the following configuration:

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/*.test.js'
  ],
  collectCoverageFrom: [
    'server/**/*.js',
    'plugins/**/*.js',
    '!server/**/*.test.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true
};
```

### Test Scripts

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:ffmpeg
npm run test:plugins
```

## Testing Categories

### 1. Unit Tests

Test individual functions and modules in isolation.

#### Plugin Tests

```javascript
// tests/plugins.test.js
describe('Plugin Loading System', () => {
  test('should validate plugin structure', () => {
    const validPlugin = {
      name: 'Test Plugin',
      type: 'effect',
      effectType: 'visual',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Test description',
      params: [],
      generateFilter: jest.fn(),
      validate: jest.fn()
    };

    expect(() => {
      validatePlugin(validPlugin);
    }).not.toThrow();
  });
});
```

#### FFmpeg Service Tests

```javascript
// tests/ffmpeg.test.js
describe('FFmpeg Service', () => {
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
});
```

### 2. Integration Tests

Test how different modules work together.

#### API Integration Tests

```javascript
// tests/api.test.js
describe('API Endpoints', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });

  test('POST /api/render should process video', async () => {
    const response = await request(app)
      .post('/api/render')
      .send({
        project: mockProject,
        settings: mockSettings
      })
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

#### Plugin Integration Tests

```javascript
// tests/plugin-integration.test.js
describe('Plugin Integration', () => {
  test('should apply plugin effects to video', async () => {
    const plugin = require('../plugins/blur');
    const clip = {
      effects: [{
        type: 'blur',
        params: { strength: 2 }
      }]
    };

    const filters = plugin.generateFilter(clip, { strength: 2 });
    
    expect(filters.video).toContain('gblur=sigma=2');
  });
});
```

### 3. End-to-End Tests

Test complete workflows from user input to final output.

#### Upload and Processing Workflow

```javascript
// tests/e2e.test.js
describe('Upload and Processing Workflow', () => {
  test('should upload video and generate proxy', async () => {
    const response = await request(app)
      .post('/api/upload')
      .attach('media', Buffer.from('mock video'), 'test.mp4')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.hasProxy).toBe(true);
  });
});
```

## Mocking Strategies

### FFmpeg Mocking

```javascript
// Mock fluent-ffmpeg to avoid actual video processing
jest.mock('fluent-ffmpeg', () => {
  return jest.fn(() => ({
    input: jest.fn().mockReturnThis(),
    size: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    complexFilter: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    save: jest.fn().mockImplementation((path, callback) => {
      setTimeout(() => callback(), 100);
    })
  }));
});
```

### File System Mocking

```javascript
// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));
```

### Console Mocking

```javascript
// Reduce console noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
```

## Coverage Requirements

### Coverage Targets

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

## Continuous Integration

### GitHub Actions Workflow

The CI pipeline includes:

1. **Linting**: ESLint checks for code quality
2. **Formatting**: Prettier checks for code formatting
3. **Testing**: Jest tests with coverage
4. **Security**: npm audit for vulnerabilities
5. **Build**: Server startup verification

### Pre-commit Hooks

```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run test"
```

## Test Data Management

### Mock Data

```javascript
// tests/mockData.js
const mockProject = {
  settings: {
    width: 1920,
    height: 1080,
    fps: 30
  },
  tracks: [
    {
      id: 'track-1',
      type: 'video',
      clips: [
        {
          id: 'clip-1',
          src: 'test-video.mp4',
          start: 0,
          duration: 10,
          timelineStart: 0,
          volume: 1,
          opacity: { value: 1 },
          effects: []
        }
      ]
    }
  ]
};

module.exports = { mockProject };
```

### Test Files

```javascript
// Create test files dynamically
const createTestFile = (filename, content) => {
  const filePath = path.join(__dirname, '../test-uploads', filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

// Clean up test files
const cleanupTestFiles = () => {
  const testDir = path.join(__dirname, '../test-uploads');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
};
```

## Debugging Tests

### Debug Mode

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run specific test with debug
node --inspect-brk node_modules/.bin/jest --runInBand tests/ffmpeg.test.js
```

### Verbose Output

```bash
# Run tests with verbose output
npm test -- --verbose

# Run tests with detailed output
npm test -- --detectOpenHandles --forceExit
```

## Test Documentation

### Test Naming Conventions

- Use descriptive test names
- Group related tests with `describe` blocks
- Use `it` or `test` for individual test cases

```javascript
describe('Plugin Loading System', () => {
  describe('Plugin Validation', () => {
    it('should validate plugin structure', () => {
      // test implementation
    });
    
    it('should reject invalid plugins', () => {
      // test implementation
    });
  });
});
```

### Test Structure

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  test('should do something specific', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

## Best Practices

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use descriptive names** for tests and test groups
3. **Keep tests focused** on single functionality
4. **Use proper setup/teardown** with `beforeEach`/`afterEach`

### Test Data

1. **Use realistic test data** that matches production scenarios
2. **Create reusable mock data** in separate files
3. **Clean up test data** after tests complete
4. **Use factories** for generating test data

### Assertions

1. **Use specific assertions** (`toBe`, `toEqual`, `toContain`)
2. **Test both positive and negative cases**
3. **Verify error conditions** and edge cases
4. **Use custom matchers** for complex assertions

### Performance

1. **Mock expensive operations** (file I/O, network calls)
2. **Use parallel test execution** where possible
3. **Avoid unnecessary setup/teardown** in tests
4. **Profile slow tests** and optimize them

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Mock Functions](https://jestjs.io/docs/mock-functions)
- [Coverage Reports](https://jestjs.io/docs/cli#--coverage)
