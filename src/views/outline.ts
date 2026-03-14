
import {
  EventEmitter,
  Position,
  Range,
  Selection,
  TextEditorRevealType,
  ThemeColor,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
} from "../hostEditor/EditorTypes";
import type { TextDocument, TreeDataProvider } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";

// ── Heading outline tree view ──────────────────────────────────────
//
// Shows document headings in the sidebar as a navigable tree.
// Clicking a heading reveals it in the editor.

interface HeadingNode {
  label: string;
  level: number;
  line: number;
  children: HeadingNode[];
}

class HeadingItem extends TreeItem {
  constructor(
    public readonly heading: HeadingNode,
    public readonly collapsibleState: TreeItemCollapsibleState,
  ) {
    super(heading.label, collapsibleState);
    this.tooltip = `Line ${heading.line + 1}`;
    this.description = `H${heading.level}`;

    // Per-level icons and colours for visual heading hierarchy
    const LEVEL_ICONS: Record<number, { icon: string; color: string }> = {
      1: { icon: "symbol-class", color: "charts.red" },
      2: { icon: "symbol-method", color: "charts.orange" },
      3: { icon: "symbol-function", color: "charts.purple" },
      4: { icon: "symbol-field", color: "charts.blue" },
      5: { icon: "symbol-variable", color: "charts.green" },
      6: { icon: "symbol-key", color: "charts.yellow" },
    };
    const info = LEVEL_ICONS[heading.level] ?? { icon: "symbol-field", color: "foreground" };
    this.iconPath = new ThemeIcon(info.icon, new ThemeColor(info.color));

    this.command = {
      command: Cmd.revealHeading,
      title: "Go to heading",
      arguments: [heading.line],
    };
  }
}

export class HeadingOutlineProvider implements TreeDataProvider<HeadingItem> {
  private _onDidChange = new EventEmitter<HeadingItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: HeadingItem): TreeItem {
    return element;
  }

  getChildren(element?: HeadingItem): HeadingItem[] {
    if (!element) {
      // Root level — get top-level headings from the active editor
      if (!hostEditor.isMarkdownEditor()) {
        return [];
      }
      const doc = hostEditor.getDocument()!;
      const tree = buildHeadingTree(doc);
      return tree.map(nodeToItem);
    }

    // Children of a heading
    return element.heading.children.map(nodeToItem);
  }
}

function nodeToItem(node: HeadingNode): HeadingItem {
  const state = node.children.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None;
  return new HeadingItem(node, state);
}

function buildHeadingTree(document: TextDocument): HeadingNode[] {
  const headings: HeadingNode[] = [];
  const HEADING_RE = Regex.headingLineWithText;

  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text;
    // Skip headings inside code blocks
    if (isInsideFence(document, i)) {
      continue;
    }

    const match = text.match(HEADING_RE);
    if (match) {
      headings.push({
        label: match[2].trim(),
        level: match[1].length,
        line: i,
        children: [],
      });
    }
  }

  // Build tree by nesting children under parents
  return nestHeadings(headings);
}

function nestHeadings(flat: HeadingNode[]): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const node of flat) {
    // Pop stack until we find a parent with a lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

function isInsideFence(document: TextDocument, line: number): boolean {
  let fenceCount = 0;
  for (let i = 0; i < line; i++) {
    if (Regex.fencedBackticksOnly.test(document.lineAt(i).text.trim())) {
      fenceCount++;
    }
  }
  return fenceCount % 2 !== 0;
}

export function revealHeading(line: number): void {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }

  const pos = new Position(line, 0);
  hostEditor.setSelection(new Selection(pos, pos));
  hostEditor.revealRange(new Range(pos, pos), TextEditorRevealType.InCenter);
}
