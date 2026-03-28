# Code Duplication Report (src only)

- Scan date: 2026-03-28T06:39:35.534Z
- Scope: `src/**` only
- Explicitly excluded: `node_modules`, `out`, and everything outside `src`
- Duplication threshold: `3+` consecutive lines accomplishing the same logical task
- Detection command: `npx --yes jscpd --min-lines 3 --min-tokens 20 --reporters json --output .tmp-jscpd-report src`
- Raw duplication blocks (jscpd): **432**
- Files with at least one duplication block: **126**

## Most Duplicated Files (by match count)

1. src/__tests__/database.test.ts — 21 matches
2. src/views/pageIcon.ts — 20 matches
3. src/hostEditor/HostingEditor.ts — 18 matches
4. src/navigation/turnInto.ts — 18 matches
5. src/blocks/lockBlock.ts — 17 matches
6. src/links/openLink.ts — 15 matches
7. src/media/image.ts — 14 matches
8. src/media/resource.ts — 14 matches
9. src/navigation/page.ts — 14 matches
10. src/navigation/renamePage.ts — 14 matches
11. src/productivity/bookmarks.ts — 14 matches
12. src/editor/processor.ts — 13 matches
13. src/lists/listModel.ts — 13 matches
14. src/media/gif/gifCommand.ts — 13 matches
15. src/navigation/headingNav.ts — 12 matches
16. src/navigation/tagIndex.ts — 12 matches
17. src/webview/apps/dbApp.css — 12 matches
18. src/blocks/moveBlock.ts — 11 matches
19. src/productivity/fireInto.ts — 11 matches
20. src/views/wordCount.ts — 11 matches
21. src/editor/focusMode.ts — 10 matches
22. src/navigation/movePage.ts — 10 matches
23. src/blocks/selectBlock.ts — 9 matches
24. src/formatting/smartTypography.ts — 9 matches
25. src/media/graph.ts — 9 matches
26. src/media/pdfExport.ts — 9 matches
27. src/blocks/blockSwap.ts — 8 matches
28. src/database/dbFrontmatter.ts — 8 matches
29. src/editor/editorDecorations.ts — 8 matches
30. src/media/imageDrop.ts — 8 matches

## Duplication By File

### src/__tests__/aesthetics.test.ts (2 matches)

- [false alarm] Lines 11-20 duplicate 10 lines with `src/views/outline.ts` (lines 40-48), format: typescript
- [false alarm] Lines 52-65 duplicate 14 lines with `src/navigation/breadcrumb.ts` (lines 61-73), format: typescript

### src/__tests__/database.test.ts (21 matches)

- [false alarm] Lines 46-50 duplicate 5 lines with `src/__tests__/database.test.ts` (lines 26-30), format: typescript
- [false alarm] Lines 72-78 duplicate 7 lines with `src/__tests__/database.test.ts` (lines 31-45), format: typescript
- [false alarm] Lines 97-102 duplicate 6 lines with `src/__tests__/database.test.ts` (lines 26-80), format: typescript
- [false alarm] Lines 181-184 duplicate 4 lines with `src/__tests__/database.test.ts` (lines 157-160), format: typescript
- [false alarm] Lines 181-184 duplicate 4 lines with `src/__tests__/database.test.ts` (lines 173-176), format: typescript
- [false alarm] Lines 198-203 duplicate 6 lines with `src/__tests__/database.test.ts` (lines 171-176), format: typescript
- [false alarm] Lines 200-204 duplicate 5 lines with `src/__tests__/database.test.ts` (lines 157-161), format: typescript
- [false alarm] Lines 216-221 duplicate 6 lines with `src/__tests__/database.test.ts` (lines 171-176), format: typescript
- [false alarm] Lines 231-236 duplicate 6 lines with `src/__tests__/database.test.ts` (lines 160-171), format: typescript
- [false alarm] Lines 247-253 duplicate 7 lines with `src/__tests__/database.test.ts` (lines 161-171), format: typescript
- [false alarm] Lines 254-258 duplicate 5 lines with `src/__tests__/database.test.ts` (lines 183-187), format: typescript
- [false alarm] Lines 259-262 duplicate 4 lines with `src/__tests__/database.test.ts` (lines 157-176), format: typescript
- [false alarm] Lines 297-301 duplicate 5 lines with `src/__tests__/database.test.ts` (lines 285-289), format: typescript
- [false alarm] Lines 338-343 duplicate 6 lines with `src/__tests__/database.test.ts` (lines 284-289), format: typescript
- [false alarm] Lines 351-356 duplicate 6 lines with `src/__tests__/database.test.ts` (lines 284-289), format: typescript
- [false alarm] Lines 369-375 duplicate 7 lines with `src/__tests__/database.test.ts` (lines 317-323), format: typescript
- [false alarm] Lines 388-393 duplicate 6 lines with `src/__tests__/database.test.ts` (lines 284-289), format: typescript
- [false alarm] Lines 408-416 duplicate 9 lines with `src/__tests__/database.test.ts` (lines 368-376), format: typescript
- [false alarm] Lines 428-433 duplicate 6 lines with `src/__tests__/database.test.ts` (lines 284-289), format: typescript
- [false alarm] Lines 472-475 duplicate 4 lines with `src/__tests__/database.test.ts` (lines 465-468), format: typescript
- [false alarm] Lines 479-482 duplicate 4 lines with `src/__tests__/database.test.ts` (lines 465-468), format: typescript

### src/__tests__/editorDecorations.test.ts (4 matches)

- [false alarm] Lines 49-53 duplicate 5 lines with `src/__tests__/editorDecorations.test.ts` (lines 36-40), format: typescript
- [false alarm] Lines 78-82 duplicate 5 lines with `src/__tests__/editorDecorations.test.ts` (lines 72-76), format: typescript
- [false alarm] Lines 83-86 duplicate 4 lines with `src/__tests__/editorDecorations.test.ts` (lines 72-76), format: typescript
- [false alarm] Lines 123-127 duplicate 5 lines with `src/editor/editorDecorations.ts` (lines 115-120), format: typescript

### src/__tests__/frontmatterEditor.test.ts (3 matches)

- [false alarm] Lines 25-28 duplicate 4 lines with `src/__tests__/frontmatterEditor.test.ts` (lines 15-18), format: typescript
- [false alarm] Lines 32-35 duplicate 4 lines with `src/__tests__/frontmatterEditor.test.ts` (lines 15-28), format: typescript
- [false alarm] Lines 39-42 duplicate 4 lines with `src/__tests__/frontmatterEditor.test.ts` (lines 15-35), format: typescript

### src/blocks/blockSwap.ts (8 matches)

- [false alarm] Lines 2-9 duplicate 8 lines with `src/blocks/selectBlock.ts` (lines 2-6), format: typescript
- [false alarm] Lines 15-18 duplicate 4 lines with `src/editor/focusMode.ts` (lines 151-155), format: typescript
- [false alarm] Lines 19-22 duplicate 4 lines with `src/editor/focusMode.ts` (lines 156-160), format: typescript
- [false alarm] Lines 25-30 duplicate 6 lines with `src/views/pageIcon.ts` (lines 18-31), format: typescript
- [false alarm] Lines 27-31 duplicate 5 lines with `src/editor/focusMode.ts` (lines 102-107), format: typescript
- [false alarm] Lines 83-89 duplicate 7 lines with `src/blocks/blockSwap.ts` (lines 43-49), format: typescript
- [false alarm] Lines 93-98 duplicate 6 lines with `src/blocks/blockSwap.ts` (lines 54-59), format: typescript
- [false alarm] Lines 106-110 duplicate 5 lines with `src/blocks/blockSwap.ts` (lines 68-71), format: typescript

### src/blocks/duplicateBlock.ts (7 matches)

- [false alarm] Lines 2-5 duplicate 4 lines with `src/blocks/selectBlock.ts` (lines 2-5), format: typescript
- [false alarm] Lines 18-24 duplicate 7 lines with `src/views/pageIcon.ts` (lines 18-31), format: typescript
- [false alarm] Lines 68-74 duplicate 7 lines with `src/blocks/moveBlock.ts` (lines 137-143), format: typescript
- [false alarm] Lines 77-84 duplicate 8 lines with `src/blocks/moveBlock.ts` (lines 146-153), format: typescript
- [false alarm] Lines 85-92 duplicate 8 lines with `src/blocks/moveBlock.ts` (lines 154-161), format: typescript
- [false alarm] Lines 96-99 duplicate 4 lines with `src/blocks/moveBlock.ts` (lines 165-168), format: typescript
- [false alarm] Lines 99-104 duplicate 6 lines with `src/blocks/moveBlock.ts` (lines 168-173), format: typescript

### src/blocks/lockBlock.ts (17 matches)

- [false alarm] Lines 4-9 duplicate 6 lines with `src/media/pdfExport.ts` (lines 4-9), format: typescript
- [false alarm] Lines 77-80 duplicate 4 lines with `src/editor/date/dateCodeLens.ts` (lines 24-98), format: typescript
- [false alarm] Lines 105-111 duplicate 7 lines with `src/editor/date/dateCodeLens.ts` (lines 24-83), format: typescript
- [false alarm] Lines 111-115 duplicate 5 lines with `src/blocks/lockBlock.ts` (lines 84-88), format: typescript
- [false alarm] Lines 231-236 duplicate 6 lines with `src/blocks/lockBlock.ts` (lines 164-169), format: typescript
- [false alarm] Lines 371-377 duplicate 7 lines with `src/blocks/lockBlock.ts` (lines 363-369), format: typescript
- [false alarm] Lines 415-418 duplicate 4 lines with `src/blocks/lockBlock.ts` (lines 396-399), format: typescript
- [false alarm] Lines 453-458 duplicate 6 lines with `src/links/openLink.ts` (lines 36-40), format: typescript
- [false alarm] Lines 519-526 duplicate 8 lines with `src/links/openLink.ts` (lines 40-460), format: typescript
- [false alarm] Lines 543-555 duplicate 13 lines with `src/blocks/lockBlock.ts` (lines 485-496), format: typescript
- [false alarm] Lines 567-571 duplicate 5 lines with `src/blocks/lockBlock.ts` (lines 507-511), format: typescript
- [false alarm] Lines 583-588 duplicate 6 lines with `src/links/openLink.ts` (lines 36-40), format: typescript
- [false alarm] Lines 601-605 duplicate 5 lines with `src/media/carousel.ts` (lines 129-133), format: typescript
- [false alarm] Lines 648-655 duplicate 8 lines with `src/editor/comments/commentCommands.ts` (lines 42-632), format: typescript
- [false alarm] Lines 687-690 duplicate 4 lines with `src/blocks/lockBlock.ts` (lines 502-505), format: typescript
- [false alarm] Lines 688-694 duplicate 7 lines with `src/blocks/lockBlock.ts` (lines 506-571), format: typescript

### src/blocks/moveBlock.ts (11 matches)

- [false alarm] Lines 7-13 duplicate 7 lines with `src/navigation/turnInto.ts` (lines 8-14), format: typescript
- [false alarm] Lines 41-46 duplicate 6 lines with `src/links/openLink.ts` (lines 36-40), format: typescript
- [false alarm] Lines 42-52 duplicate 11 lines with `src/media/gif/gifCommand.ts` (lines 169-179), format: typescript
- [false alarm] Lines 137-143 duplicate 7 lines with `src/blocks/duplicateBlock.ts` (lines 68-74), format: typescript
- [false alarm] Lines 146-153 duplicate 8 lines with `src/blocks/duplicateBlock.ts` (lines 77-84), format: typescript
- [false alarm] Lines 154-161 duplicate 8 lines with `src/blocks/duplicateBlock.ts` (lines 85-92), format: typescript
- [false alarm] Lines 154-158 duplicate 5 lines with `src/navigation/extractSubpage.ts` (lines 140-144), format: typescript
- [false alarm] Lines 165-168 duplicate 4 lines with `src/blocks/duplicateBlock.ts` (lines 96-99), format: typescript
- [false alarm] Lines 168-173 duplicate 6 lines with `src/blocks/duplicateBlock.ts` (lines 99-104), format: typescript
- [false alarm] Lines 246-252 duplicate 7 lines with `src/productivity/fireInto.ts` (lines 51-65), format: typescript

### src/blocks/selectBlock.ts (9 matches)

- [false alarm] Lines 2-6 duplicate 8 lines with `src/blocks/blockSwap.ts` (lines 2-9), format: typescript
- [false alarm] Lines 2-5 duplicate 4 lines with `src/blocks/duplicateBlock.ts` (lines 2-5), format: typescript
- [false alarm] Lines 12-17 duplicate 6 lines with `src/navigation/extractSubpage.ts` (lines 17-22), format: typescript
- [false alarm] Lines 40-46 duplicate 7 lines with `src/editor/focusMode.ts` (lines 150-156), format: typescript
- [false alarm] Lines 46-53 duplicate 8 lines with `src/editor/focusMode.ts` (lines 156-163), format: typescript
- [false alarm] Lines 86-97 duplicate 12 lines with `src/editor/focusMode.ts` (lines 165-176), format: typescript
- [false alarm] Lines 97-100 duplicate 4 lines with `src/editor/focusMode.ts` (lines 168-177), format: typescript
- [false alarm] Lines 108-116 duplicate 9 lines with `src/editor/focusMode.ts` (lines 191-199), format: typescript
- [false alarm] Lines 116-121 duplicate 6 lines with `src/editor/focusMode.ts` (lines 204-209), format: typescript

### src/communicators/extensionToPanelCommunicator.ts (3 matches)

- [fixed] Lines 8-14 duplicate 7 lines with `src/webview/communicators/PanelToExtensionCommunicator.ts` (lines 11-17), format: typescript
- [fixed] Lines 17-26 duplicate 10 lines with `src/webview/communicators/PanelToExtensionCommunicator.ts` (lines 21-30), format: typescript
- [fixed] Lines 26-36 duplicate 11 lines with `src/webview/communicators/PanelToExtensionCommunicator.ts` (lines 31-41), format: typescript

### src/contracts/communicator.ts (1 matches)

- [fixed] Lines 22-25 duplicate 4 lines with `src/webview/communicators/PanelToExtensionCommunicator.ts` (lines 35-38), format: typescript

### src/contracts/databaseTypes.ts (1 matches)

- [fixed] Lines 66-70 duplicate 5 lines with `src/contracts/messages/dbPanelMessages.ts` (lines 50-54), format: typescript

### src/contracts/messages/dbPanelMessages.ts (1 matches)

- [fixed] Lines 50-54 duplicate 5 lines with `src/contracts/databaseTypes.ts` (lines 66-70), format: typescript

### src/core/fileHashTracker.ts (1 matches)

- Lines 41-45 duplicate 5 lines with `src/core/fileHashTracker.ts` (lines 35-41), format: typescript

### src/core/simpleCommands.ts (1 matches)

- Lines 4-7 duplicate 4 lines with `src/links/openLink.ts` (lines 2-5), format: typescript

### src/core/slashCommands.ts (1 matches)

- Lines 78-83 duplicate 6 lines with `src/links/openLink.ts` (lines 25-40), format: typescript

### src/core/structureLint.ts (1 matches)

- Lines 32-36 duplicate 5 lines with `src/editor/toc.ts` (lines 30-92), format: typescript

### src/core/trailingNewline.ts (3 matches)

- Lines 10-14 duplicate 5 lines with `src/formatting/smartTypography.ts` (lines 19-38), format: typescript
- Lines 11-14 duplicate 4 lines with `src/lists/listRenumber.ts` (lines 18-21), format: typescript
- Lines 19-22 duplicate 4 lines with `src/editor/footnote.ts` (lines 48-50), format: typescript

### src/core/webviewShell.ts (1 matches)

- Lines 35-43 duplicate 9 lines with `src/media/pdfExport.ts` (lines 143-153), format: typescript

### src/database/dbCodeLens.ts (3 matches)

- Lines 2-6 duplicate 5 lines with `src/links/linkHover.ts` (lines 2-6), format: typescript
- Lines 6-11 duplicate 6 lines with `src/media/graph.ts` (lines 8-12), format: typescript
- Lines 55-61 duplicate 7 lines with `src/database/dbCodeLens.ts` (lines 45-51), format: typescript

### src/database/dbFrontmatter.ts (8 matches)

- [fixed] Lines 175-178 duplicate 4 lines with `src/database/dbFrontmatter.ts` (lines 104-108), format: typescript
- [fixed] Lines 188-191 duplicate 4 lines with `src/database/dbFrontmatter.ts` (lines 121-124), format: typescript
- [fixed] Lines 197-205 duplicate 9 lines with `src/database/dbFrontmatter.ts` (lines 174-182), format: typescript
- [fixed] Lines 207-219 duplicate 13 lines with `src/database/dbFrontmatter.ts` (lines 184-196), format: typescript
- [fixed] Lines 225-231 duplicate 7 lines with `src/database/dbFrontmatter.ts` (lines 175-181), format: typescript
- [fixed] Lines 249-258 duplicate 10 lines with `src/database/dbFrontmatter.ts` (lines 121-196), format: typescript
- [fixed] Lines 259-266 duplicate 8 lines with `src/database/dbFrontmatter.ts` (lines 174-181), format: typescript
- [fixed] Lines 277-283 duplicate 7 lines with `src/database/dbFrontmatter.ts` (lines 192-247), format: typescript

### dbCommands.ts has a lot of duplication, check manually.


### src/database/dbSchema.ts (3 matches)

- [fixed] Lines 69-74 duplicate 6 lines with `src/database/dbViews.ts` (lines 31-36), format: typescript
- [fixed] Lines 81-86 duplicate 6 lines with `src/database/dbViews.ts` (lines 37-42), format: typescript
- [fixed] Lines 119-123 duplicate 5 lines with `src/database/dbSchema.ts` (lines 86-89), format: typescript

### src/database/dbViews.ts (3 matches)

- [fixed] Lines 31-36 duplicate 6 lines with `src/database/dbSchema.ts` (lines 69-74), format: typescript
- [fixed] Lines 37-42 duplicate 6 lines with `src/database/dbSchema.ts` (lines 81-86), format: typescript
- [fixed] Lines 124-131 duplicate 8 lines with `src/database/dbViews.ts` (lines 42-48), format: typescript

### src/database/dbWebview.ts (3 matches)

- [fixed] Lines 88-92 duplicate 5 lines with `src/database/dbWebview.ts` (lines 74-78), format: typescript
- [fixed] Lines 208-212 duplicate 5 lines with `src/database/dbWebview.ts` (lines 183-187), format: typescript
- Lines 255-259 duplicate 5 lines with `src/links/linkHover.ts` (lines 22-25), format: typescript

### src/editor/callout.ts (4 matches)

- Lines 2-8 duplicate 7 lines with `src/editor/codeBlock.ts` (lines 2-8), format: typescript
- Lines 60-66 duplicate 7 lines with `src/media/resource.ts` (lines 60-211), format: typescript
- Lines 76-85 duplicate 10 lines with `src/editor/callout.ts` (lines 59-68), format: typescript
- Lines 111-125 duplicate 15 lines with `src/editor/emoji.ts` (lines 68-101), format: typescript

### src/editor/codeBlock.ts (3 matches)

- Lines 2-8 duplicate 7 lines with `src/editor/callout.ts` (lines 2-8), format: typescript
- Lines 2-6 duplicate 5 lines with `src/editor/snippetExpander.ts` (lines 1-6), format: typescript
- Lines 52-60 duplicate 9 lines with `src/editor/emoji.ts` (lines 64-105), format: typescript

### src/editor/codeContext.ts (2 matches)

- Lines 28-31 duplicate 4 lines with `src/formatting/smartTypography.ts` (lines 69-72), format: typescript

### src/editor/comments/commentCommands.ts (3 matches)

- Lines 30-40 duplicate 8 lines with `src/editor/processor.ts` (lines 248-255), format: typescript
- Lines 42-632 duplicate 8 lines with `src/blocks/lockBlock.ts` (lines 648-655), format: typescript

### src/editor/comments/commentModel.ts (6 matches)

- Lines 24-27 duplicate 4 lines with `src/editor/processor.ts` (lines 57-60), format: typescript
- Lines 31-42 duplicate 12 lines with `src/editor/processor.ts` (lines 64-75), format: typescript
- Lines 32-42 duplicate 11 lines with `src/productivity/bookmarks.ts` (lines 34-44), format: typescript
- Lines 43-48 duplicate 6 lines with `src/editor/processor.ts` (lines 76-81), format: typescript
- Lines 44-48 duplicate 5 lines with `src/productivity/bookmarks.ts` (lines 49-53), format: typescript
- Lines 66-71 duplicate 6 lines with `src/navigation/renamePage.ts` (lines 135-140), format: typescript

### src/editor/comments/commentPanel.ts (5 matches)

- Lines 6-11 duplicate 6 lines with `src/editor/date/datePanel.ts` (lines 6-11), format: typescript
- Lines 103-107 duplicate 5 lines with `src/navigation/headingNav.ts` (lines 99-103), format: typescript
- Lines 104-107 duplicate 4 lines with `src/editor/footnote.ts` (lines 62-65), format: typescript
- Lines 104-108 duplicate 5 lines with `src/navigation/wikiSearch.ts` (lines 100-104), format: typescript
- Lines 104-107 duplicate 4 lines with `src/views/outline.ts` (lines 155-158), format: typescript

### src/editor/copyCode.ts (3 matches)

- Lines 4-7 duplicate 4 lines with `src/editor/template.ts` (lines 2-5), format: typescript
- Lines 5-9 duplicate 9 lines with `src/editor/codeContext.ts` (lines 1-9), format: typescript
- Lines 20-25 duplicate 6 lines with `src/links/openLink.ts` (lines 32-40), format: typescript

### src/editor/date/dateCodeLens.ts (5 matches)

- Lines 23-27 duplicate 5 lines with `src/editor/processor.ts` (lines 556-560), format: typescript
- Lines 23-27 duplicate 5 lines with `src/media/graph.ts` (lines 178-182), format: typescript
- Lines 24-98 duplicate 4 lines with `src/blocks/lockBlock.ts` (lines 77-80), format: typescript
- Lines 24-83 duplicate 7 lines with `src/blocks/lockBlock.ts` (lines 105-111), format: typescript
- Lines 63-67 duplicate 5 lines with `src/editor/date/dateCodeLens.ts` (lines 54-58), format: typescript

### src/editor/date/dateCommands.ts (1 matches)


### src/editor/date/dateFormat.ts (1 matches)

- [fixed] Lines 4-19 duplicate 16 lines with `src/webview/utils/calendarUtils.ts` (lines 34-48), format: typescript

### src/editor/date/datePanel.ts (3 matches)

- Lines 6-11 duplicate 6 lines with `src/editor/comments/commentPanel.ts` (lines 6-11), format: typescript
- Lines 101-106 duplicate 6 lines with `src/editor/date/datePanel.ts` (lines 76-81), format: typescript
- Lines 106-109 duplicate 4 lines with `src/editor/date/datePanel.ts` (lines 81-84), format: typescript

### src/editor/dictate.ts (4 matches)

- Lines 3-9 duplicate 7 lines with `src/productivity/bookmarks.ts` (lines 2-8), format: typescript
- Lines 37-61 duplicate 25 lines with `src/media/clipboard.ts` (lines 24-48), format: typescript
- Lines 281-287 duplicate 7 lines with `src/editor/dictate.ts` (lines 255-264), format: typescript
- Lines 287-290 duplicate 4 lines with `src/editor/dictate.ts` (lines 265-268), format: typescript

### src/editor/editorDecorations.ts (8 matches)

- Lines 99-105 duplicate 7 lines with `src/formatting/headingColors.ts` (lines 18-46), format: typescript
- Lines 115-120 duplicate 5 lines with `src/__tests__/editorDecorations.test.ts` (lines 123-127), format: typescript
- Lines 118-123 duplicate 6 lines with `src/links/backlinks.ts` (lines 68-97), format: typescript
- Lines 134-137 duplicate 4 lines with `src/editor/editorDecorations.ts` (lines 127-130), format: typescript
- Lines 142-148 duplicate 7 lines with `src/editor/editorDecorations.ts` (lines 127-139), format: typescript
- Lines 160-165 duplicate 6 lines with `src/editor/editorDecorations.ts` (lines 152-159), format: typescript
- Lines 192-199 duplicate 8 lines with `src/formatting/headingColors.ts` (lines 47-83), format: typescript

### src/editor/emoji.ts (5 matches)

- Lines 4-9 duplicate 6 lines with `src/media/pdfExport.ts` (lines 4-9), format: typescript
- Lines 64-105 duplicate 9 lines with `src/editor/codeBlock.ts` (lines 52-60), format: typescript
- Lines 68-101 duplicate 15 lines with `src/editor/callout.ts` (lines 111-125), format: typescript
- Lines 91-103 duplicate 13 lines with `src/media/gif/gifCommand.ts` (lines 142-154), format: typescript
- Lines 107-112 duplicate 6 lines with `src/media/resource.ts` (lines 60-211), format: typescript

### src/editor/focusMode.ts (10 matches)

- Lines 102-107 duplicate 5 lines with `src/blocks/blockSwap.ts` (lines 27-31), format: typescript
- Lines 150-156 duplicate 7 lines with `src/blocks/selectBlock.ts` (lines 40-46), format: typescript
- Lines 151-155 duplicate 4 lines with `src/blocks/blockSwap.ts` (lines 15-18), format: typescript
- Lines 156-160 duplicate 4 lines with `src/blocks/blockSwap.ts` (lines 19-22), format: typescript
- Lines 156-163 duplicate 8 lines with `src/blocks/selectBlock.ts` (lines 46-53), format: typescript
- Lines 165-176 duplicate 12 lines with `src/blocks/selectBlock.ts` (lines 86-97), format: typescript
- Lines 168-177 duplicate 4 lines with `src/blocks/selectBlock.ts` (lines 97-100), format: typescript
- Lines 179-184 duplicate 6 lines with `src/views/outline.ts` (lines 143-147), format: typescript
- Lines 191-199 duplicate 9 lines with `src/blocks/selectBlock.ts` (lines 108-116), format: typescript
- Lines 204-209 duplicate 6 lines with `src/blocks/selectBlock.ts` (lines 116-121), format: typescript

### src/editor/footnote.ts (3 matches)

- Lines 2-9 duplicate 8 lines with `src/productivity/gitCommit.ts` (lines 1-9), format: typescript
- Lines 48-50 duplicate 4 lines with `src/core/trailingNewline.ts` (lines 19-22), format: typescript
- Lines 62-65 duplicate 4 lines with `src/editor/comments/commentPanel.ts` (lines 104-107), format: typescript

### src/editor/frontmatterEditor.ts (2 matches)

- Lines 3-12 duplicate 10 lines with `src/views/pageIcon.ts` (lines 2-10), format: typescript
- Lines 46-52 duplicate 7 lines with `src/views/pageIcon.ts` (lines 31-48), format: typescript

### src/editor/processor.ts (13 matches)

- Lines 57-60 duplicate 4 lines with `src/editor/comments/commentModel.ts` (lines 24-27), format: typescript
- Lines 64-75 duplicate 12 lines with `src/editor/comments/commentModel.ts` (lines 31-42), format: typescript
- Lines 76-81 duplicate 6 lines with `src/editor/comments/commentModel.ts` (lines 43-48), format: typescript
- Lines 94-100 duplicate 7 lines with `src/media/clipboard.ts` (lines 29-35), format: typescript
- Lines 100-113 duplicate 14 lines with `src/media/clipboard.ts` (lines 35-48), format: typescript
- Lines 208-211 duplicate 4 lines with `src/productivity/gitCommit.ts` (lines 104-107), format: typescript
- Lines 248-255 duplicate 8 lines with `src/editor/comments/commentCommands.ts` (lines 30-40), format: typescript
- Lines 371-377 duplicate 7 lines with `src/editor/processor.ts` (lines 364-370), format: typescript
- Lines 424-428 duplicate 5 lines with `src/media/graph.ts` (lines 116-121), format: typescript
- Lines 489-494 duplicate 6 lines with `src/editor/processor.ts` (lines 432-436), format: typescript
- Lines 556-560 duplicate 5 lines with `src/editor/date/dateCodeLens.ts` (lines 23-27), format: typescript
- Lines 570-573 duplicate 4 lines with `src/editor/processor.ts` (lines 567-570), format: typescript

### src/editor/smartPaste.ts (7 matches)

- Lines 2-7 duplicate 6 lines with `src/productivity/dailyNote.ts` (lines 1-8), format: typescript
- Lines 69-74 duplicate 6 lines with `src/editor/smartPaste.ts` (lines 43-48), format: typescript
- Lines 82-86 duplicate 5 lines with `src/editor/smartPaste.ts` (lines 56-60), format: typescript
- Lines 114-121 duplicate 8 lines with `src/media/resource.ts` (lines 40-187), format: typescript
- Lines 124-141 duplicate 18 lines with `src/media/image.ts` (lines 54-177), format: typescript
- Lines 173-179 duplicate 7 lines with `src/media/pdfExport.ts` (lines 145-153), format: typescript
- Lines 190-201 duplicate 12 lines with `src/productivity/fireInto.ts` (lines 51-68), format: typescript

### src/editor/snippetExpander.ts (4 matches)

- Lines 1-29 duplicate 29 lines with `src/productivity/gitCommit.ts` (lines 1-18), format: typescript
- Lines 39-44 duplicate 6 lines with `src/navigation/headingNav.ts` (lines 13-18), format: typescript

### src/editor/tableAlignOnSave.ts (1 matches)

- Lines 11-18 duplicate 8 lines with `src/lists/listRenumber.ts` (lines 15-21), format: typescript

### src/editor/template.ts (1 matches)

- Lines 2-5 duplicate 4 lines with `src/editor/copyCode.ts` (lines 4-7), format: typescript

### src/editor/toc.ts (6 matches)

- Lines 27-30 duplicate 4 lines with `src/media/graph.ts` (lines 179-183), format: typescript
- Lines 30-92 duplicate 5 lines with `src/core/structureLint.ts` (lines 32-36), format: typescript
- Lines 42-45 duplicate 4 lines with `src/navigation/headingNav.ts` (lines 72-75), format: typescript
- Lines 70-77 duplicate 8 lines with `src/media/resource.ts` (lines 58-211), format: typescript
- Lines 83-90 duplicate 8 lines with `src/lists/listRenumber.ts` (lines 15-21), format: typescript

### src/formatting/headingColors.ts (7 matches)

- Lines 1-14 duplicate 14 lines with `src/navigation/headingAnchor.ts` (lines 1-5), format: typescript
- Lines 18-46 duplicate 7 lines with `src/editor/editorDecorations.ts` (lines 99-105), format: typescript
- Lines 46-52 duplicate 7 lines with `src/navigation/headingAnchor.ts` (lines 18-21), format: typescript
- Lines 47-83 duplicate 8 lines with `src/editor/editorDecorations.ts` (lines 192-199), format: typescript
- Lines 53-58 duplicate 6 lines with `src/links/backlinkCodeLens.ts` (lines 103-107), format: typescript
- Lines 84-90 duplicate 7 lines with `src/views/readingProgress.ts` (lines 41-47), format: typescript

### src/formatting/headingLevel.ts (3 matches)

- Lines 2-6 duplicate 5 lines with `src/lists/listToggle.ts` (lines 2-6), format: typescript
- Lines 14-29 duplicate 16 lines with `src/views/pageIcon.ts` (lines 31-35), format: typescript
- Lines 39-55 duplicate 17 lines with `src/views/pageIcon.ts` (lines 30-31), format: typescript

### src/formatting/smartPairs.ts (3 matches)

- Lines 33-38 duplicate 6 lines with `src/formatting/smartTypography.ts` (lines 18-23), format: typescript
- Lines 35-42 duplicate 8 lines with `src/formatting/smartTypography.ts` (lines 27-34), format: typescript
- Lines 45-49 duplicate 5 lines with `src/formatting/smartTypography.ts` (lines 106-149), format: typescript

### src/formatting/smartTypography.ts (9 matches)

- Lines 18-23 duplicate 6 lines with `src/formatting/smartPairs.ts` (lines 33-38), format: typescript
- Lines 19-38 duplicate 5 lines with `src/core/trailingNewline.ts` (lines 10-14), format: typescript
- Lines 27-34 duplicate 8 lines with `src/formatting/smartPairs.ts` (lines 35-42), format: typescript
- Lines 69-72 duplicate 4 lines with `src/editor/codeContext.ts` (lines 28-31), format: typescript
- Lines 104-110 duplicate 7 lines with `src/formatting/smartTypography.ts` (lines 78-84), format: typescript
- Lines 106-149 duplicate 5 lines with `src/formatting/smartPairs.ts` (lines 45-49), format: typescript
- Lines 124-132 duplicate 9 lines with `src/formatting/smartTypography.ts` (lines 74-111), format: typescript
- Lines 135-140 duplicate 6 lines with `src/formatting/smartTypography.ts` (lines 119-124), format: typescript
- Lines 180-183 duplicate 4 lines with `src/formatting/smartTypography.ts` (lines 98-101), format: typescript

### src/formatting/wrapWith.ts (1 matches)

- Lines 35-42 duplicate 8 lines with `src/views/pageIcon.ts` (lines 18-31), format: typescript

### src/hostEditor/HostingEditor.ts (18 matches)

- [false alarm] Lines 153-159 duplicate 7 lines with `src/hostEditor/HostingEditor.ts` (lines 142-148), format: typescript
- [false alarm] Lines 164-170 duplicate 7 lines with `src/hostEditor/HostingEditor.ts` (lines 142-148), format: typescript
- [false alarm] Lines 179-184 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 143-148), format: typescript
- [false alarm] Lines 191-197 duplicate 7 lines with `src/hostEditor/HostingEditor.ts` (lines 159-164), format: typescript
- [false alarm] Lines 202-212 duplicate 11 lines with `src/hostEditor/HostingEditor.ts` (lines 175-185), format: typescript
- [false alarm] Lines 218-224 duplicate 7 lines with `src/hostEditor/HostingEditor.ts` (lines 142-148), format: typescript
- [false alarm] Lines 230-238 duplicate 9 lines with `src/hostEditor/HostingEditor.ts` (lines 176-184), format: typescript
- [false alarm] Lines 246-254 duplicate 9 lines with `src/hostEditor/HostingEditor.ts` (lines 176-184), format: typescript
- [false alarm] Lines 271-276 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 147-218), format: typescript
- [false alarm] Lines 310-315 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 142-147), format: typescript
- [false alarm] Lines 426-431 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 417-422), format: typescript
- [false alarm] Lines 444-449 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 280-285), format: typescript
- [false alarm] Lines 453-458 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 280-285), format: typescript
- [false alarm] Lines 471-476 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 417-422), format: typescript
- [false alarm] Lines 480-485 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 417-476), format: typescript
- [false alarm] Lines 498-503 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 289-294), format: typescript
- [false alarm] Lines 507-512 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 285-453), format: typescript
- [false alarm] Lines 516-521 duplicate 6 lines with `src/hostEditor/HostingEditor.ts` (lines 435-440), format: typescript

### src/links/backlinkCodeLens.ts (7 matches)

- Lines 4-13 duplicate 10 lines with `src/navigation/breadcrumb.ts` (lines 3-8), format: typescript
- Lines 38-47 duplicate 10 lines with `src/navigation/pageRelink.ts` (lines 26-35), format: typescript
- Lines 47-58 duplicate 12 lines with `src/navigation/movePage.ts` (lines 20-26), format: typescript
- Lines 90-93 duplicate 4 lines with `src/productivity/dailyNote.ts` (lines 11-14), format: typescript
- Lines 98-103 duplicate 6 lines with `src/navigation/wikiSearch.ts` (lines 41-46), format: typescript
- Lines 103-107 duplicate 6 lines with `src/formatting/headingColors.ts` (lines 53-58), format: typescript
- Lines 174-179 duplicate 6 lines with `src/views/pageIcon.ts` (lines 121-126), format: typescript

### src/links/backlinks.ts (4 matches)

- Lines 2-7 duplicate 6 lines with `src/productivity/bookmarks.ts` (lines 2-11), format: typescript
- Lines 68-97 duplicate 6 lines with `src/editor/editorDecorations.ts` (lines 118-123), format: typescript
- Lines 68-71 duplicate 4 lines with `src/productivity/fireInto.ts` (lines 11-14), format: typescript
- Lines 98-101 duplicate 4 lines with `src/navigation/wikiSearch.ts` (lines 66-68), format: typescript

### src/links/linkComplete.ts (3 matches)

- Lines 2-5 duplicate 4 lines with `src/links/linkHover.ts` (lines 2-5), format: typescript
- Lines 27-30 duplicate 4 lines with `src/productivity/fireInto.ts` (lines 8-10), format: typescript
- Lines 74-77 duplicate 4 lines with `src/productivity/fireInto.ts` (lines 65-67), format: typescript

### src/links/linkConvert.ts (4 matches)

- Lines 2-13 duplicate 12 lines with `src/views/pageIcon.ts` (lines 2-10), format: typescript
- Lines 19-24 duplicate 6 lines with `src/views/pageIcon.ts` (lines 18-31), format: typescript
- Lines 22-25 duplicate 4 lines with `src/views/pageIcon.ts` (lines 44-48), format: typescript
- Lines 67-74 duplicate 8 lines with `src/views/pageIcon.ts` (lines 31-48), format: typescript

### src/links/linkHover.ts (7 matches)

- Lines 2-6 duplicate 5 lines with `src/database/dbCodeLens.ts` (lines 2-6), format: typescript
- Lines 2-5 duplicate 4 lines with `src/links/linkComplete.ts` (lines 2-5), format: typescript
- Lines 3-14 duplicate 12 lines with `src/media/imageHover.ts` (lines 3-11), format: typescript
- Lines 22-25 duplicate 5 lines with `src/database/dbWebview.ts` (lines 255-259), format: typescript
- Lines 25-28 duplicate 4 lines with `src/media/imageHover.ts` (lines 21-25), format: typescript
- Lines 33-38 duplicate 6 lines with `src/links/openLink.ts` (lines 62-67), format: typescript
- Lines 74-82 duplicate 9 lines with `src/links/openLink.ts` (lines 127-135), format: typescript

### src/links/linkInsert.ts (5 matches)

- Lines 4-9 duplicate 6 lines with `src/media/pdfExport.ts` (lines 4-9), format: typescript
- Lines 24-29 duplicate 6 lines with `src/links/openLink.ts` (lines 36-40), format: typescript
- Lines 37-41 duplicate 5 lines with `src/productivity/fireInto.ts` (lines 11-16), format: typescript
- Lines 73-80 duplicate 8 lines with `src/navigation/tagIndex.ts` (lines 69-107), format: typescript

### src/links/linkValidator.ts (4 matches)

- Lines 3-8 duplicate 6 lines with `src/media/imageHover.ts` (lines 3-11), format: typescript
- Lines 31-36 duplicate 6 lines with `src/links/linkValidator.ts` (lines 26-31), format: typescript
- Lines 49-53 duplicate 5 lines with `src/navigation/tagIndex.ts` (lines 21-26), format: typescript
- Lines 73-76 duplicate 4 lines with `src/navigation/orphanPages.ts` (lines 37-38), format: typescript

### src/links/openLink.ts (15 matches)

- [false alarm] Lines 2-8 duplicate 8 lines with `src/blocks/moveBlock.ts` (lines 1-8), format: typescript
- [false alarm] Lines 2-5 duplicate 4 lines with `src/core/simpleCommands.ts` (lines 4-7), format: typescript
- [false alarm] Lines 2-8 duplicate 7 lines with `src/links/linkInsert.ts` (lines 1-7), format: typescript
- [false alarm] Lines 2-11 duplicate 10 lines with `src/productivity/gitCommit.ts` (lines 1-9), format: typescript
- [false alarm] Lines 25-40 duplicate 6 lines with `src/core/slashCommands.ts` (lines 78-83), format: typescript
- [false alarm] Lines 32-40 duplicate 6 lines with `src/editor/copyCode.ts` (lines 20-25), format: typescript
- [false alarm] Lines 36-40 duplicate 6 lines with `src/blocks/lockBlock.ts` (lines 453-458), format: typescript
- [false alarm] Lines 36-40 duplicate 6 lines with `src/blocks/lockBlock.ts` (lines 583-588), format: typescript
- [false alarm] Lines 36-40 duplicate 6 lines with `src/blocks/moveBlock.ts` (lines 41-46), format: typescript
- [false alarm] Lines 36-40 duplicate 6 lines with `src/links/linkInsert.ts` (lines 24-29), format: typescript
- [false alarm] Lines 40-460 duplicate 8 lines with `src/blocks/lockBlock.ts` (lines 519-526), format: typescript
- [false alarm] Lines 40-45 duplicate 6 lines with `src/views/pageIcon.ts` (lines 31-36), format: typescript
- [false alarm] Lines 57-61 duplicate 5 lines with `src/links/searchLinks.ts` (lines 25-150), format: typescript
- [false alarm] Lines 62-67 duplicate 6 lines with `src/links/linkHover.ts` (lines 33-38), format: typescript
- [false alarm] Lines 127-135 duplicate 9 lines with `src/links/linkHover.ts` (lines 74-82), format: typescript

### src/links/searchLinks.ts (6 matches)

- Lines 4-9 duplicate 6 lines with `src/navigation/headingNav.ts` (lines 2-7), format: typescript
- Lines 25-150 duplicate 5 lines with `src/links/openLink.ts` (lines 57-61), format: typescript
- Lines 150-153 duplicate 4 lines with `src/media/imageHover.ts` (lines 21-25), format: typescript
- Lines 238-242 duplicate 5 lines with `src/media/gif/gifCommand.ts` (lines 122-126), format: typescript
- Lines 250-256 duplicate 7 lines with `src/media/gif/gifCommand.ts` (lines 142-148), format: typescript
- Lines 257-266 duplicate 10 lines with `src/media/gif/gifCommand.ts` (lines 148-157), format: typescript

### src/lists/checkbox.ts (2 matches)

- Lines 2-6 duplicate 5 lines with `src/lists/listToggle.ts` (lines 2-6), format: typescript
- Lines 12-18 duplicate 7 lines with `src/views/pageIcon.ts` (lines 25-31), format: typescript

### src/lists/cleanList.ts (3 matches)

- Lines 126-131 duplicate 6 lines with `src/lists/listModel.ts` (lines 314-319), format: typescript
- Lines 136-142 duplicate 7 lines with `src/lists/listModel.ts` (lines 245-304), format: typescript

### src/lists/listContinue.ts (7 matches)

- Lines 4-16 duplicate 13 lines with `src/lists/listIndent.ts` (lines 3-7), format: typescript
- Lines 63-67 duplicate 5 lines with `src/lists/listContinue.ts` (lines 50-54), format: typescript
- Lines 132-136 duplicate 5 lines with `src/lists/listContinue.ts` (lines 93-96), format: typescript
- Lines 136-139 duplicate 4 lines with `src/lists/listContinue.ts` (lines 116-119), format: typescript
- Lines 141-146 duplicate 6 lines with `src/lists/listContinue.ts` (lines 120-125), format: typescript
- Lines 147-151 duplicate 5 lines with `src/lists/listContinue.ts` (lines 125-129), format: typescript
- Lines 154-159 duplicate 6 lines with `src/lists/listContinue.ts` (lines 54-62), format: typescript

### src/lists/listIndent.ts (6 matches)

- Lines 3-7 duplicate 13 lines with `src/lists/listContinue.ts` (lines 4-16), format: typescript
- Lines 100-106 duplicate 7 lines with `src/lists/listToggle.ts` (lines 27-34), format: typescript
- Lines 117-123 duplicate 7 lines with `src/lists/listIndent.ts` (lines 30-37), format: typescript
- Lines 123-133 duplicate 11 lines with `src/lists/listIndent.ts` (lines 38-48), format: typescript
- Lines 140-143 duplicate 4 lines with `src/lists/listIndent.ts` (lines 58-61), format: typescript
- Lines 209-218 duplicate 10 lines with `src/lists/listToggle.ts` (lines 24-107), format: typescript

### src/lists/listModel.ts (13 matches)

- Lines 2-7 duplicate 6 lines with `src/editor/toc.ts` (lines 1-6), format: typescript
- Lines 2-5 duplicate 4 lines with `src/productivity/gitCommit.ts` (lines 1-4), format: typescript
- Lines 3-7 duplicate 5 lines with `src/views/outline.ts` (lines 13-18), format: typescript
- Lines 4-9 duplicate 6 lines with `src/media/pdfExport.ts` (lines 4-9), format: typescript
- Lines 124-141 duplicate 18 lines with `src/lists/listModel.ts` (lines 89-106), format: typescript
- Lines 245-304 duplicate 7 lines with `src/lists/cleanList.ts` (lines 136-142), format: typescript
- Lines 270-280 duplicate 11 lines with `src/lists/listModel.ts` (lines 245-255), format: typescript
- Lines 298-303 duplicate 6 lines with `src/lists/listModel.ts` (lines 245-250), format: typescript
- Lines 314-319 duplicate 6 lines with `src/lists/cleanList.ts` (lines 126-131), format: typescript
- Lines 316-319 duplicate 4 lines with `src/lists/listModel.ts` (lines 100-104), format: typescript
- Lines 333-336 duplicate 4 lines with `src/lists/listModel.ts` (lines 122-127), format: typescript
- Lines 334-341 duplicate 8 lines with `src/lists/listModel.ts` (lines 314-321), format: typescript
- Lines 345-352 duplicate 8 lines with `src/lists/listModel.ts` (lines 325-332), format: typescript

### src/lists/listRenumber.ts (3 matches)

- Lines 15-21 duplicate 8 lines with `src/editor/tableAlignOnSave.ts` (lines 11-18), format: typescript
- Lines 15-21 duplicate 8 lines with `src/editor/toc.ts` (lines 83-90), format: typescript
- Lines 18-21 duplicate 4 lines with `src/core/trailingNewline.ts` (lines 11-14), format: typescript

### src/lists/listToggle.ts (6 matches)

- Lines 2-6 duplicate 5 lines with `src/formatting/headingLevel.ts` (lines 2-6), format: typescript
- Lines 2-6 duplicate 5 lines with `src/lists/checkbox.ts` (lines 2-6), format: typescript
- Lines 19-24 duplicate 6 lines with `src/views/pageIcon.ts` (lines 31-36), format: typescript
- Lines 24-107 duplicate 10 lines with `src/lists/listIndent.ts` (lines 209-218), format: typescript
- Lines 27-34 duplicate 7 lines with `src/lists/listIndent.ts` (lines 100-106), format: typescript
- Lines 47-51 duplicate 5 lines with `src/lists/listToggle.ts` (lines 40-44), format: typescript

### src/media/carousel.ts (5 matches)

- [false alarm] Lines 2-9 duplicate 8 lines with `src/navigation/page.ts` (lines 1-8), format: typescript
- [false alarm] Lines 6-11 duplicate 6 lines with `src/media/resource.ts` (lines 5-10), format: typescript
- [false alarm] Lines 22-25 duplicate 4 lines with `src/media/imageDrop.ts` (lines 6-12), format: typescript
- [false alarm] Lines 42-51 duplicate 10 lines with `src/media/resource.ts` (lines 22-157), format: typescript
- [false alarm] Lines 129-133 duplicate 5 lines with `src/blocks/lockBlock.ts` (lines 601-605), format: typescript

### src/media/clipboard.ts (4 matches)

- [false alarm] Lines 2-5 duplicate 4 lines with `src/productivity/dailyNote.ts` (lines 1-6), format: typescript
- [false alarm] Lines 24-48 duplicate 25 lines with `src/editor/dictate.ts` (lines 37-61), format: typescript
- [false alarm] Lines 29-35 duplicate 7 lines with `src/editor/processor.ts` (lines 94-100), format: typescript
- [false alarm] Lines 35-48 duplicate 14 lines with `src/editor/processor.ts` (lines 100-113), format: typescript

### src/media/gif/gifCommand.ts (13 matches)

- [false alarm] Lines 4-7 duplicate 6 lines with `src/media/imageDrop.ts` (lines 3-8), format: typescript
- [false alarm] Lines 4-7 duplicate 4 lines with `src/navigation/turnInto.ts` (lines 3-6), format: typescript
- [false alarm] Lines 122-126 duplicate 5 lines with `src/links/searchLinks.ts` (lines 238-242), format: typescript
- [false alarm] Lines 142-154 duplicate 13 lines with `src/editor/emoji.ts` (lines 91-103), format: typescript
- [false alarm] Lines 142-148 duplicate 7 lines with `src/links/searchLinks.ts` (lines 250-256), format: typescript
- [false alarm] Lines 148-157 duplicate 10 lines with `src/links/searchLinks.ts` (lines 257-266), format: typescript
- [false alarm] Lines 169-179 duplicate 11 lines with `src/blocks/moveBlock.ts` (lines 42-52), format: typescript
- [false alarm] Lines 170-179 duplicate 10 lines with `src/navigation/extractSubpage.ts` (lines 50-59), format: typescript
- [false alarm] Lines 173-179 duplicate 7 lines with `src/navigation/turnInto.ts` (lines 289-295), format: typescript
- [false alarm] Lines 181-189 duplicate 9 lines with `src/media/resource.ts` (lines 41-49), format: typescript
- [false alarm] Lines 184-189 duplicate 5 lines with `src/media/graph.ts` (lines 80-84), format: typescript
- [false alarm] Lines 185-189 duplicate 5 lines with `src/media/image.ts` (lines 158-162), format: typescript
- [false alarm] Lines 185-189 duplicate 5 lines with `src/media/imageDrop.ts` (lines 58-62), format: typescript

### src/media/gif/gifDownload.ts (3 matches)

- [false alarm] Lines 5-15 duplicate 11 lines with `src/media/image.ts` (lines 113-123), format: typescript
- [false alarm] Lines 18-31 duplicate 13 lines with `src/media/image.ts` (lines 127-139), format: typescript
- [false alarm] Lines 31-36 duplicate 6 lines with `src/media/image.ts` (lines 140-145), format: typescript

### src/media/gif/gifSearch.ts (3 matches)

- [false alarm] Lines 40-43 duplicate 4 lines with `src/media/gif/gifSearch.ts` (lines 4-7), format: typescript
- [false alarm] Lines 48-55 duplicate 8 lines with `src/media/gif/gifSearch.ts` (lines 13-20), format: typescript
- [false alarm] Lines 68-81 duplicate 14 lines with `src/media/gif/gifSearch.ts` (lines 27-40), format: typescript

### src/media/graph.ts (9 matches)

- [false alarm] Lines 2-6 duplicate 7 lines with `src/editor/processor.ts` (lines 1-7), format: typescript
- [false alarm] Lines 2-7 duplicate 6 lines with `src/navigation/page.ts` (lines 1-6), format: typescript
- [false alarm] Lines 8-12 duplicate 6 lines with `src/database/dbCodeLens.ts` (lines 6-11), format: typescript
- [false alarm] Lines 80-84 duplicate 5 lines with `src/media/gif/gifCommand.ts` (lines 184-189), format: typescript
- [false alarm] Lines 100-107 duplicate 8 lines with `src/media/resource.ts` (lines 22-179), format: typescript
- [false alarm] Lines 116-121 duplicate 5 lines with `src/editor/processor.ts` (lines 424-428), format: typescript
- [false alarm] Lines 126-133 duplicate 8 lines with `src/media/resource.ts` (lines 22-179), format: typescript
- [false alarm] Lines 178-182 duplicate 5 lines with `src/editor/date/dateCodeLens.ts` (lines 23-27), format: typescript
- [false alarm] Lines 179-183 duplicate 4 lines with `src/editor/toc.ts` (lines 27-30), format: typescript

### src/media/image.ts (14 matches)

- [false alarm] Lines 9-14 duplicate 6 lines with `src/media/pdfExport.ts` (lines 4-9), format: typescript
- [false alarm] Lines 42-51 duplicate 10 lines with `src/media/imageDrop.ts` (lines 62-71), format: typescript
- [false alarm] Lines 47-52 duplicate 6 lines with `src/media/resource.ts` (lines 54-60), format: typescript
- [false alarm] Lines 54-177 duplicate 18 lines with `src/editor/smartPaste.ts` (lines 124-141), format: typescript
- [false alarm] Lines 59-62 duplicate 4 lines with `src/navigation/renamePage.ts` (lines 64-67), format: typescript
- [false alarm] Lines 88-95 duplicate 8 lines with `src/media/resource.ts` (lines 50-71), format: typescript
- [false alarm] Lines 113-123 duplicate 11 lines with `src/media/gif/gifDownload.ts` (lines 5-15), format: typescript
- [false alarm] Lines 127-139 duplicate 13 lines with `src/media/gif/gifDownload.ts` (lines 18-31), format: typescript
- [false alarm] Lines 140-145 duplicate 6 lines with `src/media/gif/gifDownload.ts` (lines 31-36), format: typescript
- [false alarm] Lines 148-155 duplicate 8 lines with `src/navigation/page.ts` (lines 23-179), format: typescript
- [false alarm] Lines 158-162 duplicate 5 lines with `src/media/gif/gifCommand.ts` (lines 185-189), format: typescript
- [false alarm] Lines 177-186 duplicate 10 lines with `src/media/imageDrop.ts` (lines 36-46), format: typescript
- [false alarm] Lines 186-194 duplicate 9 lines with `src/media/imageDrop.ts` (lines 46-54), format: typescript

### src/media/imageDrop.ts (8 matches)

- [false alarm] Lines 3-8 duplicate 6 lines with `src/media/gif/gifCommand.ts` (lines 4-7), format: typescript
- [false alarm] Lines 3-6 duplicate 4 lines with `src/media/imageHover.ts` (lines 3-6), format: typescript
- [false alarm] Lines 6-12 duplicate 4 lines with `src/media/carousel.ts` (lines 22-25), format: typescript
- [false alarm] Lines 36-46 duplicate 10 lines with `src/media/image.ts` (lines 177-186), format: typescript
- [false alarm] Lines 41-44 duplicate 4 lines with `src/navigation/renamePage.ts` (lines 64-67), format: typescript
- [false alarm] Lines 46-54 duplicate 9 lines with `src/media/image.ts` (lines 186-194), format: typescript
- [false alarm] Lines 58-62 duplicate 5 lines with `src/media/gif/gifCommand.ts` (lines 185-189), format: typescript
- [false alarm] Lines 62-71 duplicate 10 lines with `src/media/image.ts` (lines 42-51), format: typescript

### src/media/imageHover.ts (7 matches)

- [false alarm] Lines 3-11 duplicate 12 lines with `src/links/linkHover.ts` (lines 3-14), format: typescript
- [false alarm] Lines 3-11 duplicate 6 lines with `src/links/linkValidator.ts` (lines 3-8), format: typescript
- [false alarm] Lines 3-6 duplicate 4 lines with `src/media/imageDrop.ts` (lines 3-6), format: typescript
- [false alarm] Lines 21-25 duplicate 4 lines with `src/links/linkHover.ts` (lines 25-28), format: typescript
- [false alarm] Lines 21-25 duplicate 4 lines with `src/links/searchLinks.ts` (lines 150-153), format: typescript
- [false alarm] Lines 48-52 duplicate 5 lines with `src/media/imageHover.ts` (lines 38-42), format: typescript
- [false alarm] Lines 61-66 duplicate 6 lines with `src/media/imageHover.ts` (lines 38-42), format: typescript

### src/media/pdfExport.ts (9 matches)

- [false alarm] Lines 4-9 duplicate 6 lines with `src/blocks/lockBlock.ts` (lines 4-9), format: typescript
- [false alarm] Lines 4-9 duplicate 6 lines with `src/editor/emoji.ts` (lines 4-9), format: typescript
- [false alarm] Lines 4-9 duplicate 6 lines with `src/links/linkInsert.ts` (lines 4-9), format: typescript
- [false alarm] Lines 4-9 duplicate 6 lines with `src/lists/listModel.ts` (lines 4-9), format: typescript
- [false alarm] Lines 4-9 duplicate 6 lines with `src/media/image.ts` (lines 9-14), format: typescript
- [false alarm] Lines 5-9 duplicate 5 lines with `src/navigation/movePage.ts` (lines 1-4), format: typescript
- [false alarm] Lines 143-153 duplicate 9 lines with `src/core/webviewShell.ts` (lines 35-43), format: typescript
- [false alarm] Lines 145-153 duplicate 7 lines with `src/editor/smartPaste.ts` (lines 173-179), format: typescript

### src/media/resource.ts (14 matches)

- [false alarm] Lines 2-6 duplicate 5 lines with `src/navigation/movePage.ts` (lines 4-8), format: typescript
- [false alarm] Lines 5-10 duplicate 6 lines with `src/media/carousel.ts` (lines 6-11), format: typescript
- [false alarm] Lines 22-157 duplicate 10 lines with `src/media/carousel.ts` (lines 42-51), format: typescript
- [false alarm] Lines 22-179 duplicate 8 lines with `src/media/graph.ts` (lines 100-107), format: typescript
- [false alarm] Lines 22-179 duplicate 8 lines with `src/media/graph.ts` (lines 126-133), format: typescript
- [false alarm] Lines 22-29 duplicate 8 lines with `src/navigation/turnInto.ts` (lines 179-288), format: typescript
- [false alarm] Lines 40-187 duplicate 8 lines with `src/editor/smartPaste.ts` (lines 114-121), format: typescript
- [false alarm] Lines 41-49 duplicate 9 lines with `src/media/gif/gifCommand.ts` (lines 181-189), format: typescript
- [false alarm] Lines 50-71 duplicate 8 lines with `src/media/image.ts` (lines 88-95), format: typescript
- [false alarm] Lines 54-60 duplicate 6 lines with `src/media/image.ts` (lines 47-52), format: typescript
- [false alarm] Lines 58-211 duplicate 8 lines with `src/editor/toc.ts` (lines 70-77), format: typescript
- [false alarm] Lines 60-211 duplicate 7 lines with `src/editor/callout.ts` (lines 60-66), format: typescript
- [false alarm] Lines 60-211 duplicate 6 lines with `src/editor/emoji.ts` (lines 107-112), format: typescript

### src/media/unusedImages.ts (3 matches)

- [false alarm] Lines 13-20 duplicate 8 lines with `src/productivity/dailyNote.ts` (lines 11-18), format: typescript
- [false alarm] Lines 31-35 duplicate 5 lines with `src/navigation/tagIndex.ts` (lines 21-26), format: typescript

### src/navigation/breadcrumb.ts (7 matches)

- [false alarm] Lines 2-5 duplicate 4 lines with `src/navigation/wikiSearch.ts` (lines 1-4), format: typescript
- [false alarm] Lines 3-8 duplicate 10 lines with `src/links/backlinkCodeLens.ts` (lines 4-13), format: typescript
- [false alarm] Lines 29-37 duplicate 9 lines with `src/views/wordCount.ts` (lines 26-34), format: typescript
- [false alarm] Lines 37-47 duplicate 11 lines with `src/views/wordCount.ts` (lines 34-44), format: typescript
- [false alarm] Lines 47-51 duplicate 5 lines with `src/navigation/renamePage.ts` (lines 14-46), format: typescript
- [false alarm] Lines 61-73 duplicate 14 lines with `src/__tests__/aesthetics.test.ts` (lines 52-65), format: typescript

### src/navigation/extractSubpage.ts (8 matches)

- [false alarm] Lines 17-22 duplicate 6 lines with `src/blocks/selectBlock.ts` (lines 12-17), format: typescript
- [false alarm] Lines 17-21 duplicate 5 lines with `src/views/pageIcon.ts` (lines 31-36), format: typescript
- [false alarm] Lines 50-59 duplicate 10 lines with `src/media/gif/gifCommand.ts` (lines 170-179), format: typescript
- [false alarm] Lines 63-77 duplicate 15 lines with `src/navigation/renamePage.ts` (lines 46-64), format: typescript
- [false alarm] Lines 79-84 duplicate 6 lines with `src/navigation/page.ts` (lines 50-55), format: typescript
- [false alarm] Lines 85-89 duplicate 5 lines with `src/navigation/turnInto.ts` (lines 338-342), format: typescript
- [false alarm] Lines 140-144 duplicate 5 lines with `src/blocks/moveBlock.ts` (lines 154-158), format: typescript

### src/navigation/headingAnchor.ts (5 matches)

- [false alarm] Lines 18-21 duplicate 7 lines with `src/formatting/headingColors.ts` (lines 46-52), format: typescript
- [false alarm] Lines 21-26 duplicate 6 lines with `src/navigation/headingNav.ts` (lines 13-18), format: typescript
- [false alarm] Lines 26-29 duplicate 4 lines with `src/navigation/headingNav.ts` (lines 70-72), format: typescript
- [false alarm] Lines 62-65 duplicate 4 lines with `src/views/wordCount.ts` (lines 23-26), format: typescript

### src/navigation/headingNav.ts (12 matches)

- [false alarm] Lines 2-7 duplicate 6 lines with `src/links/searchLinks.ts` (lines 4-9), format: typescript
- [false alarm] Lines 13-18 duplicate 6 lines with `src/editor/snippetExpander.ts` (lines 39-44), format: typescript
- [false alarm] Lines 13-18 duplicate 6 lines with `src/navigation/headingAnchor.ts` (lines 21-26), format: typescript
- [false alarm] Lines 13-17 duplicate 5 lines with `src/views/pageIcon.ts` (lines 31-36), format: typescript
- [false alarm] Lines 28-34 duplicate 7 lines with `src/navigation/headingNav.ts` (lines 20-27), format: typescript
- [false alarm] Lines 36-43 duplicate 8 lines with `src/views/pageIcon.ts` (lines 20-31), format: typescript
- [false alarm] Lines 43-50 duplicate 8 lines with `src/navigation/headingNav.ts` (lines 20-27), format: typescript
- [false alarm] Lines 51-59 duplicate 9 lines with `src/navigation/headingNav.ts` (lines 36-43), format: typescript
- [false alarm] Lines 60-66 duplicate 7 lines with `src/views/pageIcon.ts` (lines 18-31), format: typescript
- [false alarm] Lines 70-72 duplicate 4 lines with `src/navigation/headingAnchor.ts` (lines 26-29), format: typescript
- [false alarm] Lines 72-75 duplicate 4 lines with `src/editor/toc.ts` (lines 42-45), format: typescript
- [false alarm] Lines 99-103 duplicate 5 lines with `src/editor/comments/commentPanel.ts` (lines 103-107), format: typescript

### src/navigation/movePage.ts (10 matches)

- [false alarm] Lines 4-8 duplicate 5 lines with `src/media/resource.ts` (lines 2-6), format: typescript
- [false alarm] Lines 20-26 duplicate 12 lines with `src/links/backlinkCodeLens.ts` (lines 47-58), format: typescript
- [false alarm] Lines 20-47 duplicate 28 lines with `src/navigation/pageRelink.ts` (lines 15-42), format: typescript
- [false alarm] Lines 77-80 duplicate 4 lines with `src/navigation/pageRelink.ts` (lines 159-162), format: typescript
- [false alarm] Lines 81-93 duplicate 13 lines with `src/navigation/movePage.ts` (lines 67-79), format: typescript
- [false alarm] Lines 116-121 duplicate 6 lines with `src/navigation/renamePage.ts` (lines 133-141), format: typescript
- [false alarm] Lines 131-141 duplicate 11 lines with `src/navigation/renamePage.ts` (lines 28-37), format: typescript
- [false alarm] Lines 148-154 duplicate 7 lines with `src/navigation/renamePage.ts` (lines 46-51), format: typescript
- [false alarm] Lines 197-200 duplicate 4 lines with `src/navigation/renamePage.ts` (lines 102-105), format: typescript

### src/navigation/orphanPages.ts (5 matches)

- [false alarm] Lines 11-18 duplicate 8 lines with `src/productivity/dailyNote.ts` (lines 11-18), format: typescript
- [false alarm] Lines 18-24 duplicate 7 lines with `src/productivity/fireInto.ts` (lines 8-21), format: typescript
- [false alarm] Lines 37-38 duplicate 4 lines with `src/links/linkValidator.ts` (lines 73-76), format: typescript
- [false alarm] Lines 87-100 duplicate 14 lines with `src/navigation/quickSwitch.ts` (lines 33-69), format: typescript

### src/navigation/page.ts (14 matches)

- [false alarm] Lines 2-7 duplicate 6 lines with `src/productivity/bookmarks.ts` (lines 2-7), format: typescript
- [false alarm] Lines 6-12 duplicate 7 lines with `src/navigation/renamePage.ts` (lines 4-9), format: typescript
- [false alarm] Lines 23-179 duplicate 8 lines with `src/media/image.ts` (lines 148-155), format: typescript
- [false alarm] Lines 23-30 duplicate 8 lines with `src/navigation/turnInto.ts` (lines 179-288), format: typescript
- [false alarm] Lines 33-36 duplicate 4 lines with `src/navigation/renamePage.ts` (lines 64-67), format: typescript
- [false alarm] Lines 50-55 duplicate 6 lines with `src/navigation/extractSubpage.ts` (lines 79-84), format: typescript
- [false alarm] Lines 56-60 duplicate 5 lines with `src/navigation/turnInto.ts` (lines 338-342), format: typescript

### src/navigation/pageRelink.ts (7 matches)

- [false alarm] Lines 15-42 duplicate 28 lines with `src/navigation/movePage.ts` (lines 20-47), format: typescript
- [false alarm] Lines 26-35 duplicate 10 lines with `src/links/backlinkCodeLens.ts` (lines 38-47), format: typescript
- [false alarm] Lines 121-124 duplicate 4 lines with `src/productivity/dailyNote.ts` (lines 11-49), format: typescript
- [false alarm] Lines 130-136 duplicate 7 lines with `src/navigation/tagIndex.ts` (lines 21-27), format: typescript
- [false alarm] Lines 159-162 duplicate 4 lines with `src/navigation/movePage.ts` (lines 77-80), format: typescript
- [false alarm] Lines 163-176 duplicate 14 lines with `src/navigation/pageRelink.ts` (lines 148-161), format: typescript

### src/navigation/quickSwitch.ts (5 matches)

- [false alarm] Lines 11-20 duplicate 10 lines with `src/navigation/tagIndex.ts` (lines 14-16), format: typescript
- [false alarm] Lines 20-32 duplicate 13 lines with `src/productivity/fireInto.ts` (lines 16-28), format: typescript
- [false alarm] Lines 33-69 duplicate 14 lines with `src/navigation/orphanPages.ts` (lines 87-100), format: typescript
- [false alarm] Lines 39-46 duplicate 8 lines with `src/productivity/fireInto.ts` (lines 62-69), format: typescript

### src/navigation/recentPages.ts (4 matches)

- [false alarm] Lines 1-10 duplicate 10 lines with `src/navigation/wikiSearch.ts` (lines 1-11), format: typescript
- [false alarm] Lines 38-45 duplicate 8 lines with `src/navigation/recentPages.ts` (lines 29-35), format: typescript
- [false alarm] Lines 50-54 duplicate 5 lines with `src/productivity/fireInto.ts` (lines 10-14), format: typescript
- [false alarm] Lines 71-79 duplicate 9 lines with `src/productivity/bookmarks.ts` (lines 126-134), format: typescript

### src/navigation/renamePage.ts (14 matches)

- [false alarm] Lines 1-11 duplicate 6 lines with `src/navigation/pageRelink.ts` (lines 1-6), format: typescript
- [false alarm] Lines 4-9 duplicate 7 lines with `src/navigation/page.ts` (lines 6-12), format: typescript
- [false alarm] Lines 14-46 duplicate 5 lines with `src/navigation/breadcrumb.ts` (lines 47-51), format: typescript
- [false alarm] Lines 28-37 duplicate 11 lines with `src/navigation/movePage.ts` (lines 131-141), format: typescript
- [false alarm] Lines 46-64 duplicate 15 lines with `src/navigation/extractSubpage.ts` (lines 63-77), format: typescript
- [false alarm] Lines 46-51 duplicate 7 lines with `src/navigation/movePage.ts` (lines 148-154), format: typescript
- [false alarm] Lines 64-67 duplicate 4 lines with `src/media/image.ts` (lines 59-62), format: typescript
- [false alarm] Lines 64-67 duplicate 4 lines with `src/media/imageDrop.ts` (lines 41-44), format: typescript
- [false alarm] Lines 64-67 duplicate 4 lines with `src/navigation/page.ts` (lines 33-36), format: typescript
- [false alarm] Lines 102-105 duplicate 4 lines with `src/navigation/movePage.ts` (lines 197-200), format: typescript
- [false alarm] Lines 133-141 duplicate 6 lines with `src/navigation/movePage.ts` (lines 116-121), format: typescript
- [false alarm] Lines 135-140 duplicate 6 lines with `src/editor/comments/commentModel.ts` (lines 66-71), format: typescript
- [false alarm] Lines 142-152 duplicate 11 lines with `src/navigation/renamePage.ts` (lines 130-139), format: typescript

### src/navigation/tagIndex.ts (12 matches)

- [false alarm] Lines 1-11 duplicate 6 lines with `src/media/unusedImages.ts` (lines 1-6), format: typescript
- [false alarm] Lines 1-11 duplicate 6 lines with `src/navigation/orphanPages.ts` (lines 1-6), format: typescript
- [false alarm] Lines 1-11 duplicate 6 lines with `src/navigation/quickSwitch.ts` (lines 1-6), format: typescript
- [false alarm] Lines 14-16 duplicate 10 lines with `src/navigation/quickSwitch.ts` (lines 11-20), format: typescript
- [false alarm] Lines 21-26 duplicate 5 lines with `src/links/linkValidator.ts` (lines 49-53), format: typescript
- [false alarm] Lines 21-26 duplicate 5 lines with `src/media/unusedImages.ts` (lines 31-35), format: typescript
- [false alarm] Lines 21-27 duplicate 7 lines with `src/navigation/pageRelink.ts` (lines 130-136), format: typescript
- [false alarm] Lines 23-27 duplicate 5 lines with `src/navigation/wikiSearch.ts` (lines 43-48), format: typescript
- [false alarm] Lines 69-107 duplicate 8 lines with `src/links/linkInsert.ts` (lines 73-80), format: typescript
- [false alarm] Lines 108-114 duplicate 7 lines with `src/productivity/fireInto.ts` (lines 63-69), format: typescript

### src/navigation/turnInto.ts (18 matches)

- [false alarm] Lines 2-6 duplicate 5 lines with `src/productivity/bookmarks.ts` (lines 2-6), format: typescript
- [false alarm] Lines 3-6 duplicate 4 lines with `src/media/gif/gifCommand.ts` (lines 4-7), format: typescript
- [false alarm] Lines 8-14 duplicate 7 lines with `src/blocks/moveBlock.ts` (lines 7-13), format: typescript
- [false alarm] Lines 179-288 duplicate 8 lines with `src/media/resource.ts` (lines 22-29), format: typescript
- [false alarm] Lines 179-288 duplicate 8 lines with `src/navigation/page.ts` (lines 23-30), format: typescript
- [false alarm] Lines 219-225 duplicate 7 lines with `src/navigation/turnInto.ts` (lines 88-94), format: typescript
- [false alarm] Lines 226-234 duplicate 9 lines with `src/navigation/turnInto.ts` (lines 96-103), format: typescript
- [false alarm] Lines 235-238 duplicate 4 lines with `src/navigation/turnInto.ts` (lines 95-98), format: typescript
- [false alarm] Lines 236-243 duplicate 8 lines with `src/navigation/turnInto.ts` (lines 106-114), format: typescript
- [false alarm] Lines 255-259 duplicate 5 lines with `src/navigation/turnInto.ts` (lines 164-168), format: typescript
- [false alarm] Lines 260-267 duplicate 8 lines with `src/navigation/turnInto.ts` (lines 169-176), format: typescript
- [false alarm] Lines 289-295 duplicate 7 lines with `src/media/gif/gifCommand.ts` (lines 173-179), format: typescript
- [false alarm] Lines 297-322 duplicate 26 lines with `src/navigation/turnInto.ts` (lines 151-176), format: typescript
- [false alarm] Lines 338-342 duplicate 5 lines with `src/navigation/extractSubpage.ts` (lines 85-89), format: typescript
- [false alarm] Lines 338-342 duplicate 5 lines with `src/navigation/page.ts` (lines 56-60), format: typescript
- [false alarm] Lines 369-374 duplicate 6 lines with `src/navigation/turnInto.ts` (lines 180-185), format: typescript
- [false alarm] Lines 384-391 duplicate 8 lines with `src/navigation/turnInto.ts` (lines 86-92), format: typescript
- [false alarm] Lines 414-417 duplicate 4 lines with `src/navigation/turnInto.ts` (lines 288-291), format: typescript

### src/navigation/wikiSearch.ts (8 matches)

- [false alarm] Lines 1-11 duplicate 10 lines with `src/navigation/recentPages.ts` (lines 1-10), format: typescript
- [false alarm] Lines 1-11 duplicate 6 lines with `src/navigation/tagIndex.ts` (lines 1-6), format: typescript
- [false alarm] Lines 41-46 duplicate 6 lines with `src/links/backlinkCodeLens.ts` (lines 98-103), format: typescript
- [false alarm] Lines 43-48 duplicate 5 lines with `src/navigation/tagIndex.ts` (lines 23-27), format: typescript
- [false alarm] Lines 66-68 duplicate 4 lines with `src/links/backlinks.ts` (lines 98-101), format: typescript
- [false alarm] Lines 93-98 duplicate 6 lines with `src/productivity/bookmarks.ts` (lines 126-131), format: typescript
- [false alarm] Lines 100-104 duplicate 5 lines with `src/editor/comments/commentPanel.ts` (lines 104-108), format: typescript

### src/productivity/bookmarks.ts (14 matches)

- [false alarm] Lines 2-8 duplicate 7 lines with `src/editor/dictate.ts` (lines 3-9), format: typescript
- [false alarm] Lines 2-11 duplicate 6 lines with `src/links/backlinks.ts` (lines 2-7), format: typescript
- [false alarm] Lines 2-7 duplicate 6 lines with `src/navigation/page.ts` (lines 2-7), format: typescript
- [false alarm] Lines 2-6 duplicate 5 lines with `src/navigation/renamePage.ts` (lines 1-5), format: typescript
- [false alarm] Lines 2-6 duplicate 5 lines with `src/navigation/turnInto.ts` (lines 2-6), format: typescript
- [false alarm] Lines 3-6 duplicate 4 lines with `src/productivity/dailyNote.ts` (lines 1-5), format: typescript
- [false alarm] Lines 34-44 duplicate 11 lines with `src/editor/comments/commentModel.ts` (lines 32-42), format: typescript
- [false alarm] Lines 49-53 duplicate 5 lines with `src/editor/comments/commentModel.ts` (lines 44-48), format: typescript
- [false alarm] Lines 111-114 duplicate 4 lines with `src/productivity/bookmarks.ts` (lines 84-87), format: typescript
- [false alarm] Lines 115-118 duplicate 4 lines with `src/productivity/bookmarks.ts` (lines 63-65), format: typescript
- [false alarm] Lines 119-122 duplicate 4 lines with `src/productivity/bookmarks.ts` (lines 91-94), format: typescript
- [false alarm] Lines 126-134 duplicate 9 lines with `src/navigation/recentPages.ts` (lines 71-79), format: typescript
- [false alarm] Lines 126-131 duplicate 6 lines with `src/navigation/wikiSearch.ts` (lines 93-98), format: typescript
- [false alarm] Lines 141-148 duplicate 8 lines with `src/views/outline.ts` (lines 60-67), format: typescript

### src/productivity/clipHistory.ts (2 matches)

- Lines 1-12 duplicate 12 lines with `src/views/outline.ts` (lines 13-18), format: typescript
- Lines 32-37 duplicate 6 lines with `src/views/pageIcon.ts` (lines 31-36), format: typescript

### src/productivity/dailyNote.ts (7 matches)

- Lines 11-14 duplicate 4 lines with `src/links/backlinkCodeLens.ts` (lines 90-93), format: typescript
- Lines 11-18 duplicate 8 lines with `src/media/unusedImages.ts` (lines 13-20), format: typescript
- Lines 11-18 duplicate 8 lines with `src/navigation/orphanPages.ts` (lines 11-18), format: typescript
- Lines 11-49 duplicate 4 lines with `src/navigation/pageRelink.ts` (lines 121-124), format: typescript

### src/productivity/fireInto.ts (11 matches)

- Lines 8-10 duplicate 4 lines with `src/links/linkComplete.ts` (lines 27-30), format: typescript
- Lines 8-21 duplicate 7 lines with `src/navigation/orphanPages.ts` (lines 18-24), format: typescript
- Lines 10-14 duplicate 5 lines with `src/navigation/recentPages.ts` (lines 50-54), format: typescript
- Lines 11-14 duplicate 4 lines with `src/links/backlinks.ts` (lines 68-71), format: typescript
- Lines 11-16 duplicate 5 lines with `src/links/linkInsert.ts` (lines 37-41), format: typescript
- Lines 16-28 duplicate 13 lines with `src/navigation/quickSwitch.ts` (lines 20-32), format: typescript
- Lines 51-65 duplicate 7 lines with `src/blocks/moveBlock.ts` (lines 246-252), format: typescript
- Lines 51-68 duplicate 12 lines with `src/editor/smartPaste.ts` (lines 190-201), format: typescript
- Lines 62-69 duplicate 8 lines with `src/navigation/quickSwitch.ts` (lines 39-46), format: typescript
- Lines 63-69 duplicate 7 lines with `src/navigation/tagIndex.ts` (lines 108-114), format: typescript
- Lines 65-67 duplicate 4 lines with `src/links/linkComplete.ts` (lines 74-77), format: typescript

### src/productivity/gitCommit.ts (7 matches)

- Lines 1-18 duplicate 29 lines with `src/editor/snippetExpander.ts` (lines 1-29), format: typescript
- Lines 104-107 duplicate 4 lines with `src/editor/processor.ts` (lines 208-211), format: typescript
- Lines 168-171 duplicate 4 lines with `src/productivity/gitCommit.ts` (lines 104-107), format: typescript

### src/productivity/pomodoro.ts (3 matches)

- Lines 88-92 duplicate 5 lines with `src/productivity/pomodoro.ts` (lines 44-48), format: typescript
- Lines 95-99 duplicate 5 lines with `src/productivity/pomodoro.ts` (lines 43-47), format: typescript

### src/productivity/taskProgress.ts (4 matches)

- Lines 21-26 duplicate 6 lines with `src/views/wordCount.ts` (lines 21-26), format: typescript
- Lines 26-34 duplicate 9 lines with `src/views/wordCount.ts` (lines 26-34), format: typescript
- Lines 34-45 duplicate 12 lines with `src/views/wordCount.ts` (lines 34-46), format: typescript

### src/productivity/taskStrikethrough.ts (2 matches)

- Lines 28-31 duplicate 4 lines with `src/views/wordCount.ts` (lines 23-26), format: typescript
- Lines 31-39 duplicate 9 lines with `src/views/wordCount.ts` (lines 26-34), format: typescript

### src/views/outline.ts (6 matches)

- Lines 13-18 duplicate 5 lines with `src/lists/listModel.ts` (lines 3-7), format: typescript
- Lines 13-18 duplicate 12 lines with `src/productivity/clipHistory.ts` (lines 1-12), format: typescript
- Lines 40-48 duplicate 10 lines with `src/__tests__/aesthetics.test.ts` (lines 11-20), format: typescript
- Lines 60-67 duplicate 8 lines with `src/productivity/bookmarks.ts` (lines 141-148), format: typescript
- Lines 143-147 duplicate 6 lines with `src/editor/focusMode.ts` (lines 179-184), format: typescript
- Lines 155-158 duplicate 4 lines with `src/editor/comments/commentPanel.ts` (lines 104-107), format: typescript

### src/views/pageIcon.ts (20 matches)

- [false alarm] Lines 2-10 duplicate 10 lines with `src/editor/frontmatterEditor.ts` (lines 3-12), format: typescript
- [false alarm] Lines 2-10 duplicate 12 lines with `src/links/linkConvert.ts` (lines 2-13), format: typescript
- [false alarm] Lines 18-31 duplicate 6 lines with `src/blocks/blockSwap.ts` (lines 25-30), format: typescript
- [false alarm] Lines 18-31 duplicate 7 lines with `src/blocks/duplicateBlock.ts` (lines 18-24), format: typescript
- [false alarm] Lines 18-31 duplicate 8 lines with `src/formatting/wrapWith.ts` (lines 35-42), format: typescript
- [false alarm] Lines 18-31 duplicate 6 lines with `src/links/linkConvert.ts` (lines 19-24), format: typescript
- [false alarm] Lines 18-31 duplicate 7 lines with `src/navigation/headingNav.ts` (lines 60-66), format: typescript
- [false alarm] Lines 20-31 duplicate 8 lines with `src/navigation/headingNav.ts` (lines 36-43), format: typescript
- [false alarm] Lines 25-31 duplicate 7 lines with `src/lists/checkbox.ts` (lines 12-18), format: typescript
- [false alarm] Lines 30-31 duplicate 17 lines with `src/formatting/headingLevel.ts` (lines 39-55), format: typescript
- [false alarm] Lines 31-48 duplicate 7 lines with `src/editor/frontmatterEditor.ts` (lines 46-52), format: typescript
- [false alarm] Lines 31-35 duplicate 16 lines with `src/formatting/headingLevel.ts` (lines 14-29), format: typescript
- [false alarm] Lines 31-48 duplicate 8 lines with `src/links/linkConvert.ts` (lines 67-74), format: typescript
- [false alarm] Lines 31-36 duplicate 6 lines with `src/links/openLink.ts` (lines 40-45), format: typescript
- [false alarm] Lines 31-36 duplicate 6 lines with `src/lists/listToggle.ts` (lines 19-24), format: typescript
- [false alarm] Lines 31-36 duplicate 5 lines with `src/navigation/extractSubpage.ts` (lines 17-21), format: typescript
- [false alarm] Lines 31-36 duplicate 5 lines with `src/navigation/headingNav.ts` (lines 13-17), format: typescript
- [false alarm] Lines 31-36 duplicate 6 lines with `src/productivity/clipHistory.ts` (lines 32-37), format: typescript
- [false alarm] Lines 44-48 duplicate 4 lines with `src/links/linkConvert.ts` (lines 22-25), format: typescript
- [false alarm] Lines 121-126 duplicate 6 lines with `src/links/backlinkCodeLens.ts` (lines 174-179), format: typescript

### src/views/readingProgress.ts (1 matches)

- Lines 41-47 duplicate 7 lines with `src/formatting/headingColors.ts` (lines 84-90), format: typescript

### src/views/wordCount.ts (11 matches)

- Lines 21-26 duplicate 6 lines with `src/productivity/taskProgress.ts` (lines 21-26), format: typescript
- Lines 23-26 duplicate 4 lines with `src/navigation/headingAnchor.ts` (lines 62-65), format: typescript
- Lines 23-26 duplicate 4 lines with `src/productivity/taskStrikethrough.ts` (lines 28-31), format: typescript
- Lines 26-34 duplicate 9 lines with `src/navigation/breadcrumb.ts` (lines 29-37), format: typescript
- Lines 26-34 duplicate 9 lines with `src/productivity/taskProgress.ts` (lines 26-34), format: typescript
- Lines 26-34 duplicate 9 lines with `src/productivity/taskStrikethrough.ts` (lines 31-39), format: typescript
- Lines 34-44 duplicate 11 lines with `src/navigation/breadcrumb.ts` (lines 37-47), format: typescript
- Lines 34-46 duplicate 12 lines with `src/productivity/taskProgress.ts` (lines 34-45), format: typescript

### src/webview/apps/commentApp.css (3 matches)

- [false alarm] Lines 9-27 duplicate 19 lines with `src/webview/apps/dateApp.css` (lines 9-27), format: css
- [false alarm] Lines 87-92 duplicate 6 lines with `src/webview/apps/dbApp.css` (lines 42-119), format: css

### src/webview/apps/commentApp.tsx (1 matches)

- [fixed] Lines 4-9 duplicate 6 lines with `src/webview/apps/gifApp.tsx` (lines 4-9), format: tsx

### src/webview/apps/dateApp.css (4 matches)

- [false alarm] Lines 9-27 duplicate 19 lines with `src/webview/apps/commentApp.css` (lines 9-27), format: css
- [false alarm] Lines 37-41 duplicate 5 lines with `src/webview/apps/dbApp.css` (lines 119-123), format: css
- [false alarm] Lines 67-72 duplicate 6 lines with `src/webview/apps/dbApp.css` (lines 42-119), format: css

### src/webview/apps/dateApp.tsx (1 matches)

- [fixed] Lines 4-9 duplicate 6 lines with `src/webview/apps/gifApp.tsx` (lines 4-9), format: tsx

### src/webview/apps/dbApp.css (12 matches)

- [false alarm] Lines 42-119 duplicate 6 lines with `src/webview/apps/commentApp.css` (lines 87-92), format: css
- [false alarm] Lines 42-119 duplicate 6 lines with `src/webview/apps/dateApp.css` (lines 67-72), format: css
- [false alarm] Lines 94-98 duplicate 5 lines with `src/webview/apps/dbApp.css` (lines 44-48), format: css
- [false alarm] Lines 119-123 duplicate 5 lines with `src/webview/apps/dateApp.css` (lines 37-41), format: css
- [false alarm] Lines 279-288 duplicate 10 lines with `src/webview/apps/dbApp.css` (lines 254-263), format: css
- [false alarm] Lines 348-352 duplicate 5 lines with `src/webview/apps/dbApp.css` (lines 44-48), format: css
- [false alarm] Lines 444-448 duplicate 5 lines with `src/webview/apps/dbApp.css` (lines 307-311), format: css
- [false alarm] Lines 474-477 duplicate 4 lines with `src/webview/apps/dbApp.css` (lines 119-122), format: css
- [false alarm] Lines 655-658 duplicate 4 lines with `src/webview/apps/dbApp.css` (lines 350-353), format: css
- [false alarm] Lines 744-749 duplicate 6 lines with `src/webview/apps/dbApp.css` (lines 457-462), format: css
- [false alarm] Lines 814-821 duplicate 8 lines with `src/webview/apps/dbApp.css` (lines 759-766), format: css
- [false alarm] Lines 861-869 duplicate 9 lines with `src/webview/apps/dbApp.css` (lines 827-835), format: css

### src/webview/apps/dbApp.tsx (1 matches)

- [fixed] Lines 4-9 duplicate 6 lines with `src/webview/apps/gifApp.tsx` (lines 4-9), format: tsx

### src/webview/apps/dictateApp.tsx (1 matches)

- [fixed] Lines 4-9 duplicate 6 lines with `src/webview/apps/gifApp.tsx` (lines 4-9), format: tsx

### src/webview/apps/gifApp.tsx (4 matches)

- [fixed] Lines 4-9 duplicate 6 lines with `src/webview/apps/commentApp.tsx` (lines 4-9), format: tsx
- [fixed] Lines 4-9 duplicate 6 lines with `src/webview/apps/dateApp.tsx` (lines 4-9), format: tsx
- [fixed] Lines 4-9 duplicate 6 lines with `src/webview/apps/dbApp.tsx` (lines 4-9), format: tsx
- [fixed] Lines 4-9 duplicate 6 lines with `src/webview/apps/dictateApp.tsx` (lines 4-9), format: tsx

### src/webview/communicators/DatePanelToExtensionCommunicator.ts (1 matches)

- Lines 16-23 duplicate 8 lines with `src/webview/communicators/DbPanelToExtensionCommunicator.ts` (lines 17-24), format: typescript

### src/webview/communicators/DbPanelToExtensionCommunicator.ts (1 matches)

- Lines 17-24 duplicate 8 lines with `src/webview/communicators/DatePanelToExtensionCommunicator.ts` (lines 16-23), format: typescript

### src/webview/communicators/PanelToExtensionCommunicator.ts (4 matches)

- [fixed] Lines 11-17 duplicate 7 lines with `src/communicators/extensionToPanelCommunicator.ts` (lines 8-14), format: typescript
- [fixed] Lines 21-30 duplicate 10 lines with `src/communicators/extensionToPanelCommunicator.ts` (lines 17-26), format: typescript
- [fixed] Lines 31-41 duplicate 11 lines with `src/communicators/extensionToPanelCommunicator.ts` (lines 26-36), format: typescript
- [fixed] Lines 35-38 duplicate 4 lines with `src/contracts/communicator.ts` (lines 22-25), format: typescript

### src/webview/components/database/calendarview/CalendarView.tsx (4 matches)

- [fixed] Lines 135-149 duplicate 17 lines with `src/webview/components/database/KanbanView.tsx` (lines 72-88), format: javascript
- [fixed] Lines 138-145 duplicate 7 lines with `src/webview/components/database/KanbanView.tsx` (lines 75-81), format: tsx
- [fixed] Lines 138-145 duplicate 7 lines with `src/webview/components/FilterBar.tsx` (lines 183-189), format: tsx
- [fixed] Lines 153-160 duplicate 8 lines with `src/webview/components/database/calendarview/CalendarView.tsx` (lines 137-145), format: tsx

### src/webview/components/database/calendarview/RenderWeek.tsx (1 matches)

- [fixed] Lines 146-149 duplicate 4 lines with `src/webview/components/database/calendarview/RenderWeek.tsx` (lines 133-136), format: tsx

### src/webview/components/database/KanbanView.tsx (3 matches)

- [fixed] Lines 72-88 duplicate 17 lines with `src/webview/components/database/calendarview/CalendarView.tsx` (lines 135-149), format: javascript
- [fixed] Lines 75-81 duplicate 7 lines with `src/webview/components/database/calendarview/CalendarView.tsx` (lines 138-145), format: tsx
- [fixed] Lines 126-132 duplicate 7 lines with `src/webview/components/database/tableview/TableView.tsx` (lines 130-133), format: javascript

### src/webview/components/database/tableview/TableView.tsx (2 matches)

- Lines 107-112 duplicate 6 lines with `src/webview/components/database/tableview/TableView.tsx` (lines 67-72), format: tsx
- [fixed] Lines 130-133 duplicate 7 lines with `src/webview/components/database/KanbanView.tsx` (lines 126-132), format: javascript

### src/webview/components/database/Toolbar.tsx (1 matches)

- Lines 83-88 duplicate 6 lines with `src/webview/components/database/Toolbar.tsx` (lines 74-79), format: javascript

### src/webview/components/FilterBar.tsx (5 matches)

- [fixed] Lines 97-100 duplicate 4 lines with `src/webview/components/FilterBar.tsx` (lines 88-91), format: tsx
- [fixed] Lines 150-155 duplicate 6 lines with `src/webview/components/FilterBar.tsx` (lines 144-149), format: tsx
- [fixed] Lines 155-159 duplicate 5 lines with `src/webview/components/FilterBar.tsx` (lines 55-59), format: tsx
- [fixed] Lines 183-189 duplicate 7 lines with `src/webview/components/database/calendarview/CalendarView.tsx` (lines 138-145), format: tsx
- [fixed] Lines 278-283 duplicate 6 lines with `src/webview/components/FilterBar.tsx` (lines 217-222), format: tsx

### src/webview/utils/calendarUtils.ts (1 matches)

- [fixed] Lines 34-48 duplicate 16 lines with `src/editor/date/dateFormat.ts` (lines 4-19), format: typescript

### src/webview/utils/filterSort.ts (1 matches)

- [fixed] Lines 72-76 duplicate 5 lines with `src/webview/utils/filterSort.ts` (lines 67-71), format: typescript
