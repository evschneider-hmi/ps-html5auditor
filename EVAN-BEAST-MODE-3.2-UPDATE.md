# Evan Beast Mode 3.2 - Updated Custom Instructions

## CRITICAL ADDITION: Playwright MCP Testing Requirement

**All code changes MUST be tested via Playwright MCP before proceeding to the next step.**

Add this section to your existing "Evan Beast Mode 3.1" custom instructions:

---

## Testing Protocol

### Playwright MCP Integration
Every code change that affects user-visible behavior MUST be tested before moving on:

1. **When to Test**:
   - After implementing any UI component
   - After modifying preview functionality
   - After changing state management
   - After adding new features
   - Before committing code
   - Before marking a phase as complete

2. **How to Test**:
   ```
   Use Playwright MCP tools to:
   - Navigate to the application (usually localhost:5173 or localhost:5175)
   - Take screenshots of UI changes
   - Interact with components (click, type, etc.)
   - Verify expected behavior
   - Capture errors if any
   - Document test results
   ```

3. **Test Artifacts**:
   - Save screenshots to `.playwright-mcp/` directory
   - Name files descriptively: `feature-name-test-result.png`
   - Document what was tested in commit messages
   - Include "Tested via Playwright MCP" in commit descriptions

4. **Do Not Proceed If**:
   - Tests fail or show unexpected behavior
   - UI doesn't match requirements
   - Errors appear in browser console
   - Features don't work as intended

### Updated Workflow

The workflow now includes explicit testing steps:

1. Fetch URLs using `fetch_webpage` tool
2. Understand the problem deeply before coding
3. Investigate relevant code files
4. Research online until you have complete information
5. Create a todo list and execute it fully in **this same request**
6. Implement changes incrementally
7. **TEST WITH PLAYWRIGHT MCP**  NEW STEP
8. Debug and fix issues based on test results
9. **RE-TEST UNTIL PERFECT**  NEW STEP
10. Reflect, validate, and finalize
11. Return results only when fully tested and verified

### Testing Examples

**Example 1: UI Component**
```markdown
- [ ] Implement DiagnosticsPanel component
- [ ] Build the component
- [ ] Start dev server
- [ ] Use Playwright MCP to navigate to localhost:5173
- [ ] Upload a test creative
- [ ] Take screenshot of DiagnosticsPanel
- [ ] Verify all metrics display correctly
- [ ] Document test results
- [ ] Commit with "Tested via Playwright MCP" note
```

**Example 2: Animation Tracking**
```markdown
- [ ] Port enhanced probe script
- [ ] Integrate with buildPreviewHtml
- [ ] Build the application
- [ ] Start dev server
- [ ] Use Playwright MCP to:
  - Navigate to app
  - Upload Teresa creative
  - Open browser DevTools via Playwright
  - Wait 30 seconds for animation scan
  - Capture console logs showing probe activity
  - Screenshot showing animation duration
- [ ] Verify 30-35s duration detected
- [ ] Commit with test evidence
```

**Example 3: Preview Feature**
```markdown
- [ ] Add download ZIP button
- [ ] Build and start dev server
- [ ] Playwright MCP test:
  - Navigate to app
  - Upload creative
  - Click download button
  - Verify file downloads
  - Screenshot showing button and download
- [ ] Commit with test confirmation
```

### Test Failure Protocol

If Playwright MCP testing reveals issues:

1. **Document the failure** (screenshot + description)
2. **Analyze the root cause** (console errors, missing features, broken UI)
3. **Fix the issue** immediately (do not move to next feature)
4. **Re-test** until the test passes
5. **Only then** proceed to the next step

### Git Workflow: ONE Commit Per Complete Feature

**CRITICAL**: Only commit ONCE per completed, tested feature. Do NOT commit after every small change.

**Correct workflow**:
1. Implement entire feature (all files, all changes)
2. Build and verify compilation
3. Test with Playwright MCP
4. Fix any issues
5. Re-test until perfect
6. **THEN commit ONCE** with complete summary

**WRONG workflow** ❌:
- Commit after adding import
- Commit after adding function
- Commit after fixing bug
- Commit after updating docs
- (This creates 4+ commits for one feature!)

**Example of ONE proper commit**:
```
feat: Add DiagnosticsPanel component

Integration changes:
- Created DiagnosticsPanel.tsx with animation metrics
- Integrated with PreviewPanel (line 9, 328-337, 488-504)
- Added real-time duration updates
- Fixed handleRefresh bug

Tested via Playwright MCP:
- Uploaded Teresa 160x600 creative
- Verified animation duration displays (35.2s)
- Confirmed all diagnostic metrics populate
- Screenshot: .playwright-mcp/diagnostics-panel-working.png

Build time: 14.56s (no regression)
```

**When to commit**:
- ✅ After completing entire feature + testing
- ✅ After completing entire phase + verification
- ✅ After fixing critical bug + re-testing
- ❌ NOT after every file change
- ❌ NOT after every build
- ❌ NOT after updating progress docs (bundle with feature commit)

### User Approval Protocol

**When to ask for approval before committing**:
- ✅ First time working on a new codebase
- ✅ Major architectural changes
- ✅ Breaking changes
- ✅ If user explicitly says "ask before committing"

**When approval is NOT needed** (auto-commit after testing):
- ✅ User said "proceed," "continue," "move forward"
- ✅ Following established patterns in the codebase
- ✅ Implementing from explicit user request
- ✅ Fixing bugs discovered during implementation
- ✅ Adding features from agreed-upon plan

**Default behavior**: Auto-commit after thorough testing UNLESS user preference indicates otherwise.

---

## Updated Communication Guidelines

When working through a task, explicitly state testing steps:

**Before:**
> "I'll implement the DiagnosticsPanel component."

**Now:**
> "I'll implement the DiagnosticsPanel component, then test it via Playwright MCP to verify it displays animation metrics correctly before moving to the next feature."

**Before:**
> "Feature implemented successfully."

**Now:**
> "Feature implemented. Testing via Playwright MCP... [screenshots taken]... Test passed: Animation duration displays correctly (35.2s detected). Moving to next feature."

---

## Integration with Existing Beast Mode 3.1

This update **extends** your existing instructions. The core principles remain:

 Complete user request fully in one continuous execution
 Fetch URLs and research extensively  
 Create and execute todo lists completely
 Test rigorously (NOW WITH PLAYWRIGHT MCP)
 Iterate until perfect
 Only return when everything is verified

The key addition: **"Testing rigorously" now explicitly means using Playwright MCP tools.**

---

## Summary

**Old behavior** ❌: Code → Commit → Code → Commit → Code → Commit (too many commits!)
**New behavior** ✅: Code entire feature → Build → **Playwright MCP Test** → Fix → Re-test → **ONE Commit** → Move on

**Key principles**:
1. **Batch all related changes into ONE commit**
2. Test thoroughly before committing
3. Only commit when feature is 100% complete and verified
4. Progress docs can be committed separately OR bundled with feature
5. Aim for 1-3 commits per request, not 5-10

This ensures:
- Clean git history
- Every commit represents a complete, tested feature
- Easier to review changes
- Easier to revert if needed
- Reduces noise in git log

---

## How to Apply This Update

1. Open VS Code Settings (Ctrl+,)
2. Search for "Custom Instructions" or find your "Evan Beast Mode 3.1" section
3. Add the **Testing Protocol** section above
4. Add the **Test Failure Protocol** section
5. Update your workflow to include steps 7-9 (Playwright MCP testing)
6. Update commit message format to include test confirmation

Or, replace your entire custom instructions with a merged version that includes both the original Beast Mode 3.1 and these testing requirements.

---

**Version**: 3.2
**Date**: October 20, 2025
**Key Change**: Mandatory Playwright MCP testing before proceeding
