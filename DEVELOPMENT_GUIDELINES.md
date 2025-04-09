# FritSlides Development Guidelines

## File Path Conventions

To ensure consistency and prevent file editing errors, always use these relative paths when editing files:

- Frontend files: `./client/src/...`
- Backend files: `./server/...`
- Shared code: `./shared/...`

**IMPORTANT**: Never use absolute paths like `/repo/...` or `/home/runner/...` as they may point to incorrect locations.

## Verification Process

If unsure which file is being used by the running application:

1. Add a distinctive test string (like "TEST_STRING_XYZ") to the file
2. Check if the change appears in the running application
3. If not visible, you're editing the wrong file

## Time Display Standards

- Clock times must use HH:MM format with colon (e.g., "14:30")
- Average time per slide should be displayed as "(MM:SS/slide)"
- Time inputs should have clear placeholders that indicate format

## Common Issues

- Multiple versions of files may exist in different locations
- The running application may be using different files than what appears in the file system
- Always verify changes are visible in the application before proceeding with substantial edits
