"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection,
  type OnConnect, type NodeMouseHandler,
  BackgroundVariant, Panel, SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Zap, Clock, GitBranch, Mail, MessageCircle,
  ArrowRightLeft, UserCheck, Square, Save, Loader2,
  Play, Pause, ChevronLeft, Copy, Trash2,
  RotateCcw, RotateCw, Pencil, Check, X,
  MousePointer2, Hand,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { nodeTypes } from "./nodes";
import { NodeConfigPanel } from "./node-config-panel";
import { NODE_DEFS, NodeType } from "@/lib/journeys/types";
import { updateJourneyAction, publishJourneyAction, pauseJourneyAction } from "@/app/(dashboard)/journeys/actions";
import { SendWindowConfig as SendWindowConfigPanel } from "@/components/journeys/send-window-config";
import type { SendWindowConfig } from "@/lib/journeys/send-window";

type PipelineStage  = { id: string; name: string }
type EmailTemplate  = { id: string; name: string; channel: string; subject: string; body: string; waType: string | null; mediaUrl: string | null; mediaCaption: string | null }
type AudienceOption = { id: string; name: string }

interface JourneyCanvasProps {
  journeyId:      string
  journeyName:    string
  journeyStatus:  string
  initialNodes:   Node[]
  initialEdges:   Edge[]
  pipelineStages: PipelineStage[]
  emailTemplates: EmailTemplate[]
  audiences:      AudienceOption[]
  consultants:    string[]
  sendWindow:     SendWindowConfig | null
}

const ICON_MAP: Record<NodeType, React.ReactNode> = {
  trigger:      <Zap size={13} />,
  wait:         <Clock size={13} />,
  condition:    <GitBranch size={13} />,
  email:        <Mail size={13} />,
  whatsapp:     <MessageCircle size={13} />,
  changeStatus: <ArrowRightLeft size={13} />,
  assign:       <UserCheck size={13} />,
  end:          <Square size={13} />,
};

type Snapshot    = { nodes: Node[]; edges: Edge[] }
type ContextMenu = { x: number; y: number; node: Node }

let nodeIdCounter = Date.now();
function newId() { return `node-${++nodeIdCounter}`; }

export function JourneyCanvas({
  journeyId, journeyName, journeyStatus,
  initialNodes, initialEdges,
  pipelineStages, emailTemplates, audiences, consultants,
  sendWindow,
}: JourneyCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode,       setSelectedNode]       = useState<Node | null>(null);
  const [multiSelectedNodes, setMultiSelectedNodes] = useState<Node[]>([]);
  const [panMode,            setPanMode]            = useState(false);
  const [confirmBulkDelete,  setConfirmBulkDelete]  = useState(false);
  const [isSaving,  startSave]    = useTransition();
  const [isPublish, startPublish] = useTransition();
  const [isRename,  startRename]  = useTransition();

  const [name,        setName]        = useState(journeyName);
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState(journeyName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Context menu
  const [contextMenu,      setContextMenu]      = useState<ContextMenu | null>(null);
  const [confirmCtxDelete, setConfirmCtxDelete] = useState(false);

  // Copy/paste
  const [copiedNode, setCopiedNode] = useState<Node | null>(null);

  // ── Undo / Redo stacks ────────────────────────────────────────────────────
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Refs always hold latest state (needed in stable callbacks like onNodeDragStart)
  const latestNodes = useRef(nodes);
  const latestEdges = useRef(edges);
  latestNodes.current = nodes;
  latestEdges.current = edges;

  function pushUndo() {
    undoStack.current.push({ nodes: latestNodes.current, edges: latestEdges.current });
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    if (!undoStack.current.length) return;
    redoStack.current.push({ nodes: latestNodes.current, edges: latestEdges.current });
    const prev = undoStack.current.pop()!;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setSelectedNode(null);
    closeContextMenu();
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }

  function redo() {
    if (!redoStack.current.length) return;
    undoStack.current.push({ nodes: latestNodes.current, edges: latestEdges.current });
    const next = redoStack.current.pop()!;
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNode(null);
    closeContextMenu();
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }

  // ── Node operations ───────────────────────────────────────────────────────

  function addNode(type: NodeType) {
    if (type === "trigger" && nodes.some((n) => n.type === "trigger")) {
      toast.error("Cada jornada pode ter apenas 1 gatilho. Para múltiplos públicos, selecione-os dentro do nó de gatilho.");
      return;
    }
    pushUndo();
    const def = NODE_DEFS.find((d) => d.type === type)!;
    const x = (reactFlowWrapper.current?.getBoundingClientRect().width ?? 600) / 2 - 90 + Math.random() * 40 - 20;
    const y = 100 + nodes.length * 120;
    setNodes((nds) => [...nds, { id: newId(), type, position: { x, y }, data: { ...def.defaultData } }]);
  }

  function deleteNode(id: string) {
    pushUndo();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode((prev) => prev?.id === id ? null : prev);
    closeContextMenu();
  }

  function duplicateNode(node: Node) {
    pushUndo();
    const copy: Node = {
      id:       newId(),
      type:     node.type,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data:     { ...node.data },
    };
    setNodes((nds) => [...nds, copy]);
    closeContextMenu();
    toast.success("Nó duplicado");
  }

  function bulkDuplicateNodes(nodesToDup: Node[]) {
    if (!nodesToDup.length) return;
    pushUndo();
    const copies = nodesToDup.map((n) => ({
      id:       newId(),
      type:     n.type,
      position: { x: n.position.x + 40, y: n.position.y + 40 },
      data:     { ...n.data },
    }));
    setNodes((nds) => [...nds, ...copies]);
    toast.success(`${copies.length} nó${copies.length !== 1 ? "s" : ""} duplicado${copies.length !== 1 ? "s" : ""}`);
  }

  function bulkDeleteNodes(nodesToDel: Node[]) {
    if (!nodesToDel.length) return;
    pushUndo();
    const ids = new Set(nodesToDel.map((n) => n.id));
    setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
    setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setMultiSelectedNodes([]);
    setSelectedNode(null);
    setConfirmBulkDelete(false);
    toast.success(`${ids.size} nó${ids.size !== 1 ? "s" : ""} removido${ids.size !== 1 ? "s" : ""}`);
  }

  function selectAllNodes() {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
  }

  function updateNodeData(id: string, data: Record<string, unknown>) {
    pushUndo();
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data } : n));
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data } : prev);
  }

  // Save snapshot before drag (stable callback via latestNodes/latestEdges refs)
  const onNodeDragStart = useCallback(() => {
    undoStack.current.push({ nodes: latestNodes.current, edges: latestEdges.current });
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // ── Context menu ──────────────────────────────────────────────────────────

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, node });
    setConfirmCtxDelete(false);
    setSelectedNode(node);
  }, []);

  function closeContextMenu() {
    setContextMenu(null);
    setConfirmCtxDelete(false);
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const multiSelectedRef = useRef<Node[]>([]);
  multiSelectedRef.current = multiSelectedNodes;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const tag  = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (meta && e.shiftKey && e.key === "z") { e.preventDefault(); redo(); return; }
      if (meta && e.key === "z")               { e.preventDefault(); undo(); return; }
      if (meta && e.key === "y")               { e.preventDefault(); redo(); return; }
      if (meta && e.key === "a")               { e.preventDefault(); selectAllNodes(); return; }
      if (meta && e.key === "c" && selectedNode) { setCopiedNode(selectedNode); toast.success("Nó copiado"); return; }
      if (meta && e.key === "v" && copiedNode)   { duplicateNode(copiedNode); return; }
      if (e.key === "s" || e.key === "S")      { setPanMode(false); return; }
      if (e.key === "h" || e.key === "H")      { setPanMode(true); return; }
      if (e.key === "Escape") { closeContextMenu(); setConfirmBulkDelete(false); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode, copiedNode, canUndo, canRedo]);

  // ── Connect ───────────────────────────────────────────────────────────────

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    pushUndo();
    setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save / Publish ────────────────────────────────────────────────────────

  function handleSave() {
    startSave(async () => {
      try {
        await updateJourneyAction(journeyId, {
          nodes: nodes as unknown as object[],
          edges: edges as unknown as object[],
        });
        toast.success("Jornada salva");
      } catch { toast.error("Erro ao salvar") }
    });
  }

  function handlePublish() {
    startPublish(async () => {
      try {
        if (journeyStatus === "ACTIVE") {
          await pauseJourneyAction(journeyId);
          toast.success("Jornada pausada");
        } else {
          await publishJourneyAction(journeyId);
          toast.success("Jornada publicada");
        }
      } catch { toast.error("Erro ao alterar status") }
    });
  }

  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setMultiSelectedNodes(sel);
    setConfirmBulkDelete(false);
    if (sel.length === 1) setSelectedNode(sel[0]);
    else if (sel.length === 0) setSelectedNode(null);
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNode(node);
    closeContextMenu();
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setMultiSelectedNodes([]);
    setConfirmBulkDelete(false);
    closeContextMenu();
  }, []);

  function startEditName() {
    setNameInput(name);
    setEditingName(true);
    setTimeout(() => { nameInputRef.current?.select(); }, 0);
  }

  function cancelEditName() {
    setEditingName(false);
    setNameInput(name);
  }

  function commitName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === name) { cancelEditName(); return; }
    setEditingName(false);
    setName(trimmed);
    startRename(async () => {
      try {
        await updateJourneyAction(journeyId, { name: trimmed });
      } catch {
        setName(name);
        toast.error("Erro ao renomear jornada");
      }
    });
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter")  { e.preventDefault(); commitName(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEditName(); }
  }

  const isActive = journeyStatus === "ACTIVE";

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)]">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shrink-0">
        <Link href="/journeys" className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={15} />
          Jornadas
        </Link>
        <span className="text-[var(--border)]">/</span>

        {/* Inline journey name edit */}
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={commitName}
              className="h-7 rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-2 text-sm font-medium text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-w-0 w-48"
            />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commitName(); }}
              className="text-[#10b981] hover:text-[#059669] p-0.5"
              title="Confirmar"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); cancelEditName(); }}
              className="text-[var(--text-muted)] hover:text-[var(--danger)] p-0.5"
              title="Cancelar"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditName}
            className="group flex items-center gap-1.5 text-sm font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors truncate max-w-xs"
            title="Clique para renomear"
          >
            <span className="truncate">{name}</span>
            <Pencil size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
          isActive
            ? "bg-[#10b981]/15 text-[#10b981]"
            : journeyStatus === "PAUSED"
            ? "bg-[#f59e0b]/15 text-[#f59e0b]"
            : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
        }`}>
          {isActive ? "Ativo" : journeyStatus === "PAUSED" ? "Pausado" : "Rascunho"}
        </span>

        {copiedNode && (
          <span className="text-xs text-[var(--text-muted)] ml-1">
            📋 Nó copiado — ⌘V para colar
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center border border-[var(--border)] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Desfazer (⌘Z)"
              className="flex items-center justify-center h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw size={13} />
            </button>
            <div className="w-px h-4 bg-[var(--border)]" />
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Refazer (⌘⇧Z)"
              className="flex items-center justify-center h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCw size={13} />
            </button>
          </div>

          {/* Mode toggle: select ↔ pan */}
          <div className="flex items-center border border-[var(--border)] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPanMode(false)}
              title="Modo seleção (S)"
              className={`flex items-center justify-center h-8 w-8 transition-colors ${
                !panMode
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              }`}
            >
              <MousePointer2 size={13} />
            </button>
            <div className="w-px h-4 bg-[var(--border)]" />
            <button
              type="button"
              onClick={() => setPanMode(true)}
              title="Modo mão — pan (H ou Espaço)"
              className={`flex items-center justify-center h-8 w-8 transition-colors ${
                panMode
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              }`}
            >
              <Hand size={13} />
            </button>
          </div>

          <SendWindowConfigPanel journeyId={journeyId} initialConfig={sendWindow} />

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-8 rounded-xl border border-[var(--border)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublish}
            className={`flex items-center gap-1.5 h-8 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              isActive
                ? "border border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b]/10"
                : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
            }`}
          >
            {isActive ? <Pause size={13} /> : <Play size={13} />}
            {isActive ? "Pausar" : "Publicar"}
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Node palette */}
        <div className="w-44 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1 pb-1">Nós</p>
          {NODE_DEFS.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => addNode(def.type)}
              className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-[var(--surface-muted)] transition-colors group"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${def.color}18`, color: def.color }}
              >
                {ICON_MAP[def.type]}
              </span>
              <p className="text-xs font-medium text-[var(--text)]">{def.label}</p>
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDragStart={onNodeDragStart}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode={null}
            selectionOnDrag={!panMode}
            panOnDrag={panMode}
            panActivationKeyCode=" "
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Shift"
            className="bg-[var(--bg)]"
            defaultEdgeOptions={{ animated: true, style: { stroke: "var(--accent)", strokeWidth: 2 } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
            <Controls className="[&>button]:!bg-[var(--surface)] [&>button]:!border-[var(--border)] [&>button]:!text-[var(--text)]" />
            <MiniMap
              nodeColor={(n) => {
                const def = NODE_DEFS.find((d) => d.type === n.type);
                return def?.color ?? "#6366f1";
              }}
              className="!bg-[var(--surface)] !border !border-[var(--border)]"
            />
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-32 text-center pointer-events-none">
                  <p className="text-[var(--text-muted)] text-sm">Clique em um nó à esquerda para adicionar ao canvas</p>
                  <p className="text-[var(--text-muted)] text-xs mt-1">Conecte os nós arrastando de uma saída para uma entrada</p>
                </div>
              </Panel>
            )}

            {/* Floating bulk action bar */}
            {multiSelectedNodes.length > 1 && (
              <Panel position="bottom-center">
                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-lg">
                  <span className="text-sm font-medium text-[var(--text)] mr-1">
                    {multiSelectedNodes.length} nós selecionados
                  </span>
                  <div className="w-px h-4 bg-[var(--border)]" />
                  <button
                    type="button"
                    onClick={() => bulkDuplicateNodes(multiSelectedNodes)}
                    className="flex items-center gap-1.5 h-7 rounded-lg px-2.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--accent)] transition-colors"
                  >
                    <Copy size={12} />
                    Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; }
                      bulkDeleteNodes(multiSelectedNodes);
                    }}
                    onBlur={() => setConfirmBulkDelete(false)}
                    className={`flex items-center gap-1.5 h-7 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                      confirmBulkDelete
                        ? "bg-[var(--danger)] text-white"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--danger)]"
                    }`}
                  >
                    <Trash2 size={12} />
                    {confirmBulkDelete ? "Confirmar" : "Excluir"}
                  </button>
                  <div className="w-px h-4 bg-[var(--border)]" />
                  <button
                    type="button"
                    onClick={() => { setMultiSelectedNodes([]); setNodes(nds => nds.map(n => ({ ...n, selected: false }))); }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </Panel>
            )}
          </ReactFlow>

          {/* Context menu */}
          {contextMenu && (
            <div
              className="fixed z-50 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden py-1"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              <button
                type="button"
                onClick={() => duplicateNode(contextMenu.node)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                <Copy size={13} className="text-[var(--accent)]" />
                Duplicar nó
                <span className="ml-auto text-xs text-[var(--text-muted)]">⌘C ⌘V</span>
              </button>
              <div className="h-px bg-[var(--border)] mx-2 my-1" />
              <button
                type="button"
                onClick={() => {
                  if (!confirmCtxDelete) { setConfirmCtxDelete(true); return; }
                  deleteNode(contextMenu.node.id);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  confirmCtxDelete
                    ? "bg-[var(--danger)] text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                }`}
              >
                <Trash2 size={13} />
                {confirmCtxDelete ? "Confirmar remoção" : "Remover nó"}
                {!confirmCtxDelete && <span className="ml-auto text-xs">Del</span>}
              </button>
            </div>
          )}
        </div>

        {/* Config panel */}
        {selectedNode && (
          <div className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <NodeConfigPanel
              node={selectedNode}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
              onDuplicate={duplicateNode}
              onClose={() => setSelectedNode(null)}
              pipelineStages={pipelineStages}
              emailTemplates={emailTemplates}
              audiences={audiences}
              consultants={consultants}
            />
          </div>
        )}
      </div>
    </div>
  );
}
