---
applyTo: '**'
---

# CRITICAL: No Commits Without Testing

**NEVER commit to GitHub before testing with Playwright MCP**

Every code change MUST be tested before committing:

## Testing Protocol

1. **Make code changes**
2. **Build the application**
3. **Start dev server** (if needed)
4. **Test with Playwright MCP**:
   - Navigate to the application
   - Test the specific feature you changed
   - Take screenshots of results
   - Verify expected behavior
   - Capture any errors
5. **Fix issues** if tests fail
6. **Re-test** until perfect
7. **ONLY THEN commit** with test evidence

## Commit Message Format

Always include testing evidence in commits:

```
feat: [Feature description]

Changes:
- [List of changes]

Tested via Playwright MCP:
- [What was tested]
- [Test results]
- Screenshot: [filename if applicable]

Build time: [time]
```

## When Testing is Required

- ✅ ANY user-visible change (UI, functionality, preview, etc.)
- ✅ ANY bug fix
- ✅ ANY new feature
- ✅ ANY change to preview/rendering logic
- ✅ ANY change to data processing
- ❌ NOT required: Documentation-only changes, comments, README updates

## Exception

Only skip Playwright testing for:
- Pure documentation files (.md files)
- Configuration changes that don't affect runtime
- Comment additions/changes in code

**Default behavior: TEST BEFORE COMMIT**