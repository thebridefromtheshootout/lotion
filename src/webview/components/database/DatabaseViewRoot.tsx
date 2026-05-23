import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DbColumn, DbEntryData, DbViewData, LayoutKind, FilterGroup, FilterNode, isLeaf, GraphLink } from "../../types";
import { matchesFilters, compareFn } from "../../utils/filterSort";
import { entriesToCsv } from "../../utils/csv";
import { DbPanelToExtensionCommunicator } from "../../communicators/DbPanelToExtensionCommunicator";
import { Toolbar } from "./Toolbar";
import { FilterBar } from "../FilterBar";
import { TableView } from "./tableview/TableView";
import { KanbanView } from "./KanbanView";
import { CalendarView } from "./calendarview/CalendarView";
import { GraphView } from "./GraphView";
import { MapView } from "./MapView";
import type { DbViewFilter } from "../../../contracts/databaseTypes";
import { Icon } from "../Icon";

const communicator = new DbPanelToExtensionCommunicator();

export function DatabaseViewRoot() {
  // ── Data from extension host ──
  const [schema, setSchema] = useState<DbColumn[]>([]);
  const [allEntries, setAllEntries] = useState<DbEntryData[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [views, setViews] = useState<DbViewData[]>([]);
  const [titleFieldLabel, setTitleFieldLabel] = useState("Title");
  const [dbName, setDbName] = useState("");
  const [baseUri, setBaseUri] = useState("");

  // ── View state ──
  const [layout, setLayout] = useState<LayoutKind>("table");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterTree, setFilterTree] = useState<FilterGroup>({ logic: "AND", clauses: [] });
  const [kanbanGroupCol, setKanbanGroupCol] = useState<string | undefined>(undefined);
  const [calendarDateCol, setCalendarDateCol] = useState<string | undefined>(undefined);
  const [calendarEndDateCol, setCalendarEndDateCol] = useState<string | undefined>(undefined);
  const [activeViewName, setActiveViewName] = useState("");
  const [ready, setReady] = useState(false);

  // ── Apply a saved view ──
  const applyView = useCallback((v: DbViewData, cols: DbColumn[]) => {
    setSortCol(v.sortCol ?? null);
    setSortDir(v.sortDir ?? "asc");

    if (v.filterTree) {
      setFilterTree(structuredClone(v.filterTree));
    } else if (v.filters && v.filters.length > 0) {
      setFilterTree({
        logic: "AND",
        clauses: v.filters.map((f) => ({ col: f.col, op: f.op || "contains", value: f.value })),
      });
    } else {
      setFilterTree({ logic: "AND", clauses: [] });
    }

    if (v.layout) setLayout(v.layout);
    if (v.kanbanGroupCol) setKanbanGroupCol(v.kanbanGroupCol);
    if (v.calendarDateCol) setCalendarDateCol(v.calendarDateCol);
    if (v.calendarEndDateCol) setCalendarEndDateCol(v.calendarEndDateCol);
  }, []);

  // ── Register communicator listeners + signal ready ──
  useEffect(() => {
    communicator.registerOnInit((msg) => {
      setSchema(msg.schema);
      setAllEntries(msg.entries);
      setLinks(msg.links || []);
      setViews(msg.views);
      setTitleFieldLabel(msg.titleFieldLabel);
      setDbName(msg.dbName);
      setBaseUri(msg.baseUri || "");

      // Set defaults for kanban/calendar
      const selectCols = msg.schema.filter((c: DbColumn) => c.type === "select");
      const dateCols = msg.schema.filter((c: DbColumn) => c.type === "date");
      if (selectCols.length > 0) setKanbanGroupCol(selectCols[0].name);
      if (dateCols.length >= 1) setCalendarDateCol(dateCols[0].name);
      if (dateCols.length >= 2) setCalendarEndDateCol(dateCols[1].name);

      // Load default view
      const def = msg.views.find((v: DbViewData) => v.default);
      if (def) {
        applyView(def, msg.schema);
        setActiveViewName(def.name);
      }

      setReady(true);
    });

    communicator.registerOnUpdateEntries((msg) => {
      setAllEntries(msg.entries);
    });

    // Request init payload once webview is mounted to avoid racing the first postMessage.
    communicator.sendReady();
  }, [applyView]);

  // ── Derived: filtered + sorted entries ──
  const entries = useMemo(() => {
    let result = allEntries.filter((e) => matchesFilters(e, filterTree));
    if (sortCol) result = [...result].sort(compareFn(sortCol, sortDir));
    return result;
  }, [allEntries, filterTree, sortCol, sortDir]);

  // ── Toggle sort ──
  const toggleSort = useCallback((col: string) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return col;
      }
      setSortDir("asc");
      return col;
    });
  }, []);

  // ── Load view ──
  const handleLoadView = useCallback(
    (name: string) => {
      setActiveViewName(name);
      if (!name) {
        setSortCol(null);
        setSortDir("asc");
        setFilterTree({ logic: "AND", clauses: [] });
        return;
      }
      const v = views.find((sv) => sv.name === name);
      if (v) applyView(v, schema);
    },
    [views, schema, applyView],
  );

  // ── Optimistic local update: patch a single entry's property ──
  const handleLocalEntryUpdate = useCallback((relPath: string, colName: string, newVal: string) => {
    setAllEntries((prev) =>
      prev.map((e) => (e.relativePath === relPath ? { ...e, properties: { ...e.properties, [colName]: newVal } } : e)),
    );
  }, []);

  // ── Copy active view as CSV ──
  const handleCopyViewAsCsv = useCallback(() => {
    const csv = entriesToCsv(entries, schema, titleFieldLabel);
    const label = activeViewName ? `view "${activeViewName}" as CSV` : "view as CSV";
    communicator.sendCopyToClipboard(csv, label);
  }, [entries, schema, titleFieldLabel, activeViewName]);

  // ── Save view ──
  const handleSaveView = useCallback(() => {
    const flatFilters: DbViewFilter[] = [];
    function collectLeaves(node: FilterNode) {
      if (isLeaf(node)) {
        flatFilters.push({ col: node.col, op: node.op || "contains", value: node.value });
        return;
      }
      node.clauses.forEach(collectLeaves);
    }
    collectLeaves(filterTree);

    communicator.sendPromptSaveView({
      sortCol,
      sortDir,
      filters: flatFilters,
      filterTree: structuredClone(filterTree),
      layout,
      kanbanGroupCol,
      calendarDateCol,
      calendarEndDateCol,
    });
  }, [filterTree, sortCol, sortDir, layout, kanbanGroupCol, calendarDateCol, calendarEndDateCol]);

  if (!ready) return null;

  const noEntries = allEntries.length === 0;
  const noResults = entries.length === 0 && !noEntries;

  return (
    <>
      <h2>
        <Icon name="database" /> {dbName}
      </h2>
      <Toolbar
        layout={layout}
        setLayout={setLayout}
        schema={schema}
        views={views}
        activeViewName={activeViewName}
        onLoadView={handleLoadView}
        onSaveView={handleSaveView}
        onCopyViewAsCsv={handleCopyViewAsCsv}
        communicator={communicator}
      />
      <FilterBar
        schema={schema}
        titleFieldLabel={titleFieldLabel}
        filterTree={filterTree}
        setFilterTree={setFilterTree}
      />
      {noEntries ? (
        <div className="empty-state">No entries yet. Click "New Entry" to add one.</div>
      ) : noResults ? (
        <div className="empty-state">No entries match the active filters.</div>
      ) : layout === "kanban" ? (
        <KanbanView
          entries={entries}
          schema={schema}
          kanbanGroupCol={kanbanGroupCol || ""}
          onKanbanGroupColChange={setKanbanGroupCol}
          baseUri={baseUri}
          communicator={communicator}
        />
      ) : layout === "calendar" ? (
        <CalendarView
          entries={entries}
          schema={schema}
          calendarDateCol={calendarDateCol || ""}
          calendarEndDateCol={calendarEndDateCol}
          onCalendarDateColChange={setCalendarDateCol}
          onCalendarEndDateColChange={setCalendarEndDateCol}
          communicator={communicator}
        />
      ) : layout === "graph" ? (
        <GraphView entries={entries} links={links} communicator={communicator} />
      ) : layout === "map" ? (
        <MapView entries={entries} schema={schema} communicator={communicator} />
      ) : (
        <TableView
          entries={entries}
          schema={schema}
          titleFieldLabel={titleFieldLabel}
          sortCol={sortCol}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          onLocalEntryUpdate={handleLocalEntryUpdate}
          baseUri={baseUri}
          dbName={dbName}
          communicator={communicator}
        />
      )}
    </>
  );
}
