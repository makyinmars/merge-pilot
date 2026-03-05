import type { DiffHunkLine, DiffSyntaxToken, SplitDiffRow, UnifiedDiffRow } from "@mergepilot/shared-types";
import type {
  LoadReviewSessionRequest,
  LoadReviewSessionResponse,
  ReviewFileView
} from "./ipc-contracts.js";

type DiffMode = "unified" | "split";

interface AppState {
  mode: DiffMode;
  session: LoadReviewSessionResponse | null;
  selectedFilePath: string | null;
  loading: boolean;
  errorMessage: string | null;
}

interface VirtualizedWindow {
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
}

const ROW_HEIGHT = 24;
const OVERSCAN_ROWS = 8;

const state: AppState = {
  mode: "split",
  session: null,
  selectedFilePath: null,
  loading: false,
  errorMessage: null
};

const sessionForm = requireElement<HTMLFormElement>("session-form");
const repositoryPathInput = requireElement<HTMLInputElement>("repository-path-input");
const baseRefInput = requireElement<HTMLInputElement>("base-ref-input");
const headRefInput = requireElement<HTMLInputElement>("head-ref-input");
const contextLinesInput = requireElement<HTMLInputElement>("context-lines-input");
const loadSessionButton = requireElement<HTMLButtonElement>("load-session-button");

const summaryCompared = requireElement<HTMLElement>("summary-compared");
const summaryFiles = requireElement<HTMLElement>("summary-files");
const summaryAdditions = requireElement<HTMLElement>("summary-additions");
const summaryDeletions = requireElement<HTMLElement>("summary-deletions");

const statusPill = requireElement<HTMLElement>("status-pill");
const fileList = requireElement<HTMLElement>("file-list");

const splitModeButton = requireElement<HTMLButtonElement>("mode-split-button");
const unifiedModeButton = requireElement<HTMLButtonElement>("mode-unified-button");

const previousHunkButton = requireElement<HTMLButtonElement>("previous-hunk-button");
const nextHunkButton = requireElement<HTMLButtonElement>("next-hunk-button");
const hunkAnchorStrip = requireElement<HTMLElement>("hunk-anchor-strip");

const diffScrollContainer = requireElement<HTMLElement>("diff-scroll-container");
const diffPaddingTop = requireElement<HTMLElement>("diff-padding-top");
const diffRows = requireElement<HTMLElement>("diff-rows");
const diffPaddingBottom = requireElement<HTMLElement>("diff-padding-bottom");

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element with id: ${id}`);
  }

  return element as T;
}

function clearElement(element: HTMLElement): void {
  element.replaceChildren();
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function getSelectedFile(): ReviewFileView | undefined {
  if (!state.session || !state.selectedFilePath) {
    return undefined;
  }

  return state.session.files.find((candidate) => candidate.file.path === state.selectedFilePath);
}

function setStatusPill(message: string, tone: "default" | "loading" | "error" | "ready"): void {
  statusPill.textContent = message;
  statusPill.classList.toggle("is-loading", tone === "loading");
  statusPill.classList.toggle("is-error", tone === "error");
  statusPill.classList.toggle("is-ready", tone === "ready");
}

function parseContextLines(input: string): number {
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed)) {
    return 3;
  }

  return Math.max(0, Math.min(20, parsed));
}

function buildRequestFromForm(): LoadReviewSessionRequest {
  const repositoryPath = repositoryPathInput.value.trim();
  const baseRef = baseRefInput.value.trim() || "HEAD";
  const headRefValue = headRefInput.value.trim();
  const headRef = headRefValue.length > 0 ? headRefValue : "WORKING_TREE";

  return {
    repositoryPath,
    baseRef,
    headRef,
    contextLines: parseContextLines(contextLinesInput.value)
  };
}

async function loadReviewSession(request: LoadReviewSessionRequest): Promise<void> {
  state.loading = true;
  state.errorMessage = null;
  setStatusPill("Loading", "loading");
  loadSessionButton.disabled = true;

  render();

  try {
    const response = await window.mergepilot.loadReviewSession(request);
    state.session = response;

    const previousSelection =
      state.selectedFilePath && response.files.some((fileView) => fileView.file.path === state.selectedFilePath)
        ? state.selectedFilePath
        : null;

    state.selectedFilePath = previousSelection ?? response.files[0]?.file.path ?? null;
    setStatusPill("Session Ready", "ready");
  } catch (error) {
    state.errorMessage = normalizeError(error);
    setStatusPill("Load Failed", "error");
  } finally {
    state.loading = false;
    loadSessionButton.disabled = false;
    render();
  }
}

function updateSummary(): void {
  if (!state.session) {
    summaryCompared.textContent = state.errorMessage ? `Error: ${state.errorMessage}` : "No session loaded";
    summaryFiles.textContent = "0";
    summaryAdditions.textContent = "0";
    summaryDeletions.textContent = "0";
    return;
  }

  const fileCount = state.session.diff.files.length;
  let additions = 0;
  let deletions = 0;

  for (const file of state.session.diff.files) {
    additions += file.additions;
    deletions += file.deletions;
  }

  const comparedAt = new Date(state.session.diff.comparedAt).toLocaleString();

  summaryCompared.textContent = `${state.session.diff.baseRef} -> ${state.session.diff.headRef} (${comparedAt})`;
  summaryFiles.textContent = String(fileCount);
  summaryAdditions.textContent = String(additions);
  summaryDeletions.textContent = String(deletions);
}

function renderFileList(): void {
  clearElement(fileList);

  if (!state.session) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = state.errorMessage ?? "Load a review session to inspect changed files.";
    fileList.append(empty);
    return;
  }

  if (state.session.files.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No changed files for this ref comparison.";
    fileList.append(empty);
    return;
  }

  for (const fileView of state.session.files) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "file-row";
    if (fileView.file.path === state.selectedFilePath) {
      row.classList.add("is-selected");
    }

    row.addEventListener("click", () => {
      state.selectedFilePath = fileView.file.path;
      diffScrollContainer.scrollTo({ top: 0, behavior: "auto" });
      render();
    });

    const header = document.createElement("div");
    header.className = "file-row-header";

    const path = document.createElement("p");
    path.className = "file-path";
    path.textContent = fileView.file.path;

    const status = document.createElement("span");
    status.className = `file-status file-status--${fileView.file.status}`;
    status.textContent = fileView.file.status;

    header.append(path, status);

    const stats = document.createElement("p");
    stats.className = "file-stats";
    stats.textContent = `+${fileView.file.additions} / -${fileView.file.deletions}`;

    row.append(header, stats);

    if (fileView.renderError) {
      const warning = document.createElement("p");
      warning.className = "file-stats";
      warning.textContent = `Rendering issue: ${fileView.renderError}`;
      row.append(warning);
    }

    fileList.append(row);
  }
}

function getRowsForSelectedFile(): Array<UnifiedDiffRow | SplitDiffRow> {
  const selected = getSelectedFile();
  if (!selected || !selected.views) {
    return [];
  }

  if (state.mode === "unified") {
    return selected.views.unified.rows;
  }

  return selected.views.split.rows;
}

function calculateVirtualizedWindow(totalRows: number, scrollTop: number, viewportHeight: number): VirtualizedWindow {
  if (totalRows <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0
    };
  }

  const firstVisibleRow = Math.floor(scrollTop / ROW_HEIGHT);
  const visibleRowCount = Math.max(1, Math.ceil(viewportHeight / ROW_HEIGHT));
  const startIndex = Math.max(0, firstVisibleRow - OVERSCAN_ROWS);
  const endIndex = Math.min(totalRows, firstVisibleRow + visibleRowCount + OVERSCAN_ROWS);

  return {
    startIndex,
    endIndex,
    paddingTop: startIndex * ROW_HEIGHT,
    paddingBottom: Math.max(0, (totalRows - endIndex) * ROW_HEIGHT)
  };
}

function appendTokens(container: HTMLElement, tokens: DiffSyntaxToken[], fallbackText: string): void {
  if (tokens.length === 0) {
    container.textContent = fallbackText;
    return;
  }

  for (const token of tokens) {
    const span = document.createElement("span");
    span.className = `token token--${token.kind}`;
    span.textContent = token.text;
    container.append(span);
  }
}

function createUnifiedDiffLineRow(row: UnifiedDiffRow): HTMLElement {
  const root = document.createElement("div");
  root.className = "diff-row";

  if (row.rowType === "file-meta") {
    root.classList.add("diff-row--file-meta");
    root.textContent = row.text ?? "";
    return root;
  }

  if (row.rowType === "hunk-header") {
    root.classList.add("diff-row--hunk-header");
    root.textContent = row.text ?? "";
    return root;
  }

  const line = row.line;
  if (!line) {
    root.classList.add("diff-row--meta");
    root.textContent = "Missing diff line payload.";
    return root;
  }

  root.classList.add(`diff-row--${line.lineType}`);

  const lineRoot = document.createElement("div");
  lineRoot.className = "unified-line";

  const lineNumbers = document.createElement("div");
  lineNumbers.className = "line-numbers";

  const oldLine = document.createElement("span");
  oldLine.textContent = line.oldLineNumber ? String(line.oldLineNumber) : "";

  const newLine = document.createElement("span");
  newLine.textContent = line.newLineNumber ? String(line.newLineNumber) : "";

  lineNumbers.append(oldLine, newLine);

  const symbol = document.createElement("div");
  symbol.className = "line-symbol";
  symbol.textContent = line.symbol;

  const content = document.createElement("div");
  content.className = "code-line";
  appendTokens(content, line.tokens, line.content);

  lineRoot.append(lineNumbers, symbol, content);
  root.append(lineRoot);

  return root;
}

function inferSplitLineType(row: SplitDiffRow): DiffHunkLine["lineType"] {
  const leftType = row.left?.lineType;
  const rightType = row.right?.lineType;

  if (leftType === "meta" || rightType === "meta") {
    return "meta";
  }

  if (leftType === "deletion" && rightType !== "addition") {
    return "deletion";
  }

  if (rightType === "addition" && leftType !== "deletion") {
    return "addition";
  }

  if (leftType === "deletion" || rightType === "addition") {
    return "context";
  }

  return leftType ?? rightType ?? "context";
}

function createSplitCell(
  cell: SplitDiffRow["left"],
  side: "left" | "right",
  fallbackSymbol: " " | "+" | "-"
): HTMLElement {
  const root = document.createElement("div");
  root.className = `split-cell split-cell--${side}`;

  if (!cell) {
    root.classList.add("split-cell--empty");

    const lineNumber = document.createElement("div");
    lineNumber.className = "line-number";

    const symbol = document.createElement("div");
    symbol.className = "cell-symbol";
    symbol.textContent = fallbackSymbol;

    const content = document.createElement("div");
    content.className = "cell-content";

    root.append(lineNumber, symbol, content);
    return root;
  }

  const lineNumber = document.createElement("div");
  lineNumber.className = "line-number";
  lineNumber.textContent = cell.lineNumber ? String(cell.lineNumber) : "";

  const symbol = document.createElement("div");
  symbol.className = "cell-symbol";
  symbol.textContent =
    cell.lineType === "addition" ? "+" : cell.lineType === "deletion" ? "-" : cell.lineType === "meta" ? "\\" : " ";

  const content = document.createElement("div");
  content.className = "cell-content";
  appendTokens(content, cell.tokens, cell.text);

  root.append(lineNumber, symbol, content);
  return root;
}

function createSplitDiffLineRow(row: SplitDiffRow): HTMLElement {
  const root = document.createElement("div");
  root.className = "diff-row";

  if (row.rowType === "file-meta") {
    root.classList.add("diff-row--file-meta");
    root.textContent = row.text ?? "";
    return root;
  }

  if (row.rowType === "hunk-header") {
    root.classList.add("diff-row--hunk-header");
    root.textContent = row.text ?? "";
    return root;
  }

  root.classList.add(`diff-row--${inferSplitLineType(row)}`);

  const lineRoot = document.createElement("div");
  lineRoot.className = "split-line";

  const leftSymbol = row.right?.lineType === "addition" && !row.left ? " " : "-";
  const rightSymbol = row.left?.lineType === "deletion" && !row.right ? " " : "+";

  lineRoot.append(createSplitCell(row.left, "left", leftSymbol), createSplitCell(row.right, "right", rightSymbol));
  root.append(lineRoot);

  return root;
}

function renderDiffRows(): void {
  clearElement(diffRows);

  const selected = getSelectedFile();
  if (!selected) {
    diffPaddingTop.style.height = "0px";
    diffPaddingBottom.style.height = "0px";

    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Select a changed file to inspect its diff.";
    diffRows.append(empty);
    return;
  }

  if (selected.renderError) {
    diffPaddingTop.style.height = "0px";
    diffPaddingBottom.style.height = "0px";

    const warning = document.createElement("p");
    warning.className = "empty-state";
    warning.textContent = selected.renderError;
    diffRows.append(warning);
    return;
  }

  if (!selected.views) {
    diffPaddingTop.style.height = "0px";
    diffPaddingBottom.style.height = "0px";

    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = selected.file.isBinary
      ? "Binary file: no text patch is available for this slice."
      : "No patch data is available for this file.";
    diffRows.append(empty);
    return;
  }

  const allRows = getRowsForSelectedFile();
  const viewportHeight = diffScrollContainer.clientHeight;
  const virtualizedWindow = calculateVirtualizedWindow(
    allRows.length,
    diffScrollContainer.scrollTop,
    viewportHeight
  );

  diffPaddingTop.style.height = `${virtualizedWindow.paddingTop}px`;
  diffPaddingBottom.style.height = `${virtualizedWindow.paddingBottom}px`;

  const visibleRows = allRows.slice(virtualizedWindow.startIndex, virtualizedWindow.endIndex);
  const fragment = document.createDocumentFragment();

  for (const row of visibleRows) {
    if (state.mode === "unified") {
      fragment.append(createUnifiedDiffLineRow(row as UnifiedDiffRow));
    } else {
      fragment.append(createSplitDiffLineRow(row as SplitDiffRow));
    }
  }

  diffRows.append(fragment);
}

function getAnchorsForSelectedFile(): Array<{ id: string; label: string; rowIndex: number }> {
  const selected = getSelectedFile();
  if (!selected?.views) {
    return [];
  }

  return state.mode === "unified"
    ? selected.views.navigation.unified.anchors
    : selected.views.navigation.split.anchors;
}

function getCurrentRowIndex(): number {
  return Math.max(0, Math.floor(diffScrollContainer.scrollTop / ROW_HEIGHT));
}

function getActiveAnchorIndex(anchors: Array<{ rowIndex: number }>): number {
  const currentRow = getCurrentRowIndex();
  let activeIndex = -1;

  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    if (anchor && anchor.rowIndex <= currentRow) {
      activeIndex = index;
    }
  }

  return activeIndex;
}

function scrollToRow(rowIndex: number): void {
  diffScrollContainer.scrollTo({
    top: rowIndex * ROW_HEIGHT,
    behavior: "smooth"
  });
}

function renderAnchors(): void {
  clearElement(hunkAnchorStrip);

  const anchors = getAnchorsForSelectedFile();
  if (anchors.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No hunks available for this file.";
    hunkAnchorStrip.append(empty);

    previousHunkButton.disabled = true;
    nextHunkButton.disabled = true;
    return;
  }

  const activeAnchorIndex = getActiveAnchorIndex(anchors);

  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    if (!anchor) {
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "hunk-anchor";
    button.textContent = anchor.label;

    if (index === activeAnchorIndex) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      scrollToRow(anchor.rowIndex);
    });

    hunkAnchorStrip.append(button);
  }

  previousHunkButton.disabled = activeAnchorIndex <= 0;
  nextHunkButton.disabled = activeAnchorIndex >= anchors.length - 1;
}

function jumpHunk(direction: -1 | 1): void {
  const anchors = getAnchorsForSelectedFile();
  if (anchors.length === 0) {
    return;
  }

  const activeAnchorIndex = getActiveAnchorIndex(anchors);
  const targetIndex =
    direction < 0
      ? Math.max(0, activeAnchorIndex - 1)
      : Math.min(anchors.length - 1, activeAnchorIndex + 1);

  const target = anchors[targetIndex];
  if (target) {
    scrollToRow(target.rowIndex);
  }
}

function updateModeButtons(): void {
  splitModeButton.classList.toggle("is-active", state.mode === "split");
  unifiedModeButton.classList.toggle("is-active", state.mode === "unified");
}

function render(): void {
  updateSummary();
  updateModeButtons();
  renderFileList();
  renderAnchors();
  renderDiffRows();
}

async function initialize(): Promise<void> {
  try {
    const defaultRepository = await window.mergepilot.getDefaultRepositoryPath();
    repositoryPathInput.value = defaultRepository.repositoryPath;
  } catch (error) {
    state.errorMessage = `Unable to determine default repository path: ${normalizeError(error)}`;
  }

  render();

  if (repositoryPathInput.value.trim().length > 0) {
    await loadReviewSession(buildRequestFromForm());
  }
}

sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const request = buildRequestFromForm();
  await loadReviewSession(request);
  diffScrollContainer.scrollTo({ top: 0, behavior: "auto" });
});

splitModeButton.addEventListener("click", () => {
  if (state.mode !== "split") {
    state.mode = "split";
    diffScrollContainer.scrollTo({ top: 0, behavior: "auto" });
    render();
  }
});

unifiedModeButton.addEventListener("click", () => {
  if (state.mode !== "unified") {
    state.mode = "unified";
    diffScrollContainer.scrollTo({ top: 0, behavior: "auto" });
    render();
  }
});

previousHunkButton.addEventListener("click", () => {
  jumpHunk(-1);
});

nextHunkButton.addEventListener("click", () => {
  jumpHunk(1);
});

diffScrollContainer.addEventListener("scroll", () => {
  renderAnchors();
  renderDiffRows();
});

void initialize();
