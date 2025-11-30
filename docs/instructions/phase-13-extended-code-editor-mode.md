# Phase 13: Extended Code Editor Mode

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

**Note**: This phase adds an extended/wider mode for the code editor to provide more space for writing and viewing code.

---

### [x] Step 13.1: Design Extended Mode UI
**Task**: Design the UI for toggling extended code editor mode.

**Implementation**:
- Add a toggle button/icon in the code editor panel header
- Button should be clearly visible and accessible
- Consider using an expand/collapse icon (e.g., double arrow or maximize icon)
- Button should indicate current state (extended vs normal)
- Position button in a logical location (e.g., top-right of code panel header)
- Add tooltip/hint text explaining the feature

**Tests**:
- Verify button is visible and accessible
- Verify button state reflects current mode
- Verify tooltip displays correctly

**Commit**: `feat: add extended mode toggle button to code editor`

---

### [x] Step 13.2: Implement Extended Mode State Management
**Task**: Add state management for extended code editor mode.

**Implementation**:
- Add `isExtendedMode` state to `FrameEditorPanel` component
- State should be local to the component (not persisted)
- Add toggle function to switch between normal and extended modes
- Consider using `useState` hook for state management
- State should reset when switching frames (optional - could be per-frame preference)

**Tests**:
- Test state toggles correctly
- Test state persists during frame editing
- Test state resets appropriately (if implemented)

**Commit**: `feat: implement extended mode state management`

---

### [x] Step 13.3: Implement Extended Mode Layout
**Task**: Adjust layout when extended mode is active.

**Implementation**:
- When extended mode is active, increase width of `FrameEditorPanel`
- Consider making panel take up more of the screen (e.g., 60-70% instead of default)
- Ensure canvas remains visible and usable
- Add smooth transition animation when toggling modes
- Ensure responsive behavior on different screen sizes
- Consider adjusting panel position (e.g., move more to center/left)
- Maintain proper z-index and layering

**Tests**:
- Test extended mode increases panel width correctly
- Test canvas remains accessible and functional
- Test transitions are smooth
- Test responsive behavior on different screen sizes
- Verify no layout issues or overlapping elements

**Commit**: `feat: implement extended mode layout adjustments`

---

### [x] Step 13.4: Enhance Code Editor in Extended Mode
**Task**: Optimize code editor display for extended mode.

**Implementation**:
- Ensure code editor uses available space efficiently in extended mode
- Consider adjusting font size or line height for better readability
- Ensure syntax highlighting works correctly in wider view
- Maintain proper scrolling behavior
- Consider adding line wrapping option (optional)
- Ensure editor remains responsive and performant

**Tests**:
- Test code editor displays correctly in extended mode
- Test syntax highlighting works properly
- Test scrolling behavior is correct
- Test performance is acceptable with large code files
- Verify editor remains responsive

**Commit**: `feat: enhance code editor for extended mode`

---

### [x] Step 13.5: Add Keyboard Shortcut (Optional)
**Task**: Add keyboard shortcut to toggle extended mode.

**Implementation**:
- Add keyboard shortcut (e.g., `Ctrl+E` or `Cmd+E`) to toggle extended mode
- Ensure shortcut doesn't conflict with existing shortcuts
- Document shortcut in tooltip or help text
- Handle shortcut only when code editor is focused/active

**Tests**:
- Test keyboard shortcut toggles mode correctly
- Test shortcut doesn't conflict with other shortcuts
- Test shortcut works when editor is focused
- Verify shortcut is documented

**Commit**: `feat: add keyboard shortcut for extended mode toggle`

---

### [ ] Step 13.6: Add Extended Mode Persistence (Optional) - SKIPPED
**Task**: Persist extended mode preference per frame or globally.

**Status**: Skipped for now - will be implemented later if needed

**Implementation**:
- Store extended mode preference in frame data or global settings
- Preference could be per-frame or global (user choice)
- Use localStorage or frame metadata to persist preference
- Restore preference when frame is selected
- Consider adding option to set default preference

**Tests**:
- Test preference persists across page reloads
- Test preference restores correctly when frame is selected
- Test per-frame vs global preference (if both implemented)
- Verify preference doesn't interfere with other settings

**Commit**: `feat: persist extended mode preference`

---

**Status**: ⚠️ **PARTIAL** - Steps 13.1-13.5 completed, Step 13.6 skipped

