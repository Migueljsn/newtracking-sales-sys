"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge, type Connection, type OnConnect,
  BackgroundVariant, Panel, SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Zap, MessageCircle, HelpCircle, GitBranch, ArrowRightLeft,
  UserCheck, UserPlus, ExternalLink, Save, Loader2,
  Play, Pause, ChevronLeft, Copy, Trash2, RotateCcw, RotateCw,
  Pencil, Check, X, MousePointer2, Hand, Clock, Bot,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { flowNodeTypes } from "./nodes";
import { FlowEdge } from "./flow-edge";
import { FlowNodeConfigPanel } from "./flow-node-config-panel";
import { FLOW_NODE_DEFS, type FlowNodeType } from "@/lib/flows/types";
import { updateFlowAction, publishFlowAction, pauseFlowAction } from "@/app/(dashboard)/flows/actions";

type AudienceOption = { id: string; name: string }
type PipelineStage  = { id: string; name: string }
type FlowOption     = { id: string; name: string }
type AgentOption    = { id: string; name: string }

interface FlowCanvasProps {
  flowId:         string
  flowName:       string
  flowStatus:     string
  initialNodes:   Node[]
  initialEdges:   Edge[]
  audiences:      AudienceOption[]
  pipelineStages: PipelineStage[]
  consultants:    string[]
  flows:          FlowOption[]   // outros fluxos (para startFlow node)
  agents:         AgentOption[]  // agentes IA (para nó message/question modo IA)
}

const ICON_MAP: Record<FlowNodeType, React.ReactNode> = {
  trigger:       <Zap           size={13} />,
  message:       <MessageCircle size={13} />,
  question:      <HelpCircle    size={13} />,
  condition:     <GitBranch     size={13} />,
  changeStatus:  <ArrowRightLeft size={13} />,
  assign:        <UserCheck     size={13} />,
  addToAudience: <UserPlus      size={13} />,
  startFlow:     <ExternalLink  size={13} />,
  wait:          <Clock         size={13} />,
  activateAgent: <Bot           size={13} />,
};

type Snapshot    = { nodes: Node[]; edges: Edge[] }
type ContextMenu = { x: number; y: number; node: Node }

const NODE_COLORS: Record<string, string> = {
  trigger:       "#6366f1",
  message:       "#10b981",
  question:      "#0ea5e9",
  condition:     "#8b5cf6",
  changeStatus:  "#f97316",
  assign:        "#06b6d4",
  addToAudience: "#a855f7",
  startFlow:     "#ec4899",
  wait:          "#f59e0b",
  activateAgent: "#22d3ee",
};

function AutoFitView() {
  const { fitView } = useReactFlow();
  useEffect(() => { requestAnimationFrame(() => fitView({ padding: 0.15 })); }, []);
  return null;
}

type PositionFn = (screen: { x: number; y: number }) => { x: number; y: number };

function ViewportHelper({ posRef }: { posRef: React.MutableRefObject<PositionFn | null> }) {
  const { screenToFlowPosition } = useReactFlow();
  useEffect(() => { posRef.current = screenToFlowPosition; }, [screenToFlowPosition, posRef]);
  return null;
}

let nodeIdCounter = Date.now();
function newId() { return `node-${++nodeIdCounter}`; }

export function FlowCanvas({
  flowId, flowName, flowStatus,
  initialNodes, initialEdges,
  audiences, pipelineStages, consultants, flows, agents,
}: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges.map((e) => ({ ...e, type: "default" }))
  );
  const [selectedNode,      setSelectedNode]      = useState<Node | null>(null);
  const [panMode,           setPanMode]           = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [status,    setStatus]    = useState(flowStatus);
  const [isSaving,  startSave]    = useTransition();
  const [isPublish, startPublish] = useTransition();
  const [isRename,  startRename]  = useTransition();
  const [name,        setName]        = useState(flowName);
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState(flowName);
  const nameInputRef  = useRef<HTMLInputElement>(null);
  const [contextMenu,      setContextMenu]      = useState<ContextMenu | null>(null);
  const [confirmCtxDelete, setConfirmCtxDelete] = useState(false);
  const [copiedNode,       setCopiedNode]       = useState<Node | null>(null);

  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const latestNodes = useRef(nodes);
  const latestEdges = useRef(edges);
  latestNodes.current = nodes;
  latestEdges.current = edges;

  function pushUndo() {
    undoStack.current.push({ nodes: latestNodes.current, edges: latestEdges.current });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    const snap = undoStack.current.pop();
    if (!snap) return;
    redoStack.current.push({ nodes: latestNodes.current, edges: latestEdges.current });
    setNodes(snap.nodes); setEdges(snap.edges.map((e) => ({ ...e, type: "default" })));
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }

  function redo() {
    const snap = redoStack.current.pop();
    if (!snap) return;
    undoStack.current.push({ nodes: latestNodes.current, edges: latestEdges.current });
    setNodes(snap.nodes); setEdges(snap.edges.map((e) => ({ ...e, type: "default" })));
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }

  const edgeTypes   = { default: FlowEdge };
  const screenToFlowRef = useRef<PositionFn | null>(null);

  const onConnect: OnConnect = useCallback((conn: Connection) => {
    pushUndo();
    setEdges((eds) => addEdge({ ...conn, animated: false, type: "default" }, eds));
  }, [setEdges]);

  function addNode(type: FlowNodeType) {
    const def = FLOW_NODE_DEFS.find((d) => d.type === type)!;

    let position = { x: 300 + Math.random() * 80, y: 150 + Math.random() * 80 };
    if (screenToFlowRef.current) {
      const canvas = document.querySelector(".react-flow");
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        const center = screenToFlowRef.current({
          x: r.left + r.width  / 2,
          y: r.top  + r.height / 2,
        });
        position = { x: center.x + (Math.random() * 40 - 20), y: center.y + (Math.random() * 40 - 20) };
      }
    }

    const node: Node = { id: newId(), type, position, data: { ...def.defaultData } };
    pushUndo();
    setNodes((ns) => [...ns, node]);
  }

  function updateNode(id: string, data: Record<string, unknown>) {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data } : n));
  }

  function deleteNode(id: string) {
    if (nodes.find((n) => n.id === id)?.type === "trigger") return;
    pushUndo();
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
  }

  function duplicateNode(node: Node) {
    const copy: Node = {
      ...node,
      id:       newId(),
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      selected: false,
    };
    pushUndo();
    setNodes((ns) => [...ns, copy]);
  }

  function deleteSelected() {
    const selected = nodes.filter((n) => n.selected && n.type !== "trigger");
    if (!selected.length) return;
    pushUndo();
    const ids = new Set(selected.map((n) => n.id));
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
    setEdges((es) => es.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setConfirmBulkDelete(false);
  }

  function handleSave() {
    startSave(async () => {
      try {
        await updateFlowAction(flowId, { nodes: latestNodes.current, edges: latestEdges.current });
        toast.success("Fluxo salvo");
      } catch { toast.error("Erro ao salvar"); }
    });
  }

  function handleToggleStatus() {
    startPublish(async () => {
      try {
        if (status === "ACTIVE") {
          await pauseFlowAction(flowId);
          setStatus("PAUSED");
          toast.success("Fluxo pausado");
        } else {
          await updateFlowAction(flowId, { nodes: latestNodes.current, edges: latestEdges.current });
          await publishFlowAction(flowId);
          setStatus("ACTIVE");
          toast.success("Fluxo ativado");
        }
      } catch { toast.error("Erro ao alterar status"); }
    });
  }

  function commitRename() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === name) { setEditingName(false); return; }
    startRename(async () => {
      try {
        await updateFlowAction(flowId, { name: trimmed });
        setName(trimmed);
        setEditingName(false);
        toast.success("Nome atualizado");
      } catch { toast.error("Erro ao renomear"); }
    });
  }

  const multiSelected = nodes.filter((n) => n.selected);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg)]">

      {/* ── Paleta lateral ────────────────────────────────────────────────── */}
      <aside className="no-print w-52 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
        <div className="p-3 border-b border-[var(--border)]">
          <Link href="/flows" className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
            <ChevronLeft size={14} />
            Voltar para Fluxos
          </Link>
        </div>
        <div className="p-3 border-b border-[var(--border)]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Nós</p>
          <div className="space-y-1">
            {FLOW_NODE_DEFS.map((def) => (
              <button
                key={def.type}
                type="button"
                onClick={() => addNode(def.type)}
                className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs hover:bg-[var(--surface-muted)] transition-colors group"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
                  style={{ backgroundColor: `${def.color}20`, color: def.color }}
                >
                  {ICON_MAP[def.type]}
                </span>
                <span className="font-medium text-[var(--text)] leading-tight">{def.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 text-[10px] text-[var(--text-muted)] space-y-1 mt-auto">
          <p>Clique para adicionar um nó.</p>
          <p>Arraste as saídas para conectar.</p>
        </div>
      </aside>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={flowNodeTypes}
          selectionMode={SelectionMode.Partial}
          panOnDrag={panMode ? [0, 1, 2] : [1, 2]}
          selectionOnDrag={!panMode}
          onNodeClick={(_, node) => {
            setSelectedNode(node);
            setContextMenu(null);
          }}
          onPaneClick={() => {
            setSelectedNode(null);
            setContextMenu(null);
            setConfirmCtxDelete(false);
          }}
          onNodeContextMenu={(e, node) => {
            e.preventDefault();
            if (node.type === "trigger") return;
            setContextMenu({ x: e.clientX, y: e.clientY, node });
            setConfirmCtxDelete(false);
          }}
          onNodeDragStart={() => pushUndo()}
          onEdgeClick={() => pushUndo()}
          edgeTypes={edgeTypes}
          deleteKeyCode={null}
        >
          <AutoFitView />
          <ViewportHelper posRef={screenToFlowRef} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap
            zoomable pannable
            nodeColor={(node) => NODE_COLORS[node.type ?? ""] ?? "#9ca3af"}
            className="!rounded-xl !border !border-[var(--border)]"
          />

          {/* Top bar */}
          <Panel position="top-center">
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-2 shadow-sm backdrop-blur-sm">
              {/* Nome */}
              {editingName ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={nameInputRef}
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingName(false); }}
                    className="h-7 w-44 rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-2 text-sm text-[var(--text)] focus:outline-none"
                  />
                  <button onClick={commitRename} disabled={isRename} className="text-[#10b981] hover:opacity-80">
                    {isRename ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingName(true); setNameInput(name); setTimeout(() => nameInputRef.current?.select(), 10); }}
                  className="flex items-center gap-1.5 text-sm font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors"
                >
                  {name}
                  <Pencil size={12} className="text-[var(--text-muted)]" />
                </button>
              )}

              <div className="h-4 w-px bg-[var(--border)] mx-1" />

              {/* Status badge */}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                status === "ACTIVE" ? "bg-[#10b981]/15 text-[#10b981]"
                : status === "PAUSED" ? "bg-[#f59e0b]/15 text-[#f59e0b]"
                : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
              }`}>
                {status === "ACTIVE" ? "Ativo" : status === "PAUSED" ? "Pausado" : "Rascunho"}
              </span>

              <div className="h-4 w-px bg-[var(--border)] mx-1" />

              {/* Undo/Redo */}
              <button onClick={undo} disabled={!canUndo} title="Desfazer"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors">
                <RotateCcw size={13} />
              </button>
              <button onClick={redo} disabled={!canRedo} title="Refazer"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors">
                <RotateCw size={13} />
              </button>

              <div className="h-4 w-px bg-[var(--border)] mx-1" />

              {/* Pan / Select */}
              <button onClick={() => setPanMode((v) => !v)} title={panMode ? "Modo seleção" : "Modo mover"}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  panMode ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                }`}>
                {panMode ? <Hand size={13} /> : <MousePointer2 size={13} />}
              </button>

              <div className="h-4 w-px bg-[var(--border)] mx-1" />

              {/* Save */}
              <button onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-1.5 h-7 rounded-lg px-2.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-50 transition-colors">
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Salvar
              </button>

              {/* Activate / Pause */}
              <button onClick={handleToggleStatus} disabled={isPublish}
                className={`flex items-center gap-1.5 h-7 rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  status === "ACTIVE"
                    ? "text-[#f59e0b] hover:bg-[#f59e0b]/10 border border-[#f59e0b]/30"
                    : "text-[#10b981] hover:bg-[#10b981]/10 border border-[#10b981]/30"
                }`}>
                {isPublish ? <Loader2 size={12} className="animate-spin" /> : status === "ACTIVE" ? <Pause size={12} /> : <Play size={12} />}
                {status === "ACTIVE" ? "Pausar" : "Ativar"}
              </button>
            </div>
          </Panel>

          {/* Bulk delete bar */}
          {multiSelected.length > 1 && (
            <Panel position="bottom-center">
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2 shadow-sm backdrop-blur-sm">
                <span className="text-sm font-medium text-[var(--text)]">{multiSelected.length} nós selecionados</span>
                <button
                  onClick={() => { if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; } deleteSelected(); }}
                  onBlur={() => setConfirmBulkDelete(false)}
                  className={`flex items-center gap-1.5 h-7 rounded-lg px-3 text-xs font-medium transition-colors ${
                    confirmBulkDelete ? "bg-[var(--danger)] text-white" : "border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                  }`}>
                  <Trash2 size={12} />
                  {confirmBulkDelete ? "Confirmar exclusão" : "Excluir selecionados"}
                </button>
                <button
                  onClick={() => { multiSelected.forEach((n) => duplicateNode(n)); }}
                  className="flex items-center gap-1.5 h-7 rounded-lg px-3 text-xs font-medium border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                  <Copy size={12} />
                  Duplicar selecionados
                </button>
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-50 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 min-w-[160px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {contextMenu.node.type !== "trigger" && (
              <>
                <button onClick={() => { duplicateNode(contextMenu.node); setContextMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors">
                  <Copy size={13} /> Duplicar
                </button>
                <button
                  onClick={() => {
                    if (!confirmCtxDelete) { setConfirmCtxDelete(true); return; }
                    deleteNode(contextMenu.node.id);
                    setContextMenu(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    confirmCtxDelete ? "bg-[var(--danger)] text-white" : "text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                  }`}>
                  <Trash2 size={13} />
                  {confirmCtxDelete ? "Confirmar" : "Remover"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Painel de configuração ─────────────────────────────────────────── */}
      {selectedNode && (
        <aside className="no-print w-72 shrink-0 border-l border-[var(--border)] bg-[var(--surface)]">
          <FlowNodeConfigPanel
            node={selectedNode}
            onUpdate={(id, data) => {
              updateNode(id, data);
              setSelectedNode((n) => n?.id === id ? { ...n, data } : n);
            }}
            onDelete={(id) => { deleteNode(id); setSelectedNode(null); }}
            onDuplicate={(node) => { duplicateNode(node); setSelectedNode(null); }}
            onClose={() => setSelectedNode(null)}
            audiences={audiences}
            pipelineStages={pipelineStages}
            consultants={consultants}
            agents={agents}
            flows={flows.filter((f) => f.id !== flowId)}
          />
        </aside>
      )}
    </div>
  );
}
