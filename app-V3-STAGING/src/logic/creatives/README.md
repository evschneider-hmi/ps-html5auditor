# Creative Validation System

This directory contains the modular check system for validating creative files (HTML5, Video, Static images) in the Creative Suite Auditor.

## 📁 Directory Structure

```
creatives/
├── types.ts                 # Type definitions and interfaces
├── index.ts                 # Check registry and orchestrator
├── html5/                   # HTML5 banner creative checks
│   ├── cm360/              # CM360-specific HTML5 checks
│   ├── iab/                # IAB-specific HTML5 checks
│   ├── runtime/            # Runtime-based checks
│   └── validation/         # Validation checks
├── video/                   # Video creative checks (future)
├── static/                  # Static image checks (future)
├── common/                  # Universal checks for all creative types
├── legacy/                  # Legacy validator checks
└── utility/                 # Shared utilities
```

## 🏗️ Creating a New Check

### 1. Create the Check File

Create a new file in the appropriate subdirectory (e.g., `cm360/myCheck.ts`):

```typescript
import type { Check, CheckContext } from '../types';
import type { Finding } from '../../../../../src/logic/types';

export const myCheck: Check = {
  id: 'my-check',
  title: 'My Check Title',
  description: 'What this check validates',
  profiles: ['CM360'], // or ['IAB'] or ['CM360', 'IAB']
  priority: 'required', // or 'recommended' or 'advisory'
  
  execute(context: CheckContext): Finding {
    const { bundle, files, htmlText } = context;
    
    // Your check logic here
    const messages: string[] = [];
    const offenders: any[] = [];
    let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    
    // ... implement your check ...
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};
```

### 2. Register the Check

Add your check to `index.ts`:

```typescript
import { myCheck } from './cm360/myCheck';

const ALL_CHECKS: Check[] = [
  // ... existing checks ...
  myCheck, // Add your check here
];
```

### 3. Test the Check

Create a test file `cm360/__tests__/myCheck.test.ts`:

```typescript
import { myCheck } from '../myCheck';
import type { CheckContext } from '../../types';

describe('myCheck', () => {
  it('should pass when conditions are met', () => {
    const context: CheckContext = {
      // Mock context data
    };
    
    const result = myCheck.execute(context);
    expect(result.severity).toBe('PASS');
  });
});
```

## 📝 Check Interface

Every check must implement the `Check` interface:

```typescript
interface Check {
  id: string;                      // Unique identifier (kebab-case)
  title: string;                   // Display title
  description: string;             // What the check validates
  profiles: CheckProfile[];        // ['CM360', 'IAB', or 'BOTH']
  priority: CheckPriority;         // 'required' | 'recommended' | 'advisory'
  execute: (context) => Finding;   // Check implementation
}
```

## 🔍 Check Context

The `CheckContext` object provides everything a check needs:

```typescript
interface CheckContext {
  bundle: ZipBundle;        // The uploaded creative bundle
  partial: BundleResult;    // Scan results from initial processing
  settings: Settings;       // User settings
  files: string[];          // List of file paths
  primary?: string;         // Primary HTML file path
  htmlText: string;         // Decoded primary HTML content
  entryName?: string;       // Entry filename (e.g., "index.html")
  isIabProfile: boolean;    // Whether IAB profile is active
}
```

## 📊 Finding Structure

Every check must return a `Finding`:

```typescript
interface Finding {
  id: string;                          // Same as check.id
  title: string;                       // Same as check.title
  severity: 'PASS' | 'WARN' | 'FAIL';  // Check result
  messages: string[];                  // Bullet points shown in UI
  offenders: Offender[];               // Details of issues found
}

interface Offender {
  path: string;        // File path where issue was found
  line?: number;       // Line number (optional)
  detail: string;      // Description of the issue
  kind?: string;       // Type of offender (optional)
}
```

## 🎯 Best Practices

### 1. Keep Checks Focused
- Each check should validate ONE thing
- If a check grows beyond 200 lines, consider splitting it

### 2. Use Clear Messages
- Messages are shown as bullet points in the UI
- Start with action verbs: "clickTag detected", "Border missing"
- Include counts: "3 files missing references"

### 3. Provide Detailed Offenders
- Include file path, line number, and code snippet
- Limit detail strings to 200 characters
- Use `kind` field to categorize offender types

### 4. Handle Edge Cases
- Check for null/undefined values
- Handle empty files gracefully
- Catch and log errors appropriately

### 5. Document Your Code
- Add JSDoc comments explaining what the check does
- Document regex patterns with examples
- Explain severity logic

## 🔧 Utilities

Common utilities should be extracted to `utility/`:

```typescript
// utility/patterns.ts
export const CLICKTAG_VAR = /\b(?:window\.)?(clicktag|clickTag|clickTAG)\d*\b/i;

// utility/html.ts
export function parseHtml(text: string): Document {
  return new DOMParser().parseFromString(text, 'text/html');
}

// utility/css.ts
export function extractStyles(html: string): string[] {
  // Extract <style> blocks and external CSS
}
```

## 🧪 Testing Strategy

### Unit Tests
- Test each check in isolation
- Mock the CheckContext
- Cover edge cases and error conditions

### Integration Tests
- Test checks with real creative files
- Verify UI integration
- Test profile filtering

### Example Test
```typescript
import { clickTagCheck } from '../clickTag';

describe('clickTagCheck', () => {
  it('should detect clickTag variable', () => {
    const mockBundle = {
      files: {
        'index.html': new TextEncoder().encode('var clickTag = "http://example.com";')
      }
    };
    
    const context = {
      bundle: mockBundle,
      files: ['index.html'],
      // ... other required fields
    };
    
    const result = clickTagCheck.execute(context);
    
    expect(result.severity).toBe('PASS');
    expect(result.messages).toContain('clickTag detected');
    expect(result.messages).toContain('URL temporarily set to \'http://example.com\'');
  });
});
```

## 🚀 Migration from extendedChecks.ts

When migrating a check from the monolithic `extendedChecks.ts`:

1. **Extract the logic** - Copy the relevant code block
2. **Wrap in Check interface** - Add the standard structure
3. **Update variable references** - Use `context.bundle`, `context.files`, etc.
4. **Register the check** - Add to `ALL_CHECKS` in `index.ts`
5. **Test thoroughly** - Ensure the extracted check works identically
6. **Remove old code** - Only after the new check is proven to work

## 📖 Examples

See `cm360/clickTag.ts` for a complete example of a well-structured check.

## ❓ Questions?

For questions or suggestions about the check system:
1. Review existing checks for examples
2. Check the refactoring plan: `docs/REFACTORING_PLAN.md`
3. Open an issue with the `architecture` label
