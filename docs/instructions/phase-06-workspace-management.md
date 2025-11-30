# Phase 6: Workspace Management

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

---

### [x] Step 6.1: Implement Workspace State Management
**Task**: Create comprehensive state management for workspace (frames, viewport, etc.).

**Implementation**:
- Create `src/hooks/useWorkspace.ts`
- Manage viewport state
- Manage frames array
- Manage selected frame
- Provide functions for adding/removing/updating frames
- Persist state in localStorage (optional)

**Tests**:
- Test workspace state initialization
- Test frame addition
- Test frame removal
- Test frame update
- Test viewport state management
- Test selected frame management

**Commit**: `feat: implement comprehensive workspace state management`

---

### [x] Step 6.2: Implement Workspace Export
**Task**: Export workspace state to JSON file.

**Implementation**:
- Create `src/utils/exportImport.ts`
- Serialize workspace state to JSON
- Include viewport, frames, and all frame data
- Create downloadable JSON file
- Add "Export Workspace" button to toolbar

**Tests**:
- Test workspace serialization to JSON
- Test JSON structure is correct
- Test export includes all frame data
- Test export file is downloadable
- Test export with multiple frames

**Commit**: `feat: implement workspace export to JSON file`

---

### [x] Step 6.3: Implement Workspace Import
**Task**: Import workspace state from JSON file.

**Implementation**:
- Add file input for JSON selection
- Parse and validate JSON structure
- Restore workspace state from JSON
- Handle import errors gracefully
- Add "Import Workspace" button to toolbar
- Option to merge or replace existing workspace

**Tests**:
- Test JSON file parsing
- Test JSON structure validation
- Test workspace restoration from JSON
- Test import error handling
- Test import with invalid JSON
- Test merge vs replace options

**Commit**: `feat: implement workspace import from JSON file`

---

**Status**: ✅ **COMPLETE** - All steps completed

