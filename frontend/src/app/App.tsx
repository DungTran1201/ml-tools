import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, SparklineChart,
  BarChart, Bar, Cell,
} from "recharts";
import {
  FlaskConical, Terminal, Play, Pause, Square, Settings,
  BarChart2, Zap, Server, HardDrive, Clock, RefreshCw,
  ChevronDown, ChevronUp, Search, SlidersHorizontal,
  CheckCircle2, XCircle, Loader2, ChevronRight, ChevronLeft,
  Layers, Download, Copy, ArrowUpDown, X, Filter,
  Star, GitFork, BookOpen, Cpu, Network,
  Thermometer, MemoryStick, Database, Activity,
  Upload, FolderOpen, FileText, FileArchive, Image,
  Table2, Eye, Trash2, UploadCloud, Package, AlertCircle, Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricPoint { step: number; trainLoss: number; valLoss: number; trainAcc: number; valAcc: number; }
interface HardwarePoint { t: number; cpu: number; gpu: number; vram: number; ram: number; }

type RunStatus = "completed" | "running" | "failed" | "stopped";

interface Run {
  runId: string;
  name: string;
  modelType: string;
  dataset: string;
  optimizer: string;
  lr: number;
  batchSize: number;
  epochs: number;
  completedEpochs: number;
  bestValAcc: number;
  bestValLoss: number;
  trainAcc: number;
  trainLoss: number;
  trainingTimeSec: number;
  gpuModel: string;
  params: string;
  status: RunStatus;
  tags: string[];
  accCurve: number[];
  startedAt: string;
}

interface HyperParams {
  learningRate: string; batchSize: string; optimizer: string; scheduler: string;
  momentum: string; weightDecay: string; dropout: string; epochs: string;
  warmupSteps: string; gradClip: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function miniCurve(final: number, steps = 12): number[] {
  const pts: number[] = [];
  let v = final * 0.45;
  for (let i = 0; i < steps; i++) {
    v = Math.min(final, v + (final - v) * 0.25 + (Math.random() - 0.4) * 0.015);
    pts.push(+v.toFixed(4));
  }
  return pts;
}

const RUNS: Run[] = [
  { runId: "run-0091", name: "convnext-xl-finetune", modelType: "ConvNeXt-XL", dataset: "ImageNet-1K", optimizer: "AdamW", lr: 0.00005, batchSize: 16, epochs: 50, completedEpochs: 50, bestValAcc: 0.9512, bestValLoss: 0.198, trainAcc: 0.9701, trainLoss: 0.142, trainingTimeSec: 18240, gpuModel: "A100 80GB", params: "350M", status: "completed", tags: ["finetune", "best"], accCurve: miniCurve(0.9512), startedAt: "2026-07-14 09:12" },
  { runId: "run-0088", name: "vit-large-patch16", modelType: "ViT-L/16", dataset: "ImageNet-1K", optimizer: "AdamW", lr: 0.0003, batchSize: 32, epochs: 80, completedEpochs: 80, bestValAcc: 0.9401, bestValLoss: 0.218, trainAcc: 0.9589, trainLoss: 0.181, trainingTimeSec: 21600, gpuModel: "A100 80GB", params: "307M", status: "completed", tags: ["transformer"], accCurve: miniCurve(0.9401), startedAt: "2026-07-13 22:05" },
  { runId: "run-0090", name: "efficientnet-b4-aug", modelType: "EfficientNet-B4", dataset: "ImageNet-1K", optimizer: "SGD", lr: 0.0005, batchSize: 48, epochs: 100, completedEpochs: 47, bestValAcc: 0.9289, bestValLoss: 0.271, trainAcc: 0.9412, trainLoss: 0.221, trainingTimeSec: 8091, gpuModel: "A100 80GB", params: "19M", status: "running", tags: ["augment"], accCurve: miniCurve(0.9289), startedAt: "2026-07-15 12:09" },
  { runId: "run-0085", name: "baseline-resnet50", modelType: "ResNet-50", dataset: "CIFAR-100", optimizer: "AdamW", lr: 0.001, batchSize: 64, epochs: 120, completedEpochs: 120, bestValAcc: 0.9134, bestValLoss: 0.312, trainAcc: 0.9322, trainLoss: 0.258, trainingTimeSec: 14520, gpuModel: "V100 32GB", params: "25M", status: "completed", tags: ["baseline"], accCurve: miniCurve(0.9134), startedAt: "2026-07-12 08:44" },
  { runId: "run-0087", name: "deit-base-distilled", modelType: "DeiT-B", dataset: "CIFAR-100", optimizer: "AdamW", lr: 0.0004, batchSize: 64, epochs: 60, completedEpochs: 60, bestValAcc: 0.9078, bestValLoss: 0.341, trainAcc: 0.9201, trainLoss: 0.291, trainingTimeSec: 9840, gpuModel: "A100 80GB", params: "86M", status: "completed", tags: ["distill"], accCurve: miniCurve(0.9078), startedAt: "2026-07-13 11:30" },
  { runId: "run-0083", name: "swin-large-w7", modelType: "Swin-L", dataset: "Oxford Pets", optimizer: "AdamW", lr: 0.00002, batchSize: 8, epochs: 30, completedEpochs: 30, bestValAcc: 0.9891, bestValLoss: 0.042, trainAcc: 0.9934, trainLoss: 0.031, trainingTimeSec: 3420, gpuModel: "A100 80GB", params: "197M", status: "completed", tags: ["finetune"], accCurve: miniCurve(0.9891), startedAt: "2026-07-11 14:22" },
  { runId: "run-0084", name: "vit-base-scratch", modelType: "ViT-B/32", dataset: "CIFAR-10", optimizer: "Adam", lr: 0.001, batchSize: 128, epochs: 100, completedEpochs: 15, bestValAcc: 0.7123, bestValLoss: 0.891, trainAcc: 0.7341, trainLoss: 0.802, trainingTimeSec: 1230, gpuModel: "V100 32GB", params: "86M", status: "failed", tags: ["scratch", "debug"], accCurve: miniCurve(0.7123), startedAt: "2026-07-12 16:50" },
  { runId: "run-0086", name: "regnet-y-32g", modelType: "RegNetY-32G", dataset: "ImageNet-1K", optimizer: "SGD", lr: 0.0008, batchSize: 32, epochs: 100, completedEpochs: 72, bestValAcc: 0.8934, bestValLoss: 0.389, trainAcc: 0.9112, trainLoss: 0.321, trainingTimeSec: 19320, gpuModel: "V100 32GB", params: "145M", status: "stopped", tags: [], accCurve: miniCurve(0.8934), startedAt: "2026-07-13 05:18" },
  { runId: "run-0089", name: "mobilenet-v3-large", modelType: "MobileNetV3-L", dataset: "CIFAR-10", optimizer: "RMSProp", lr: 0.001, batchSize: 256, epochs: 150, completedEpochs: 150, bestValAcc: 0.8812, bestValLoss: 0.421, trainAcc: 0.9011, trainLoss: 0.358, trainingTimeSec: 7200, gpuModel: "T4 16GB", params: "5.4M", status: "completed", tags: ["lightweight"], accCurve: miniCurve(0.8812), startedAt: "2026-07-14 18:00" },
  { runId: "run-0082", name: "densenet-201-aug", modelType: "DenseNet-201", dataset: "Oxford Flowers", optimizer: "SGD", lr: 0.0003, batchSize: 32, epochs: 80, completedEpochs: 80, bestValAcc: 0.9643, bestValLoss: 0.134, trainAcc: 0.9782, trainLoss: 0.098, trainingTimeSec: 6840, gpuModel: "A100 80GB", params: "20M", status: "completed", tags: ["augment"], accCurve: miniCurve(0.9643), startedAt: "2026-07-11 07:05" },
  { runId: "run-0081", name: "clip-vit-b32-ft", modelType: "CLIP ViT-B/32", dataset: "Oxford Flowers", optimizer: "AdamW", lr: 0.00001, batchSize: 64, epochs: 20, completedEpochs: 20, bestValAcc: 0.9821, bestValLoss: 0.072, trainAcc: 0.9889, trainLoss: 0.058, trainingTimeSec: 1980, gpuModel: "A100 80GB", params: "151M", status: "completed", tags: ["finetune", "clip"], accCurve: miniCurve(0.9821), startedAt: "2026-07-10 21:40" },
  { runId: "run-0080", name: "resnet18-distill-kd", modelType: "ResNet-18", dataset: "CIFAR-100", optimizer: "SGD", lr: 0.01, batchSize: 128, epochs: 200, completedEpochs: 200, bestValAcc: 0.8102, bestValLoss: 0.712, trainAcc: 0.8444, trainLoss: 0.601, trainingTimeSec: 10800, gpuModel: "T4 16GB", params: "11M", status: "completed", tags: ["distill", "lightweight"], accCurve: miniCurve(0.8102), startedAt: "2026-07-10 09:12" },
];

function generateMetrics(count: number): MetricPoint[] {
  const pts: MetricPoint[] = [];
  let tl = 2.4, vl = 2.6, ta = 0.18, va = 0.15;
  for (let i = 0; i < count; i++) {
    tl = Math.max(0.05, tl - 0.04 + (Math.random() - 0.5) * 0.06);
    vl = Math.max(0.08, vl - 0.035 + (Math.random() - 0.5) * 0.07);
    ta = Math.min(0.99, ta + 0.018 + (Math.random() - 0.5) * 0.02);
    va = Math.min(0.98, va + 0.016 + (Math.random() - 0.5) * 0.022);
    pts.push({ step: (i + 1) * 100, trainLoss: +tl.toFixed(4), valLoss: +vl.toFixed(4), trainAcc: +ta.toFixed(4), valAcc: +va.toFixed(4) });
  }
  return pts;
}

function generateHardware(count: number): HardwarePoint[] {
  return Array.from({ length: count }, (_, i) => ({
    t: i, cpu: 40 + Math.random() * 40, gpu: 70 + Math.random() * 25,
    vram: 60 + Math.random() * 30, ram: 50 + Math.random() * 20,
  }));
}

const LOG_LINES = [
  "[2026-07-15 14:23:01] INFO  Epoch 47/100 — step 4700/10000",
  "[2026-07-15 14:23:01] TRAIN loss=0.2341  acc=0.9127  lr=4.7e-4  grad_norm=1.82",
  "[2026-07-15 14:23:04] TRAIN loss=0.2289  acc=0.9143  lr=4.7e-4  grad_norm=1.67",
  "[2026-07-15 14:23:07] TRAIN loss=0.2312  acc=0.9131  lr=4.7e-4  grad_norm=1.74",
  "[2026-07-15 14:23:13] VAL   loss=0.2710  acc=0.9244  — new best val_acc",
  "[2026-07-15 14:23:13] INFO  Checkpoint saved → ./checkpoints/efficientnet-b4-aug_ep047.pt",
  "[2026-07-15 14:23:22] GPU   util=91%  vram=14.2/16.0 GB  temp=78°C  power=245W",
  "[2026-07-15 14:23:31] INFO  Epoch 48/100 — step 4800/10000  ETA 01:42:17",
  "[2026-07-15 14:23:34] TRAIN loss=0.2093  acc=0.9201  lr=4.6e-4  grad_norm=1.48",
];

// ─── Shared UI ────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

const NavItem = ({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType; label: string; active: boolean; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-[11px] font-medium tracking-widest uppercase
      ${active
        ? "text-[#00d4a0] bg-[rgba(0,212,160,0.08)] border-l border-[#00d4a0]"
        : "text-[#525c70] hover:text-[#8891a8] hover:bg-[rgba(255,255,255,0.03)] border-l border-transparent"
      }`}
    style={MONO}
  >
    <Icon size={14} strokeWidth={1.5} />
    <span>{label}</span>
  </button>
);

const StatBadge = ({ label, value, color = "#00d4a0" }: { label: string; value: string | number; color?: string; }) => (
  <div className="flex items-center gap-2">
    <span className="text-[#525c70] text-[10px] uppercase tracking-widest" style={MONO}>{label}</span>
    <span className="text-[10px] font-medium" style={{ color, ...MONO }}>{value}</span>
  </div>
);

const UtilBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-[#525c70] uppercase tracking-widest" style={MONO}>{label}</span>
      <span className="text-[11px] font-medium" style={{ color, ...MONO }}>{value.toFixed(1)}%</span>
    </div>
    <div className="h-px bg-[#131825] w-full relative">
      <div className="h-full absolute top-0 left-0 transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color, height: "1px" }} />
    </div>
  </div>
);

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RunStatus, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  completed: { color: "#00d4a0", bg: "rgba(0,212,160,0.08)", icon: CheckCircle2, label: "Completed" },
  running: { color: "#f5a623", bg: "rgba(245,166,35,0.08)", icon: Loader2, label: "Running" },
  failed: { color: "#f04040", bg: "rgba(240,64,64,0.08)", icon: XCircle, label: "Failed" },
  stopped: { color: "#525c70", bg: "rgba(82,92,112,0.12)", icon: Square, label: "Stopped" },
};

function StatusChip({ status }: { status: RunStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-widest"
      style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.color}28`, ...MONO }}
    >
      <Icon size={8} strokeWidth={2} className={status === "running" ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function AccSparkline({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: 72, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Experiments view ─────────────────────────────────────────────────────────

type SortKey = "runId" | "modelType" | "dataset" | "bestValAcc" | "trainingTimeSec" | "status" | "completedEpochs" | "params";

const ALL_DATASETS = [...new Set(RUNS.map(r => r.dataset))].sort();
const ALL_MODELS = [...new Set(RUNS.map(r => r.modelType))].sort();
const ALL_STATUSES: RunStatus[] = ["completed", "running", "failed", "stopped"];

function ExperimentsView() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("bestValAcc");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [filterStatus, setFilterStatus] = useState<RunStatus[]>([]);
  const [filterDataset, setFilterDataset] = useState<string[]>([]);
  const [filterModel, setFilterModel] = useState<string[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === -1 ? 1 : -1));
    else { setSortKey(key); setSortDir(-1); }
  };

  const toggleFilter = <T,>(arr: T[], val: T, set: (v: T[]) => void) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const activeFilterCount = filterStatus.length + filterDataset.length + filterModel.length;

  const filtered = useMemo(() => {
    let rows = RUNS.filter(r => {
      const q = search.toLowerCase();
      if (q && !r.runId.includes(q) && !r.name.includes(q) && !r.modelType.toLowerCase().includes(q) && !r.dataset.toLowerCase().includes(q)) return false;
      if (filterStatus.length && !filterStatus.includes(r.status)) return false;
      if (filterDataset.length && !filterDataset.includes(r.dataset)) return false;
      if (filterModel.length && !filterModel.includes(r.modelType)) return false;
      return true;
    });
    return rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }, [search, sortKey, sortDir, filterStatus, filterDataset, filterModel]);

  const bestAccRun = RUNS.reduce((best, r) => r.bestValAcc > best.bestValAcc ? r : best, RUNS[0]);

  const SortTh = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`text-left px-4 py-3 text-[9px] uppercase tracking-[0.12em] text-[#525c70] cursor-pointer select-none whitespace-nowrap group ${className}`}
      onClick={() => toggleSort(col)}
      style={MONO}
    >
      <span className="flex items-center gap-1.5 group-hover:text-[#8891a8] transition-colors">
        {label}
        <span className="text-[#333d50] group-hover:text-[#525c70] transition-colors">
          {sortKey === col
            ? sortDir === -1 ? <ChevronDown size={10} /> : <ChevronUp size={10} />
            : <ArrowUpDown size={9} />}
        </span>
      </span>
    </th>
  );

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-hidden">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-border">
        <div className="max-w-[1600px] mx-auto px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical size={14} className="text-[#00d4a0]" strokeWidth={1.5} />
                <h1 className="text-sm font-semibold text-[#d4dae8] uppercase tracking-widest" style={MONO}>Experiments</h1>
              </div>
              <p className="text-[11px] text-[#525c70]" style={MONO}>
                {RUNS.length} training runs · {RUNS.filter(r => r.status === "completed").length} completed · {RUNS.filter(r => r.status === "running").length} active
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest border border-border text-[#525c70] hover:text-[#8891a8] hover:border-[rgba(255,255,255,0.15)] transition-colors" style={MONO}>
                <Download size={10} /> Export
              </button>
              {selected.size > 0 && (
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest border border-[#7c6cf8]/40 text-[#7c6cf8] hover:bg-[rgba(124,108,248,0.08)] transition-colors" style={MONO}>
                  <Copy size={10} /> Compare {selected.size}
                </button>
              )}
            </div>
          </div>

          {/* ── Summary stat cards ── */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { label: "Best Val Acc", value: (bestAccRun.bestValAcc * 100).toFixed(2) + "%", sub: bestAccRun.name, color: "#00d4a0" },
              { label: "Total GPU Time", value: fmtDuration(RUNS.reduce((s, r) => s + r.trainingTimeSec, 0)), sub: `${RUNS.length} runs`, color: "#7c6cf8" },
              { label: "Avg Val Acc", value: (RUNS.filter(r => r.status === "completed").reduce((s, r) => s + r.bestValAcc, 0) / RUNS.filter(r => r.status === "completed").length * 100).toFixed(2) + "%", sub: "completed runs", color: "#3ba6ff" },
              { label: "Active Runs", value: String(RUNS.filter(r => r.status === "running").length), sub: "in progress", color: "#f5a623" },
            ].map(c => (
              <div key={c.label} className="border border-border bg-card px-4 py-3">
                <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-1.5" style={MONO}>{c.label}</div>
                <div className="text-xl font-semibold" style={{ color: c.color, ...MONO }}>{c.value}</div>
                <div className="text-[10px] text-[#525c70] mt-0.5 truncate" style={MONO}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="shrink-0 border-b border-border bg-[#0a0d14]">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-6 py-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 flex-1 max-w-xs">
            <Search size={11} className="text-[#525c70] shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search runs, models, datasets…"
              className="bg-transparent outline-none text-[11px] text-[#d4dae8] placeholder-[#525c70] w-full"
              style={MONO}
            />
            {search && <button onClick={() => setSearch("")}><X size={10} className="text-[#525c70] hover:text-[#8891a8]" /></button>}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest border transition-colors ${showFilters || activeFilterCount > 0
              ? "border-[#00d4a0]/40 text-[#00d4a0] bg-[rgba(0,212,160,0.06)]"
              : "border-border text-[#525c70] hover:text-[#8891a8]"
              }`}
            style={MONO}
          >
            <Filter size={10} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-[#00d4a0] text-[#07090f] text-[8px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex-1" />

          {/* Status quick filters */}
          <div className="flex items-center gap-1">
            {ALL_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              const active = filterStatus.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleFilter(filterStatus, s, setFilterStatus)}
                  className="px-2.5 py-1 text-[9px] uppercase tracking-widest border transition-colors"
                  style={{
                    color: active ? cfg.color : "#525c70",
                    borderColor: active ? cfg.color + "60" : "rgba(255,255,255,0.07)",
                    backgroundColor: active ? cfg.bg : "transparent",
                    ...MONO,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-[#525c70]" style={MONO}>
            {filtered.length} / {RUNS.length}
          </div>
        </div>
      </div>

      {/* ── Expanded filter panel ── */}
      {showFilters && (
        <div className="shrink-0 border-b border-border bg-[#080c12]">
          <div className="max-w-[1600px] mx-auto px-6 py-4 grid grid-cols-2 gap-6">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-2" style={MONO}>Dataset</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_DATASETS.map(d => {
                  const active = filterDataset.includes(d);
                  return (
                    <button key={d} onClick={() => toggleFilter(filterDataset, d, setFilterDataset)}
                      className="px-2 py-0.5 text-[10px] border transition-colors"
                      style={{ color: active ? "#3ba6ff" : "#525c70", borderColor: active ? "#3ba6ff60" : "rgba(255,255,255,0.07)", backgroundColor: active ? "rgba(59,166,255,0.08)" : "transparent", ...MONO }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-2" style={MONO}>Model Type</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_MODELS.map(m => {
                  const active = filterModel.includes(m);
                  return (
                    <button key={m} onClick={() => toggleFilter(filterModel, m, setFilterModel)}
                      className="px-2 py-0.5 text-[10px] border transition-colors"
                      style={{ color: active ? "#7c6cf8" : "#525c70", borderColor: active ? "#7c6cf860" : "rgba(255,255,255,0.07)", backgroundColor: active ? "rgba(124,108,248,0.08)" : "transparent", ...MONO }}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-[1600px] mx-auto">
          <table className="w-full border-collapse" style={{ ...MONO, fontSize: 11 }}>
            <thead className="sticky top-0 z-10 bg-[#0a0d14]">
              <tr className="border-b border-border">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="accent-[#00d4a0]"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(r => r.runId)))}
                  />
                </th>
                <SortTh col="runId" label="Run ID" />
                <th className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.12em] text-[#525c70]" style={MONO}>Name</th>
                <SortTh col="modelType" label="Model Type" />
                <SortTh col="dataset" label="Dataset" />
                <th className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.12em] text-[#525c70]" style={MONO}>Val Acc Trend</th>
                <SortTh col="bestValAcc" label="Best Val Acc" />
                <th className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.12em] text-[#525c70]" style={MONO}>Val Loss</th>
                <SortTh col="completedEpochs" label="Epochs" />
                <SortTh col="trainingTimeSec" label="Train Time" />
                <th className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.12em] text-[#525c70]" style={MONO}>GPU</th>
                <SortTh col="status" label="Status" />
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-16 text-center text-[#525c70] text-[11px]" style={MONO}>
                    No runs match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((run) => {
                const isExpanded = expandedRun === run.runId;
                const isSelected = selected.has(run.runId);
                const isBest = run.runId === bestAccRun.runId;
                const accColor = run.bestValAcc >= 0.95 ? "#00d4a0" : run.bestValAcc >= 0.90 ? "#3ba6ff" : run.bestValAcc >= 0.85 ? "#f5a623" : "#f04040";

                return (
                  <Fragment key={run.runId}>
                    <tr
                      className="border-b border-[rgba(255,255,255,0.04)] transition-colors cursor-pointer group"
                      style={{ backgroundColor: isSelected ? "rgba(124,108,248,0.05)" : isExpanded ? "rgba(255,255,255,0.02)" : undefined }}
                      onClick={() => setExpandedRun(isExpanded ? null : run.runId)}
                      onMouseEnter={e => { if (!isSelected && !isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={e => { if (!isSelected && !isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(run.runId); }}>
                        <input type="checkbox" className="accent-[#00d4a0]" checked={isSelected} onChange={() => { }} />
                      </td>

                      {/* Run ID */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isBest && <span className="text-[8px] text-[#07090f] bg-[#00d4a0] px-1 py-px font-bold tracking-widest uppercase">BEST</span>}
                          <span className="text-[#8891a8]">{run.runId}</span>
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="text-[#d4dae8] font-medium truncate max-w-[160px]">{run.name}</div>
                        <div className="flex gap-1 mt-0.5">
                          {run.tags.map(t => (
                            <span key={t} className="text-[8px] text-[#525c70] border border-[rgba(255,255,255,0.06)] px-1">{t}</span>
                          ))}
                        </div>
                      </td>

                      {/* Model Type */}
                      <td className="px-4 py-3 text-[#8891a8] whitespace-nowrap">{run.modelType}</td>

                      {/* Dataset */}
                      <td className="px-4 py-3">
                        <span className="text-[#8891a8]">{run.dataset}</span>
                      </td>

                      {/* Sparkline */}
                      <td className="px-4 py-3">
                        <AccSparkline data={run.accCurve} color={accColor} />
                      </td>

                      {/* Best Val Acc */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1 bg-[#131825]">
                            <div className="h-full" style={{ width: `${run.bestValAcc * 100}%`, backgroundColor: accColor }} />
                          </div>
                          <span className="font-semibold" style={{ color: accColor }}>
                            {(run.bestValAcc * 100).toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      {/* Val Loss */}
                      <td className="px-4 py-3 text-[#8891a8]">{run.bestValLoss.toFixed(3)}</td>

                      {/* Epochs */}
                      <td className="px-4 py-3 text-[#8891a8]">
                        {run.completedEpochs}/{run.epochs}
                        {run.status === "running" && (
                          <div className="w-12 h-px bg-[#131825] mt-1">
                            <div className="h-full bg-[#f5a623]" style={{ width: `${(run.completedEpochs / run.epochs) * 100}%` }} />
                          </div>
                        )}
                      </td>

                      {/* Training Time */}
                      <td className="px-4 py-3 text-[#8891a8] whitespace-nowrap">{fmtDuration(run.trainingTimeSec)}</td>

                      {/* GPU */}
                      <td className="px-4 py-3 text-[#525c70] text-[10px] whitespace-nowrap">{run.gpuModel}</td>

                      {/* Status */}
                      <td className="px-4 py-3"><StatusChip status={run.status} /></td>

                      {/* Expand */}
                      <td className="px-4 py-3">
                        <ChevronRight size={12} className="text-[#525c70] transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "none" }} />
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="border-b border-[rgba(255,255,255,0.04)] bg-[#080c12]">
                        <td colSpan={13} className="px-6 py-4">
                          <div className="grid grid-cols-4 gap-6">
                            {/* Hyperparams */}
                            <div>
                              <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-2.5" style={MONO}>Hyperparameters</div>
                              <div className="space-y-1.5">
                                {[
                                  ["Optimizer", run.optimizer],
                                  ["Learning Rate", String(run.lr)],
                                  ["Batch Size", String(run.batchSize)],
                                  ["Parameters", run.params],
                                ].map(([k, v]) => (
                                  <div key={k} className="flex gap-3 text-[10px]" style={MONO}>
                                    <span className="text-[#525c70] w-28 shrink-0">{k}</span>
                                    <span className="text-[#d4dae8]">{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Metrics */}
                            <div>
                              <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-2.5" style={MONO}>Final Metrics</div>
                              <div className="space-y-1.5">
                                {[
                                  ["Train Acc", (run.trainAcc * 100).toFixed(2) + "%", "#d4dae8"],
                                  ["Train Loss", run.trainLoss.toFixed(3), "#d4dae8"],
                                  ["Best Val Acc", (run.bestValAcc * 100).toFixed(2) + "%", accColor],
                                  ["Best Val Loss", run.bestValLoss.toFixed(3), accColor],
                                ].map(([k, v, c]) => (
                                  <div key={k} className="flex gap-3 text-[10px]" style={MONO}>
                                    <span className="text-[#525c70] w-28 shrink-0">{k}</span>
                                    <span style={{ color: c }}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Run info */}
                            <div>
                              <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-2.5" style={MONO}>Run Info</div>
                              <div className="space-y-1.5">
                                {[
                                  ["Started", run.startedAt],
                                  ["Duration", fmtDuration(run.trainingTimeSec)],
                                  ["GPU", run.gpuModel],
                                  ["Epochs", `${run.completedEpochs} / ${run.epochs}`],
                                ].map(([k, v]) => (
                                  <div key={k} className="flex gap-3 text-[10px]" style={MONO}>
                                    <span className="text-[#525c70] w-28 shrink-0">{k}</span>
                                    <span className="text-[#d4dae8]">{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 justify-start">
                              <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-1" style={MONO}>Actions</div>
                              {[
                                { label: "View Metrics", color: "#00d4a0" },
                                { label: "Load Config", color: "#7c6cf8" },
                                { label: "Download Checkpoint", color: "#3ba6ff" },
                              ].map(a => (
                                <button key={a.label}
                                  className="text-left px-3 py-1.5 text-[10px] uppercase tracking-widest border transition-colors hover:opacity-80"
                                  style={{ color: a.color, borderColor: a.color + "40", backgroundColor: a.color + "08", ...MONO }}>
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Models view ──────────────────────────────────────────────────────────────

type ModelFamily = "CNN" | "Transformer" | "Segmentation" | "Detection" | "Lightweight" | "Multimodal" | "Classical";

interface ModelCard {
  id: string;
  name: string;
  fullName: string;
  family: ModelFamily;
  params: string;
  flops: string;
  top1: string;
  inputSize: string;
  depth: number;
  source: string;
  description: string;
  tags: string[];
  starred: boolean;
  forks: number;
}

const MODELS: ModelCard[] = [
  { id: "efficientnet-b4", name: "EfficientNet-B4", fullName: "EfficientNet-B4", family: "CNN", params: "19M", flops: "4.2B", top1: "83.0%", inputSize: "380×380", depth: 32, source: "Google", description: "Compound-scaled CNN balancing width, depth, and resolution. State-of-the-art efficiency on ImageNet.", tags: ["classification", "pretrained", "scalable"], starred: true, forks: 1842 },
  { id: "resnet50", name: "ResNet-50", fullName: "ResNet-50", family: "CNN", params: "25M", flops: "4.1B", top1: "76.1%", inputSize: "224×224", depth: 50, source: "Microsoft", description: "Canonical residual network with skip connections. Industry baseline for image classification tasks.", tags: ["classification", "baseline", "pretrained"], starred: true, forks: 4210 },
  { id: "vit-l16", name: "ViT-L/16", fullName: "Vision Transformer Large/16", family: "Transformer", params: "307M", flops: "61B", top1: "87.8%", inputSize: "224×224", depth: 24, source: "Google", description: "Large-scale vision transformer treating images as sequences of patches. Achieves SOTA on ImageNet-21k.", tags: ["classification", "attention", "large-scale"], starred: true, forks: 2901 },
  { id: "convnext-xl", name: "ConvNeXt-XL", fullName: "ConvNeXt Extra Large", family: "CNN", params: "350M", flops: "60.9B", top1: "87.8%", inputSize: "224×224", depth: 28, source: "Meta AI", description: "Modernized CNN design inspired by transformers. Matches ViT performance with standard convolutional ops.", tags: ["classification", "modern-cnn", "pretrained"], starred: false, forks: 1203 },
  { id: "unet", name: "U-Net", fullName: "U-Net", family: "Segmentation", params: "31M", flops: "54.8B", top1: "—", inputSize: "572×572", depth: 19, source: "Freiburg", description: "Encoder-decoder with skip connections for biomedical image segmentation. Excels on small datasets.", tags: ["segmentation", "medical", "encoder-decoder"], starred: true, forks: 3388 },
  { id: "swin-l", name: "Swin-L", fullName: "Swin Transformer Large", family: "Transformer", params: "197M", flops: "34.5B", top1: "87.3%", inputSize: "224×224", depth: 24, source: "Microsoft", description: "Hierarchical vision transformer with shifted windows. Versatile backbone for detection and segmentation.", tags: ["classification", "detection", "hierarchical"], starred: false, forks: 2156 },
  { id: "yolov8-l", name: "YOLOv8-L", fullName: "YOLOv8 Large", family: "Detection", params: "43M", flops: "165B", top1: "—", inputSize: "640×640", depth: 365, source: "Ultralytics", description: "Real-time object detector with anchor-free head. 53.9 mAP on COCO with 14ms GPU inference.", tags: ["detection", "real-time", "anchor-free"], starred: true, forks: 5621 },
  { id: "mobilenet-v3", name: "MobileNetV3-L", fullName: "MobileNetV3 Large", family: "Lightweight", params: "5.4M", flops: "0.22B", top1: "75.2%", inputSize: "224×224", depth: 15, source: "Google", description: "Hardware-aware NAS optimized for mobile and edge. Inverted residuals with h-swish activation.", tags: ["lightweight", "mobile", "edge"], starred: false, forks: 1891 },
  { id: "clip-vit-b32", name: "CLIP ViT-B/32", fullName: "CLIP Vision Transformer B/32", family: "Multimodal", params: "151M", flops: "12.7B", top1: "63.4%", inputSize: "224×224", depth: 12, source: "OpenAI", description: "Contrastive language-image pretraining. Zero-shot classification via natural language supervision.", tags: ["multimodal", "zero-shot", "contrastive"], starred: true, forks: 7034 },
  { id: "deit-b", name: "DeiT-B", fullName: "Data-efficient Image Transformer Base", family: "Transformer", params: "86M", flops: "17.6B", top1: "83.4%", inputSize: "224×224", depth: 12, source: "Meta AI", description: "Transformer trained without extra data via distillation token. Pure ImageNet training, no extra pretraining.", tags: ["classification", "distillation", "efficient"], starred: false, forks: 987 },
  { id: "densenet201", name: "DenseNet-201", fullName: "DenseNet-201", family: "CNN", params: "20M", flops: "4.3B", top1: "77.3%", inputSize: "224×224", depth: 201, source: "Cornell", description: "Dense connectivity where each layer receives feature maps from all preceding layers. Reduces vanishing gradients.", tags: ["classification", "dense-connections", "pretrained"], starred: false, forks: 1124 },
  { id: "segment-anything", name: "SAM ViT-H", fullName: "Segment Anything Model ViT-H", family: "Segmentation", params: "636M", flops: "—", top1: "—", inputSize: "1024×1024", depth: 32, source: "Meta AI", description: "Promptable segmentation system trained on 1B masks. Generalizes to new image distributions zero-shot.", tags: ["segmentation", "foundation", "zero-shot"], starred: true, forks: 9812 },
  // Classical ML
  { id: "xgboost", name: "XGBoost", fullName: "XGBoost Gradient Boosting", family: "Classical", params: "—", flops: "—", top1: "—", inputSize: "Tabular", depth: 500, source: "DMLC", description: "Gradient boosted decision trees with regularization. Dominant algorithm on Kaggle for tabular data. Supports GPU training.", tags: ["classification", "regression", "boosting"], starred: true, forks: 8210 },
  { id: "knn", name: "KNN", fullName: "K-Nearest Neighbors", family: "Classical", params: "—", flops: "—", top1: "—", inputSize: "Tabular", depth: 1, source: "Scikit-learn", description: "Instance-based learner classifying by majority vote of k nearest neighbors. No training phase; distance metric is configurable.", tags: ["classification", "regression", "lazy-learning"], starred: false, forks: 2140 },
  { id: "random-forest", name: "Random Forest", fullName: "Random Forest Ensemble", family: "Classical", params: "—", flops: "—", top1: "—", inputSize: "Tabular", depth: 100, source: "Scikit-learn", description: "Bagged ensemble of decorrelated decision trees. Robust to overfitting with built-in feature importance.", tags: ["classification", "regression", "ensemble"], starred: true, forks: 5430 },
  { id: "logistic-regression", name: "Log. Regression", fullName: "Linear / Logistic Regression", family: "Classical", params: "—", flops: "—", top1: "—", inputSize: "Tabular", depth: 1, source: "Scikit-learn", description: "Linear model with sigmoid/softmax output for classification, or OLS for regression. Fast, interpretable, and regularizable.", tags: ["classification", "regression", "linear"], starred: false, forks: 3890 },
  { id: "kmeans", name: "K-Means", fullName: "K-Means Clustering", family: "Classical", params: "—", flops: "—", top1: "—", inputSize: "Tabular", depth: 8, source: "Scikit-learn", description: "Centroid-based partitioning into k clusters via iterative EM. Fast convergence with k-means++ initialization.", tags: ["clustering", "unsupervised", "centroid"], starred: false, forks: 4120 },
];

const FAMILY_COLORS: Record<ModelFamily, { text: string; bg: string; border: string }> = {
  CNN: { text: "#00d4a0", bg: "rgba(0,212,160,0.08)", border: "rgba(0,212,160,0.25)" },
  Transformer: { text: "#7c6cf8", bg: "rgba(124,108,248,0.08)", border: "rgba(124,108,248,0.25)" },
  Segmentation: { text: "#3ba6ff", bg: "rgba(59,166,255,0.08)", border: "rgba(59,166,255,0.25)" },
  Detection: { text: "#f5a623", bg: "rgba(245,166,35,0.08)", border: "rgba(245,166,35,0.25)" },
  Lightweight: { text: "#00d4a0", bg: "rgba(0,212,160,0.06)", border: "rgba(0,212,160,0.2)" },
  Multimodal: { text: "#e879a0", bg: "rgba(232,121,160,0.08)", border: "rgba(232,121,160,0.25)" },
  Classical: { text: "#e8a838", bg: "rgba(232,168,56,0.08)", border: "rgba(232,168,56,0.25)" },
};

// SVG architecture thumbnails — minimal block diagrams per model family
function ArchThumb({ family, name }: { family: ModelFamily; name: string }) {
  const c = FAMILY_COLORS[family].text;
  const dim = "rgba(255,255,255,0.04)";
  const line = "rgba(255,255,255,0.12)";

  if (family === "CNN") {
    // Conv stack: stacked rectangles shrinking then expanding
    const layers = [40, 32, 24, 18, 14, 18, 24, 32];
    return (
      <svg viewBox="0 0 120 72" fill="none" className="w-full h-full">
        {layers.map((w, i) => {
          const x = 8 + i * 13;
          const h = w * 0.9;
          const y = (72 - h) / 2;
          return (
            <rect key={i} x={x} y={y} width={10} height={h}
              fill={i === 4 ? c + "30" : dim}
              stroke={i === 4 ? c : line} strokeWidth={0.8} />
          );
        })}
        <text x={60} y={68} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="JetBrains Mono">{name.split("-")[0]}</text>
      </svg>
    );
  }

  if (family === "Transformer") {
    // Attention blocks as stacked cards
    const blocks = 5;
    return (
      <svg viewBox="0 0 120 72" fill="none" className="w-full h-full">
        {Array.from({ length: blocks }).map((_, i) => {
          const y = 6 + i * 12;
          return (
            <g key={i}>
              <rect x={14} y={y} width={92} height={9} rx={1} fill={dim} stroke={line} strokeWidth={0.7} />
              <rect x={14} y={y} width={30} height={9} rx={1} fill={c + "20"} stroke={c + "60"} strokeWidth={0.7} />
              <rect x={48} y={y} width={22} height={9} rx={1} fill={c + "10"} stroke={line} strokeWidth={0.7} />
            </g>
          );
        })}
        <rect x={48} y={64} width={24} height={5} rx={1} fill={c + "40"} stroke={c} strokeWidth={0.7} />
        <text x={60} y={68} textAnchor="middle" fill={c + "cc"} fontSize={5.5} fontFamily="JetBrains Mono">ATTN</text>
      </svg>
    );
  }

  if (family === "Segmentation") {
    // U-shape encoder-decoder
    const enc = [52, 40, 28, 18];
    return (
      <svg viewBox="0 0 120 72" fill="none" className="w-full h-full">
        {enc.map((h, i) => {
          const w = 12;
          const x = 8 + i * 16;
          const y = (72 - h) / 2;
          return <rect key={`e${i}`} x={x} y={y} width={w} height={h} fill={dim} stroke={line} strokeWidth={0.7} />;
        })}
        {/* bottleneck */}
        <rect x={72} y={27} width={12} height={18} fill={c + "30"} stroke={c} strokeWidth={0.8} />
        {enc.map((h, i) => {
          const w = 12;
          const x = 88 + (3 - i) * 16 - 16;
          const y = (72 - h) / 2;
          return (
            <g key={`d${i}`}>
              <rect x={x} y={y} width={w} height={h} fill={dim} stroke={line} strokeWidth={0.7} />
              <line x1={8 + i * 16 + 12} y1={36} x2={x} y2={36} stroke={c + "40"} strokeWidth={0.6} strokeDasharray="2 2" />
            </g>
          );
        })}
      </svg>
    );
  }

  if (family === "Detection") {
    // Grid of detection anchors
    return (
      <svg viewBox="0 0 120 72" fill="none" className="w-full h-full">
        <rect x={10} y={8} width={100} height={56} fill={dim} stroke={line} strokeWidth={0.7} />
        {[0, 1, 2].map(row => [0, 1, 2].map(col => {
          const cx = 27 + col * 33;
          const cy = 24 + row * 18;
          const active = (row === 1 && col === 1);
          return (
            <g key={`${row}-${col}`}>
              <rect x={cx - 10} y={cy - 8} width={20} height={15} fill={active ? c + "25" : "transparent"} stroke={active ? c : line} strokeWidth={active ? 1 : 0.5} />
              {active && <circle cx={cx} cy={cy} r={2} fill={c} />}
            </g>
          );
        }))}
        <text x={60} y={68} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="JetBrains Mono">YOLO</text>
      </svg>
    );
  }

  if (family === "Lightweight") {
    // Depthwise separable blocks
    const blocks = 6;
    return (
      <svg viewBox="0 0 120 72" fill="none" className="w-full h-full">
        {Array.from({ length: blocks }).map((_, i) => {
          const x = 10 + i * 17;
          return (
            <g key={i}>
              <rect x={x} y={12} width={13} height={28} fill={dim} stroke={line} strokeWidth={0.7} />
              <rect x={x + 2} y={14} width={9} height={8} fill={c + "20"} stroke={c + "50"} strokeWidth={0.5} />
              <rect x={x + 2} y={24} width={9} height={8} fill={dim} stroke={line} strokeWidth={0.5} />
              {i < blocks - 1 && <line x1={x + 13} y1={26} x2={x + 17} y2={26} stroke={line} strokeWidth={0.7} />}
            </g>
          );
        })}
        <text x={60} y={56} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize={6} fontFamily="JetBrains Mono">DW-CONV</text>
      </svg>
    );
  }

  if (family === "Classical") {
    // Decision tree branching diagram
    return (
      <svg viewBox="0 0 120 72" fill="none" className="w-full h-full">
        {/* Root */}
        <circle cx={60} cy={12} r={5} fill={c + "30"} stroke={c} strokeWidth={0.9} />
        {/* L1 branches */}
        <line x1={60} y1={17} x2={35} y2={30} stroke={c + "60"} strokeWidth={0.7} />
        <line x1={60} y1={17} x2={85} y2={30} stroke={c + "60"} strokeWidth={0.7} />
        <circle cx={35} cy={32} r={4} fill={dim} stroke={line} strokeWidth={0.7} />
        <circle cx={85} cy={32} r={4} fill={dim} stroke={line} strokeWidth={0.7} />
        {/* L2 branches */}
        <line x1={35} y1={36} x2={20} y2={48} stroke={line} strokeWidth={0.6} />
        <line x1={35} y1={36} x2={50} y2={48} stroke={line} strokeWidth={0.6} />
        <line x1={85} y1={36} x2={70} y2={48} stroke={line} strokeWidth={0.6} />
        <line x1={85} y1={36} x2={100} y2={48} stroke={line} strokeWidth={0.6} />
        {/* Leaves */}
        {[20, 50, 70, 100].map(x => (
          <rect key={x} x={x - 5} y={48} width={10} height={7} fill={c + "18"} stroke={c + "50"} strokeWidth={0.6} />
        ))}
        <text x={60} y={67} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="JetBrains Mono">TREE</text>
      </svg>
    );
  }

  // Multimodal
  return (
    <svg viewBox="0 0 120 72" fill="none" className="w-full h-full">
      {/* Image encoder */}
      <rect x={8} y={18} width={32} height={36} fill={dim} stroke={line} strokeWidth={0.7} />
      <text x={24} y={40} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={6} fontFamily="JetBrains Mono">IMG</text>
      {/* Text encoder */}
      <rect x={80} y={18} width={32} height={36} fill={dim} stroke={line} strokeWidth={0.7} />
      <text x={96} y={40} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={6} fontFamily="JetBrains Mono">TXT</text>
      {/* Contrastive bridge */}
      <line x1={40} y1={36} x2={80} y2={36} stroke={c} strokeWidth={1} strokeDasharray="3 2" />
      <circle cx={60} cy={36} r={7} fill={c + "20"} stroke={c} strokeWidth={0.9} />
      <text x={60} y={39} textAnchor="middle" fill={c} fontSize={6.5} fontFamily="JetBrains Mono">⊗</text>
    </svg>
  );
}

function ModelCardComponent({ model, onUseBase, onViewArch }: {
  model: ModelCard;
  onUseBase: (id: string) => void;
  onViewArch: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [starred, setStarred] = useState(model.starred);
  const fc = FAMILY_COLORS[model.family];

  return (
    <div
      className="flex flex-col border border-border bg-card transition-all duration-150 cursor-default group"
      style={{ borderColor: hovered ? fc.border : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative border-b border-border bg-[#080c12]" style={{ height: 100 }}>
        <div className="absolute inset-0 p-3">
          <ArchThumb family={model.family} name={model.name} />
        </div>
        {/* Family badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 font-medium" style={{ color: fc.text, backgroundColor: fc.bg, border: `1px solid ${fc.border}`, ...MONO }}>
            {model.family}
          </span>
        </div>
        {/* Star */}
        <button
          className="absolute top-2 right-2 transition-opacity"
          onClick={() => setStarred(s => !s)}
        >
          <Star size={11} fill={starred ? "#f5a623" : "none"} stroke={starred ? "#f5a623" : "rgba(255,255,255,0.3)"} strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 gap-2.5">
        {/* Name + source */}
        <div>
          <div className="text-[12px] font-semibold text-[#d4dae8] leading-tight" style={MONO}>{model.name}</div>
          <div className="text-[9px] text-[#525c70] mt-0.5 uppercase tracking-widest" style={MONO}>{model.source}</div>
        </div>

        {/* Description */}
        <p className="text-[10px] text-[#525c70] leading-relaxed line-clamp-2" style={{ fontFamily: "Inter, sans-serif" }}>
          {model.description}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1 border-t border-border">
          {(model.family === "Classical" ? [
            { label: model.tags.includes("clustering") ? "Clusters" : model.tags.includes("lazy-learning") ? "K Neighbors" : "Estimators", value: String(model.depth) },
            { label: "Type", value: model.tags[0] ?? "—" },
            { label: "Input", value: model.inputSize },
            { label: "Source", value: model.source },
          ] : [
            { label: "Params", value: model.params },
            { label: "FLOPs", value: model.flops },
            { label: "Top-1", value: model.top1 },
            { label: "Input", value: model.inputSize },
          ]).map(s => (
            <div key={s.label}>
              <div className="text-[8px] text-[#525c70] uppercase tracking-widest" style={MONO}>{s.label}</div>
              <div className="text-[11px] text-[#d4dae8] font-medium mt-px" style={MONO}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {model.tags.map(t => (
            <span key={t} className="text-[8px] uppercase tracking-widest px-1.5 py-px border border-[rgba(255,255,255,0.07)] text-[#525c70]" style={MONO}>{t}</span>
          ))}
        </div>

        {/* Forks */}
        <div className="flex items-center gap-1 text-[#525c70]">
          <GitFork size={9} strokeWidth={1.5} />
          <span className="text-[9px]" style={MONO}>{model.forks.toLocaleString()} forks</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={() => onUseBase(model.id)}
            className="flex-1 py-1.5 text-[9px] uppercase tracking-widest font-medium transition-colors border"
            style={{ color: fc.text, borderColor: fc.border, backgroundColor: hovered ? fc.bg : "transparent", ...MONO }}
          >
            Use as Base
          </button>
          <button
            onClick={() => onViewArch(model.id)}
            className="flex-1 py-1.5 text-[9px] uppercase tracking-widest text-[#525c70] border border-[rgba(255,255,255,0.07)] hover:text-[#8891a8] hover:border-[rgba(255,255,255,0.15)] transition-colors"
            style={MONO}
          >
            View Arch
          </button>
        </div>
      </div>
    </div>
  );
}

// Arch detail modal
function ArchModal({ model, onClose }: { model: ModelCard; onClose: () => void }) {
  const fc = FAMILY_COLORS[model.family];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-[#0d1017] border border-[rgba(255,255,255,0.12)] w-full max-w-lg mx-4 flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5" style={{ color: fc.text, backgroundColor: fc.bg, border: `1px solid ${fc.border}`, ...MONO }}>{model.family}</span>
            <span className="text-sm font-semibold text-[#d4dae8]" style={MONO}>{model.fullName}</span>
          </div>
          <button onClick={onClose} className="text-[#525c70] hover:text-[#8891a8] transition-colors"><X size={14} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Arch diagram */}
          <div className="border-b border-border bg-[#080c12] flex items-center justify-center" style={{ height: 160 }}>
            <div style={{ width: 280, height: 140 }}>
              <ArchThumb family={model.family} name={model.name} />
            </div>
          </div>

          {/* Details */}
          <div className="p-5 space-y-5">
            <p className="text-[11px] text-[#8891a8] leading-relaxed" style={{ fontFamily: "Inter, sans-serif" }}>{model.description}</p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Parameters", value: model.params },
                { label: "FLOPs", value: model.flops },
                { label: "Top-1 Acc", value: model.top1 },
                { label: "Input Size", value: model.inputSize },
                { label: "Depth", value: `${model.depth} layers` },
                { label: "Source", value: model.source },
              ].map(s => (
                <div key={s.label} className="bg-[#07090f] border border-border px-3 py-2.5">
                  <div className="text-[8px] uppercase tracking-widest text-[#525c70] mb-1" style={MONO}>{s.label}</div>
                  <div className="text-[12px] font-medium text-[#d4dae8]" style={MONO}>{s.value}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-2" style={MONO}>Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {model.tags.map(t => (
                  <span key={t} className="text-[9px] uppercase tracking-widest px-2 py-0.5 border border-[rgba(255,255,255,0.07)] text-[#525c70]" style={MONO}>{t}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button className="flex-1 py-2 text-[10px] uppercase tracking-widest font-medium transition-colors border"
                style={{ color: fc.text, borderColor: fc.border, backgroundColor: fc.bg, ...MONO }}>
                Use as Base Model
              </button>
              <button className="px-4 py-2 text-[10px] uppercase tracking-widest text-[#525c70] border border-border hover:text-[#8891a8] transition-colors" style={MONO}>
                <Download size={11} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelsView() {
  const [search, setSearch] = useState("");
  const [activeFamily, setActiveFamily] = useState<ModelFamily | "All">("All");
  const [sortBy, setSortBy] = useState<"name" | "params" | "top1" | "forks">("forks");
  const [archModal, setArchModal] = useState<ModelCard | null>(null);
  const [baseToast, setBaseToast] = useState<string | null>(null);

  const families: (ModelFamily | "All")[] = ["All", "CNN", "Transformer", "Classical", "Segmentation", "Detection", "Lightweight", "Multimodal"];

  const filtered = useMemo(() => {
    return MODELS
      .filter(m => {
        if (activeFamily !== "All" && m.family !== activeFamily) return false;
        if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.description.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "forks") return b.forks - a.forks;
        if (sortBy === "params") return parseFloat(a.params) - parseFloat(b.params);
        if (sortBy === "top1") {
          const av = parseFloat(a.top1) || 0;
          const bv = parseFloat(b.top1) || 0;
          return bv - av;
        }
        return 0;
      });
  }, [search, activeFamily, sortBy]);

  const handleUseBase = (id: string) => {
    const m = MODELS.find(m => m.id === id)!;
    setBaseToast(m.name);
    setTimeout(() => setBaseToast(null), 2800);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-hidden">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-border">
        <div className="max-w-[1600px] mx-auto px-6 pt-6 pb-4">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Layers size={14} className="text-[#00d4a0]" strokeWidth={1.5} />
                <h1 className="text-sm font-semibold text-[#d4dae8] uppercase tracking-widest" style={MONO}>Model Library</h1>
              </div>
              <p className="text-[11px] text-[#525c70]" style={MONO}>
                {MODELS.length} architectures · select a base for your next training run
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-[#525c70] mr-1" style={MONO}>Sort</span>
              {(["forks", "top1", "params", "name"] as const).map(s => (
                <button key={s}
                  onClick={() => setSortBy(s)}
                  className="px-2.5 py-1 text-[9px] uppercase tracking-widest border transition-colors"
                  style={{ color: sortBy === s ? "#00d4a0" : "#525c70", borderColor: sortBy === s ? "rgba(0,212,160,0.4)" : "rgba(255,255,255,0.07)", backgroundColor: sortBy === s ? "rgba(0,212,160,0.08)" : "transparent", ...MONO }}>
                  {s === "top1" ? "Accuracy" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: "Total Models", value: String(MODELS.length), color: "#d4dae8" },
              { label: "CNN Architectures", value: String(MODELS.filter(m => m.family === "CNN").length), color: "#00d4a0" },
              { label: "Transformers", value: String(MODELS.filter(m => m.family === "Transformer").length), color: "#7c6cf8" },
              { label: "Classical ML", value: String(MODELS.filter(m => m.family === "Classical").length), color: "#e8a838" },
              { label: "Seg / Det", value: String(MODELS.filter(m => m.family === "Segmentation" || m.family === "Detection").length), color: "#3ba6ff" },
              { label: "Starred", value: String(MODELS.filter(m => m.starred).length), color: "#f5a623" },
            ].map(c => (
              <div key={c.label} className="border border-border bg-card px-4 py-2.5">
                <div className="text-[8px] uppercase tracking-widest text-[#525c70] mb-1" style={MONO}>{c.label}</div>
                <div className="text-lg font-semibold" style={{ color: c.color, ...MONO }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="shrink-0 border-b border-border bg-[#0a0d14]">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-6 py-3">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 w-56">
            <Search size={11} className="text-[#525c70] shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search architectures…"
              className="bg-transparent outline-none text-[11px] text-[#d4dae8] placeholder-[#525c70] w-full" style={MONO} />
            {search && <button onClick={() => setSearch("")}><X size={10} className="text-[#525c70] hover:text-[#8891a8]" /></button>}
          </div>

          {/* Family filters */}
          <div className="flex items-center gap-1 flex-1">
            {families.map(f => {
              const active = activeFamily === f;
              const fc = f === "All" ? null : FAMILY_COLORS[f];
              return (
                <button key={f} onClick={() => setActiveFamily(f)}
                  className="px-2.5 py-1 text-[9px] uppercase tracking-widest border transition-colors whitespace-nowrap"
                  style={{
                    color: active ? (fc?.text ?? "#00d4a0") : "#525c70",
                    borderColor: active ? (fc?.border ?? "rgba(0,212,160,0.4)") : "rgba(255,255,255,0.07)",
                    backgroundColor: active ? (fc?.bg ?? "rgba(0,212,160,0.08)") : "transparent",
                    ...MONO,
                  }}>
                  {f}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-[#525c70]" style={MONO}>{filtered.length} / {MODELS.length}</div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-5">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-[#525c70] text-[11px]" style={MONO}>No models match.</div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
              {filtered.map(m => (
                <ModelCardComponent
                  key={m.id}
                  model={m}
                  onUseBase={handleUseBase}
                  onViewArch={id => setArchModal(MODELS.find(x => x.id === id)!)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Arch modal */}
      {archModal && <ArchModal model={archModal} onClose={() => setArchModal(null)} />}

      {/* Base toast */}
      {baseToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#0d1017] border border-[rgba(0,212,160,0.4)]">
          <CheckCircle2 size={13} className="text-[#00d4a0]" />
          <span className="text-[11px] text-[#d4dae8]" style={MONO}>
            <span className="text-[#00d4a0]">{baseToast}</span> set as base model
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Hardware view ────────────────────────────────────────────────────────────

const EPOCH_COUNT = 100;
const HISTORY_PTS = 120; // data points per epoch window

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function buildEpochHistory(): {
  gpu0: number[]; gpu1: number[]; gpu2: number[]; gpu3: number[];
  vram: number[]; ram: number[]; cpu: number[];
  temp0: number[]; temp1: number[]; temp2: number[]; temp3: number[];
  power: number[];
  diskRead: number[]; diskWrite: number[];
  netRx: number[]; netTx: number[];
  epoch: number[];
} {
  const rand = seededRand(42);
  const n = EPOCH_COUNT;
  const build = (base: number, noise: number, trend = 0) =>
    Array.from({ length: n }, (_, i) => Math.max(0, Math.min(100, base + trend * i + (rand() - 0.5) * noise)));
  return {
    gpu0: build(82, 14),
    gpu1: build(78, 16),
    gpu2: build(85, 12),
    gpu3: build(80, 15),
    vram: build(71, 8, 0.05),
    ram: build(52, 6),
    cpu: build(48, 20),
    temp0: build(74, 7),
    temp1: build(71, 8),
    temp2: build(76, 6),
    temp3: build(73, 7),
    power: build(81, 5),
    diskRead: build(34, 40),
    diskWrite: build(18, 35),
    netRx: build(22, 30),
    netTx: build(8, 20),
    epoch: Array.from({ length: n }, (_, i) => i + 1),
  };
}

const HW_HISTORY = buildEpochHistory();

// Dense time-series for the live rolling window (last N points of a metric)
function rollingSlice(arr: number[], epochIdx: number, window = 40): { t: number; v: number }[] {
  const start = Math.max(0, epochIdx - window + 1);
  return arr.slice(start, epochIdx + 1).map((v, i) => ({ t: start + i, v }));
}

// Heatmap temperature cell: 8×4 SM grid for one GPU
function SMHeatmap({ temps }: { temps: number[] }) {
  // temps: 32 values 0-100
  const cols = 8; const rows = 4;
  const color = (v: number) => {
    if (v < 50) return `rgba(0,212,160,${0.15 + v / 50 * 0.45})`;
    if (v < 75) return `rgba(245,166,35,${0.4 + (v - 50) / 25 * 0.4})`;
    return `rgba(240,64,64,${0.6 + (v - 75) / 25 * 0.4})`;
  };
  return (
    <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {temps.map((v, i) => (
        <div key={i} title={`SM${i}: ${v.toFixed(0)}°C`}
          className="aspect-square transition-colors duration-500"
          style={{ backgroundColor: color(v), minWidth: 0 }}
        />
      ))}
    </div>
  );
}

// Circular gauge for a single metric
function Gauge({ value, max = 100, label, sublabel, color }: {
  value: number; max?: number; label: string; sublabel: string; color: string;
}) {
  const pct = Math.min(1, value / max);
  const r = 28; const cx = 36; const cy = 36;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75; // 270° sweep
  const offset = arc - pct * arc;
  const rot = -225; // start at bottom-left

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={72} height={72} viewBox="0 0 72 72">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)"
          strokeWidth={5} strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={0} strokeLinecap="butt"
          transform={`rotate(${rot} ${cx} ${cy})`} />
        {/* Fill */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
          strokeWidth={5} strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={offset} strokeLinecap="butt"
          transform={`rotate(${rot} ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        <text x={cx} y={cy - 2} textAnchor="middle" fill="#d4dae8" fontSize={11} fontWeight={600} fontFamily="JetBrains Mono">{value.toFixed(0)}</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="#525c70" fontSize={7} fontFamily="JetBrains Mono">{sublabel}</text>
      </svg>
      <span className="text-[9px] uppercase tracking-widest text-[#525c70] text-center" style={MONO}>{label}</span>
    </div>
  );
}

// Small labeled area chart panel
function MetricPanel({ title, data, color, unit = "%", height = 80, fillId }: {
  title: string; data: { t: number; v: number }[]; color: string; unit?: string; height?: number; fillId: string;
}) {
  const last = data[data.length - 1]?.v ?? 0;
  return (
    <div className="bg-card border border-border flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>{title}</span>
        <span className="text-[10px] font-semibold" style={{ color, ...MONO }}>{last.toFixed(1)}{unit}</span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: -32, bottom: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, 100]} tick={{ fill: "#525c70", fontSize: 8, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickCount={3} />
            <Tooltip
              content={({ active, payload }) => active && payload?.length ? (
                <div style={{ backgroundColor: "#0d1017", border: "1px solid rgba(255,255,255,0.07)", ...MONO, fontSize: 10, padding: "4px 8px", color }}>
                  {payload[0].value?.toFixed(1)}{unit}
                </div>
              ) : null}
            />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.2} fill={`url(#${fillId})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HardwareView({ liveHw }: { liveHw: HardwarePoint[] }) {
  const [epochIdx, setEpochIdx] = useState(EPOCH_COUNT - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeGpu, setActiveGpu] = useState(0);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Play / pause timeline
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setEpochIdx(i => {
          if (i >= EPOCH_COUNT - 1) { setIsPlaying(false); return EPOCH_COUNT - 1; }
          return i + 1;
        });
      }, 120);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [isPlaying]);

  const isLive = epochIdx === EPOCH_COUNT - 1;

  // Metric series for the current epoch window
  const gpuSeries = [HW_HISTORY.gpu0, HW_HISTORY.gpu1, HW_HISTORY.gpu2, HW_HISTORY.gpu3];
  const tempSeries = [HW_HISTORY.temp0, HW_HISTORY.temp1, HW_HISTORY.temp2, HW_HISTORY.temp3];
  const GPU_LABELS = ["GPU 0", "GPU 1", "GPU 2", "GPU 3"];
  const GPU_COLORS = ["#7c6cf8", "#00d4a0", "#3ba6ff", "#f5a623"];

  const window = 40;
  const gpuData = gpuSeries.map(s => rollingSlice(s, epochIdx, window));
  const vramData = rollingSlice(HW_HISTORY.vram, epochIdx, window);
  const ramData = rollingSlice(HW_HISTORY.ram, epochIdx, window);
  const cpuData = rollingSlice(HW_HISTORY.cpu, epochIdx, window);
  const tempData = tempSeries.map(s => rollingSlice(s, epochIdx, window));
  const diskReadData = rollingSlice(HW_HISTORY.diskRead, epochIdx, window);
  const diskWriteData = rollingSlice(HW_HISTORY.diskWrite, epochIdx, window);
  const netRxData = rollingSlice(HW_HISTORY.netRx, epochIdx, window);
  const netTxData = rollingSlice(HW_HISTORY.netTx, epochIdx, window);

  // Point values at epochIdx
  const gpuVals = gpuSeries.map(s => s[epochIdx] ?? 0);
  const tempVals = tempSeries.map(s => s[epochIdx] ?? 0);
  const vramVal = HW_HISTORY.vram[epochIdx] ?? 0;
  const ramVal = HW_HISTORY.ram[epochIdx] ?? 0;
  const cpuVal = HW_HISTORY.cpu[epochIdx] ?? 0;
  const powerVal = HW_HISTORY.power[epochIdx] ?? 0;

  // SM heatmap: 32 fake SM temps based on active gpu temp + noise
  const rand = seededRand(epochIdx * 7 + activeGpu * 3);
  const smTemps = Array.from({ length: 32 }, () =>
    Math.max(30, Math.min(95, tempVals[activeGpu] + (rand() - 0.5) * 18))
  );

  // Combined GPU+CPU overlay chart data
  const multiGpuData = rollingSlice(HW_HISTORY.gpu0, epochIdx, window).map((pt, i) => ({
    t: pt.t,
    gpu0: gpuData[0][i]?.v ?? 0,
    gpu1: gpuData[1][i]?.v ?? 0,
    gpu2: gpuData[2][i]?.v ?? 0,
    gpu3: gpuData[3][i]?.v ?? 0,
  }));

  // Disk combined
  const diskData = diskReadData.map((pt, i) => ({
    t: pt.t,
    read: pt.v,
    write: diskWriteData[i]?.v ?? 0,
  }));

  // Net combined
  const netData = netRxData.map((pt, i) => ({
    t: pt.t,
    rx: pt.v,
    tx: netTxData[i]?.v ?? 0,
  }));

  const epochLabel = `Epoch ${HW_HISTORY.epoch[epochIdx]}`;

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-hidden">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-border">
        <div className="max-w-[1600px] mx-auto px-6 pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Server size={14} className="text-[#7c6cf8]" strokeWidth={1.5} />
                <h1 className="text-sm font-semibold text-[#d4dae8] uppercase tracking-widest" style={MONO}>Hardware Monitor</h1>
                {isLive && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00d4a0] animate-pulse" />
                    <span className="text-[9px] text-[#00d4a0] uppercase tracking-widest" style={MONO}>Live</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#525c70]" style={MONO}>
                4× NVIDIA A100 80GB · 32-core Xeon · 512GB DDR5 · NVMe RAID-0
              </p>
            </div>

            {/* Top stat pills */}
            <div className="flex items-center gap-3">
              {[
                { label: "Power Draw", value: `${(powerVal / 100 * 320).toFixed(0)}W`, color: "#f5a623" },
                { label: "Peak GPU", value: `${Math.max(...gpuVals).toFixed(0)}%`, color: "#7c6cf8" },
                { label: "Avg Temp", value: `${(tempVals.reduce((a, b) => a + b, 0) / 4).toFixed(0)}°C`, color: "#f04040" },
                { label: "Epoch", value: epochLabel, color: "#d4dae8" },
              ].map(s => (
                <div key={s.label} className="border border-border bg-card px-3 py-2 text-right">
                  <div className="text-[8px] uppercase tracking-widest text-[#525c70]" style={MONO}>{s.label}</div>
                  <div className="text-[13px] font-semibold mt-0.5" style={{ color: s.color, ...MONO }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline slider ── */}
      <div className="shrink-0 border-b border-border bg-[#0a0d14]">
        <div className="max-w-[1600px] mx-auto flex items-center gap-4 px-6 py-3">
          <button
            onClick={() => { if (epochIdx > 0) { setIsPlaying(false); setEpochIdx(0); } }}
            className="text-[#525c70] hover:text-[#8891a8] transition-colors text-[9px] uppercase tracking-widest" style={MONO}
          >|◀</button>
          <button
            onClick={() => setIsPlaying(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1 text-[9px] uppercase tracking-widest border transition-colors"
            style={{ color: isPlaying ? "#f5a623" : "#00d4a0", borderColor: isPlaying ? "rgba(245,166,35,0.4)" : "rgba(0,212,160,0.4)", backgroundColor: isPlaying ? "rgba(245,166,35,0.08)" : "rgba(0,212,160,0.06)", ...MONO }}
          >
            {isPlaying ? <><Pause size={9} />Pause</> : <><Play size={9} />Play</>}
          </button>

          {/* Epoch tick marks + slider */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="relative flex items-center">
              <input
                type="range" min={0} max={EPOCH_COUNT - 1} value={epochIdx}
                onChange={e => { setIsPlaying(false); setEpochIdx(Number(e.target.value)); }}
                className="w-full h-px appearance-none cursor-pointer"
                style={{ accentColor: "#00d4a0", background: `linear-gradient(to right, #00d4a0 ${epochIdx / (EPOCH_COUNT - 1) * 100}%, rgba(255,255,255,0.08) 0%)` }}
              />
            </div>
            {/* Epoch labels */}
            <div className="flex justify-between text-[8px] text-[#525c70] px-0.5" style={MONO}>
              {[1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(e => (
                <span key={e} className={e - 1 === epochIdx ? "text-[#00d4a0]" : ""}>{e}</span>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setIsPlaying(false); setEpochIdx(EPOCH_COUNT - 1); }}
            className="text-[#525c70] hover:text-[#8891a8] transition-colors text-[9px] uppercase tracking-widest" style={MONO}
          >▶|</button>

          <div className="text-[10px] text-[#00d4a0] border border-[rgba(0,212,160,0.3)] px-2 py-1 min-w-[80px] text-center" style={MONO}>
            {epochLabel}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-4 space-y-4">

          {/* Row 1: GPU core gauges + multi-GPU line chart */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "320px 1fr" }}>

            {/* GPU gauges */}
            <div className="bg-card border border-border flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>GPU Core Utilization</span>
                <span className="text-[9px] text-[#525c70]" style={MONO}>A100 80GB × 4</span>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-4 gap-2 justify-items-center">
                  {GPU_LABELS.map((label, i) => (
                    <div key={label} onClick={() => setActiveGpu(i)} className="cursor-pointer">
                      <Gauge value={gpuVals[i]} label={label} sublabel="%" color={activeGpu === i ? GPU_COLORS[i] : GPU_COLORS[i] + "80"} />
                    </div>
                  ))}
                </div>
                {/* Per-gpu thin bar rows */}
                <div className="space-y-2 pt-1 border-t border-border">
                  {GPU_LABELS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[9px] w-10 text-right" style={{ color: GPU_COLORS[i], ...MONO }}>{label}</span>
                      <div className="flex-1 h-1 bg-[#131825]">
                        <div className="h-full transition-all duration-500" style={{ width: `${gpuVals[i]}%`, backgroundColor: GPU_COLORS[i] }} />
                      </div>
                      <span className="text-[9px] w-8 text-right text-[#8891a8]" style={MONO}>{gpuVals[i].toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Multi-GPU line chart */}
            <div className="bg-card border border-border flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>GPU Utilization · Timeline</span>
                <div className="flex items-center gap-3">
                  {GPU_LABELS.map((l, i) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-2 h-px" style={{ backgroundColor: GPU_COLORS[i] }} />
                      <span className="text-[8px] text-[#525c70]" style={MONO}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={multiGpuData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="t" tick={{ fill: "#525c70", fontSize: 8, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#525c70", fontSize: 8, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={v => v + "%"} />
                    <Tooltip contentStyle={{ backgroundColor: "#0d1017", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 10 }} />
                    {(["gpu0", "gpu1", "gpu2", "gpu3"] as const).map((key, i) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={GPU_COLORS[i]} dot={false} strokeWidth={activeGpu === i ? 2 : 1} opacity={activeGpu === i ? 1 : 0.45} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: VRAM + RAM + CPU area charts */}
          <div className="grid grid-cols-3 gap-3">
            <MetricPanel title="VRAM Usage" data={vramData} color="#7c6cf8" fillId="vramFill" height={88} />
            <MetricPanel title="System RAM" data={ramData} color="#3ba6ff" fillId="ramFill" height={88} />
            <MetricPanel title="CPU Utilization" data={cpuData} color="#00d4a0" fillId="cpuFill" height={88} />
          </div>

          {/* Row 3: Temperature heatmap + temp timeline */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>

            {/* SM heatmap */}
            <div className="bg-card border border-border flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Thermometer size={11} className="text-[#f04040]" strokeWidth={1.5} />
                  <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>
                    SM Temperature Map · {GPU_LABELS[activeGpu]}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {GPU_LABELS.map((l, i) => (
                    <button key={l} onClick={() => setActiveGpu(i)}
                      className="text-[8px] px-1.5 py-0.5 border transition-colors uppercase tracking-widest"
                      style={{ color: activeGpu === i ? GPU_COLORS[i] : "#525c70", borderColor: activeGpu === i ? GPU_COLORS[i] + "60" : "rgba(255,255,255,0.07)", backgroundColor: activeGpu === i ? GPU_COLORS[i] + "12" : "transparent", ...MONO }}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <SMHeatmap temps={smTemps} />
                {/* legend */}
                <div className="flex items-center gap-3 text-[8px] text-[#525c70]" style={MONO}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2" style={{ backgroundColor: "rgba(0,212,160,0.5)" }} />
                    <span>&lt;50°C</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2" style={{ backgroundColor: "rgba(245,166,35,0.7)" }} />
                    <span>50–75°C</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2" style={{ backgroundColor: "rgba(240,64,64,0.8)" }} />
                    <span>&gt;75°C</span>
                  </div>
                  <div className="ml-auto">
                    Peak: <span style={{ color: "#f04040" }}>{Math.max(...smTemps).toFixed(0)}°C</span>
                    &nbsp;·&nbsp;Avg: <span style={{ color: "#f5a623" }}>{(smTemps.reduce((a, b) => a + b, 0) / smTemps.length).toFixed(0)}°C</span>
                  </div>
                </div>
                {/* Per-GPU temp summary */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
                  {GPU_LABELS.map((label, i) => (
                    <div key={label} className="text-center">
                      <div className="text-[8px] text-[#525c70] mb-0.5" style={MONO}>{label}</div>
                      <div className="text-[12px] font-semibold" style={{ color: tempVals[i] > 80 ? "#f04040" : tempVals[i] > 70 ? "#f5a623" : "#00d4a0", ...MONO }}>
                        {tempVals[i].toFixed(0)}°C
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Temp timeline */}
            <div className="bg-card border border-border flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Activity size={11} className="text-[#f5a623]" strokeWidth={1.5} />
                  <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>Temperature · Timeline</span>
                </div>
                <div className="flex items-center gap-3">
                  {GPU_LABELS.map((l, i) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-2 h-px" style={{ backgroundColor: GPU_COLORS[i] }} />
                      <span className="text-[8px] text-[#525c70]" style={MONO}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={tempData[0].map((pt, i) => ({
                      t: pt.t, t0: pt.v,
                      t1: tempData[1][i]?.v ?? 0,
                      t2: tempData[2][i]?.v ?? 0,
                      t3: tempData[3][i]?.v ?? 0,
                    }))}
                    margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="t" tick={{ fill: "#525c70", fontSize: 8, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis domain={[40, 100]} tick={{ fill: "#525c70", fontSize: 8, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={v => v + "°"} />
                    <Tooltip contentStyle={{ backgroundColor: "#0d1017", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 10 }} />
                    <Line type="monotone" dataKey="t0" stroke={GPU_COLORS[0]} dot={false} strokeWidth={1.2} name="GPU 0" />
                    <Line type="monotone" dataKey="t1" stroke={GPU_COLORS[1]} dot={false} strokeWidth={1.2} name="GPU 1" />
                    <Line type="monotone" dataKey="t2" stroke={GPU_COLORS[2]} dot={false} strokeWidth={1.2} name="GPU 2" />
                    <Line type="monotone" dataKey="t3" stroke={GPU_COLORS[3]} dot={false} strokeWidth={1.2} name="GPU 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Inline power bar */}
              <div className="px-4 pt-2 pb-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>Total Power Draw</span>
                  <span className="text-[10px] font-semibold text-[#f5a623]" style={MONO}>{(powerVal / 100 * 320).toFixed(0)} W / 1280 W</span>
                </div>
                <div className="h-1.5 bg-[#131825]">
                  <div className="h-full transition-all duration-500" style={{ width: `${powerVal}%`, background: `linear-gradient(to right, #f5a623, #f04040)` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Disk I/O + Network I/O + memory detail */}
          <div className="grid grid-cols-3 gap-3">

            {/* Disk I/O */}
            <div className="bg-card border border-border flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <HardDrive size={11} className="text-[#3ba6ff]" strokeWidth={1.5} />
                  <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>Storage I/O</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1"><div className="w-2 h-px bg-[#3ba6ff]" /><span className="text-[8px] text-[#525c70]" style={MONO}>Read</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-px bg-[#f5a623]" /><span className="text-[8px] text-[#525c70]" style={MONO}>Write</span></div>
                </div>
              </div>
              <div style={{ height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={diskData} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="diskRFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3ba6ff" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3ba6ff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="diskWFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f5a623" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f5a623" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" hide />
                    <YAxis tick={{ fill: "#525c70", fontSize: 7, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} domain={[0, 100]} tickCount={3} />
                    <Tooltip contentStyle={{ backgroundColor: "#0d1017", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 10 }} />
                    <Area type="monotone" dataKey="read" stroke="#3ba6ff" strokeWidth={1.2} fill="url(#diskRFill)" dot={false} name="Read" />
                    <Area type="monotone" dataKey="write" stroke="#f5a623" strokeWidth={1.2} fill="url(#diskWFill)" dot={false} name="Write" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-px border-t border-border">
                <div className="px-3 py-2">
                  <div className="text-[8px] text-[#525c70] mb-0.5" style={MONO}>Read</div>
                  <div className="text-[11px] font-semibold text-[#3ba6ff]" style={MONO}>{(diskData[diskData.length - 1]?.read / 100 * 6.8).toFixed(1)} GB/s</div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[8px] text-[#525c70] mb-0.5" style={MONO}>Write</div>
                  <div className="text-[11px] font-semibold text-[#f5a623]" style={MONO}>{(diskData[diskData.length - 1]?.write / 100 * 6.8).toFixed(1)} GB/s</div>
                </div>
              </div>
            </div>

            {/* Network I/O */}
            <div className="bg-card border border-border flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Network size={11} className="text-[#00d4a0]" strokeWidth={1.5} />
                  <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>Network I/O</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1"><div className="w-2 h-px bg-[#00d4a0]" /><span className="text-[8px] text-[#525c70]" style={MONO}>Rx</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-px bg-[#e879a0]" /><span className="text-[8px] text-[#525c70]" style={MONO}>Tx</span></div>
                </div>
              </div>
              <div style={{ height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netData} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="netRxFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00d4a0" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00d4a0" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="netTxFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e879a0" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#e879a0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" hide />
                    <YAxis tick={{ fill: "#525c70", fontSize: 7, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} domain={[0, 100]} tickCount={3} />
                    <Tooltip contentStyle={{ backgroundColor: "#0d1017", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 10 }} />
                    <Area type="monotone" dataKey="rx" stroke="#00d4a0" strokeWidth={1.2} fill="url(#netRxFill)" dot={false} name="Rx" />
                    <Area type="monotone" dataKey="tx" stroke="#e879a0" strokeWidth={1.2} fill="url(#netTxFill)" dot={false} name="Tx" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-px border-t border-border">
                <div className="px-3 py-2">
                  <div className="text-[8px] text-[#525c70] mb-0.5" style={MONO}>Rx</div>
                  <div className="text-[11px] font-semibold text-[#00d4a0]" style={MONO}>{(netData[netData.length - 1]?.rx / 100 * 25).toFixed(1)} Gb/s</div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[8px] text-[#525c70] mb-0.5" style={MONO}>Tx</div>
                  <div className="text-[11px] font-semibold text-[#e879a0]" style={MONO}>{(netData[netData.length - 1]?.tx / 100 * 25).toFixed(1)} Gb/s</div>
                </div>
              </div>
            </div>

            {/* Memory detail */}
            <div className="bg-card border border-border flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <Cpu size={11} className="text-[#7c6cf8]" strokeWidth={1.5} />
                <span className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>Memory Detail</span>
              </div>
              <div className="p-4 space-y-3 flex-1">
                {[
                  { label: "GPU 0 VRAM", used: vramVal * 0.8 / 100 * 80, total: 80, color: "#7c6cf8", unit: "GB" },
                  { label: "GPU 1 VRAM", used: vramVal * 0.77 / 100 * 80, total: 80, color: "#00d4a0", unit: "GB" },
                  { label: "GPU 2 VRAM", used: vramVal * 0.82 / 100 * 80, total: 80, color: "#3ba6ff", unit: "GB" },
                  { label: "GPU 3 VRAM", used: vramVal * 0.79 / 100 * 80, total: 80, color: "#f5a623", unit: "GB" },
                  { label: "System RAM", used: ramVal / 100 * 512, total: 512, color: "#8891a8", unit: "GB" },
                ].map(m => (
                  <div key={m.label} className="space-y-1">
                    <div className="flex justify-between text-[9px]" style={MONO}>
                      <span className="text-[#525c70]">{m.label}</span>
                      <span style={{ color: m.color }}>{m.used.toFixed(1)} / {m.total}{m.unit}</span>
                    </div>
                    <div className="h-1 bg-[#131825]">
                      <div className="h-full transition-all duration-500" style={{ width: `${(m.used / m.total) * 100}%`, backgroundColor: m.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard view (original) ────────────────────────────────────────────────

const customTooltipStyle: React.CSSProperties = {
  backgroundColor: "#0d1017", border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 0, ...MONO, fontSize: 11, color: "#d4dae8",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={customTooltipStyle} className="px-3 py-2 text-[11px]">
      <div className="text-[#525c70] mb-1">step {label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-3 justify-between">
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: p.color }}>{p.value?.toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
};

function DashboardView({ metrics, hw, termLines, isRunning, epoch, params, setParams, termOpen, setTermOpen }: {
  metrics: MetricPoint[]; hw: HardwarePoint[]; termLines: string[];
  isRunning: boolean; epoch: number;
  params: HyperParams; setParams: (p: HyperParams) => void;
  termOpen: boolean; setTermOpen: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<"loss" | "accuracy">("loss");

  const colorLine = (line: string) => {
    if (line.includes("VAL")) return "#7c6cf8";
    if (line.includes("TRAIN")) return "#00d4a0";
    if (line.includes("GPU")) return "#f5a623";
    if (line.includes("INFO")) return "#3ba6ff";
    return "#8891a8";
  };

  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [termLines]);

  return (
    <main className="flex-1 min-w-0 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_260px] gap-px bg-border overflow-auto" style={{ gridTemplateRows: "1fr auto" }}>
        {/* Metrics chart */}
        <div className="bg-card overflow-hidden flex flex-col" style={{ minHeight: 300 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#525c70]" style={MONO}>Training Metrics</span>
            <div className="flex border border-border">
              {(["loss", "accuracy"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 text-[10px] uppercase tracking-widest transition-colors ${tab === t ? "bg-[#00d4a0] text-[#07090f]" : "text-[#525c70] hover:text-[#8891a8]"}`}
                  style={MONO}>{t}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 p-4" style={{ minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              {tab === "loss" ? (
                <LineChart key="loss" data={metrics} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="step" tick={{ fill: "#525c70", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#525c70", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="trainLoss" name="loss-train" stroke="#00d4a0" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="valLoss" name="loss-val" stroke="#7c6cf8" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                </LineChart>
              ) : (
                <LineChart key="accuracy" data={metrics} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="step" tick={{ fill: "#525c70", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#525c70", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} domain={[0.5, 1]} tickFormatter={(v) => (v * 100).toFixed(0) + "%"} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="trainAcc" name="acc-train" stroke="#f5a623" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="valAcc" name="acc-val" stroke="#3ba6ff" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-px bg-border">
          {/* Hardware */}
          <div className="bg-card p-4 space-y-4">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#525c70] block" style={MONO}>Hardware</span>
            {hw[hw.length - 1] && (
              <>
                <UtilBar label="GPU · A100 80GB" value={hw[hw.length - 1].gpu} color="#7c6cf8" />
                <UtilBar label="VRAM" value={hw[hw.length - 1].vram} color="#f5a623" />
                <UtilBar label="CPU" value={hw[hw.length - 1].cpu} color="#00d4a0" />
                <UtilBar label="RAM" value={hw[hw.length - 1].ram} color="#3ba6ff" />
              </>
            )}
            <div style={{ height: 60 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hw.slice(-30)} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gpuGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c6cf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c6cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide /><YAxis domain={[0, 100]} hide />
                  <Area type="monotone" dataKey="gpu" stroke="#7c6cf8" strokeWidth={1} fill="url(#gpuGrad2)" dot={false} />
                  <Area type="monotone" dataKey="cpu" stroke="#00d4a0" strokeWidth={1} fill="none" dot={false} strokeDasharray="3 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hyperparams */}
          <div className="bg-card flex-1 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#525c70]" style={MONO}>Hyperparameters</span>
              <button className="text-[10px] text-[#00d4a0] uppercase tracking-widest px-2 py-0.5 border border-[rgba(0,212,160,0.3)] hover:bg-[rgba(0,212,160,0.08)] transition-colors" style={MONO}>Apply</button>
            </div>
            <div className="p-4 space-y-1 overflow-y-auto flex-1">
              {(Object.entries(params) as [keyof HyperParams, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center group">
                  <label className="text-[10px] text-[#525c70] uppercase tracking-widest w-28 shrink-0 group-hover:text-[#8891a8] transition-colors" style={MONO}>
                    {k.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input value={v} onChange={e => setParams({ ...params, [k]: e.target.value })}
                    className="flex-1 bg-transparent border-b border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] focus:border-[#00d4a0] outline-none py-1.5 px-2 text-[11px] text-[#d4dae8] transition-colors"
                    style={MONO} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom mini experiments */}
        <div className="bg-card col-span-2 overflow-auto" style={{ maxHeight: 160 }}>
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#525c70]" style={MONO}>Recent Runs</span>
          </div>
          <table className="w-full text-[11px]" style={MONO}>
            <tbody>
              {RUNS.slice(0, 4).map(r => (
                <tr key={r.runId} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="px-4 py-2 text-[#525c70]">{r.runId}</td>
                  <td className="px-4 py-2 text-[#d4dae8]">{r.name}</td>
                  <td className="px-4 py-2 text-[#8891a8]">{r.modelType}</td>
                  <td className="px-4 py-2 text-[#8891a8]">{r.dataset}</td>
                  <td className="px-4 py-2 text-[#00d4a0]">{(r.bestValAcc * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2"><StatusChip status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminal */}
      <div className={`border-t border-border bg-[#07090f] flex flex-col transition-all duration-200 ${termOpen ? "h-40" : "h-9"}`}>
        <div className="h-9 shrink-0 flex items-center justify-between px-4 cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          onClick={() => setTermOpen(!termOpen)}>
          <div className="flex items-center gap-2">
            <Terminal size={11} className="text-[#525c70]" />
            <span className="text-[10px] uppercase tracking-widest text-[#525c70]" style={MONO}>Training Log</span>
            {isRunning && <div className="flex items-center gap-1 text-[9px] text-[#00d4a0]" style={MONO}><RefreshCw size={8} className="animate-spin" />LIVE</div>}
          </div>
          {termOpen ? <ChevronDown size={12} className="text-[#525c70]" /> : <ChevronUp size={12} className="text-[#525c70]" />}
        </div>
        {termOpen && (
          <div ref={termRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-0.5">
            {termLines.map((line, i) => (
              <div key={`${i}-${line.slice(0, 20)}`} className="text-[11px] leading-5 whitespace-pre" style={{ ...MONO, color: colorLine(line) }}>
                <span className="text-[#525c70]">{line.slice(0, 22)}</span>
                <span>{line.slice(22)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Datasets view ────────────────────────────────────────────────────────────

type DatasetCategory = "Image" | "Text" | "Tabular" | "Audio";

interface PreloadedDataset {
  id: string;
  name: string;
  category: DatasetCategory;
  samples: number;
  size: string;
  format: string;
  classes: number;
  features: number;
  splits: string[];
  description: string;
  classDistribution: { name: string; count: number }[];
  schema: { column: string; dtype: string; nonNull: number; mean?: string; min?: string; max?: string }[];
  sampleRows: Record<string, string | number>[];
}

const PRELOADED_DATASETS: PreloadedDataset[] = [
  {
    id: "imagenet", name: "ImageNet-1K", category: "Image", samples: 1281167, size: "138 GB", format: "JPEG", classes: 1000, features: 3, splits: ["train", "val"],
    description: "Large-scale image classification benchmark with 1000 categories.",
    classDistribution: [{name:"dog",count:1300},{name:"cat",count:1300},{name:"car",count:1300},{name:"bird",count:1300},{name:"fish",count:1300},{name:"flower",count:1281},{name:"insect",count:1281},{name:"food",count:1281}],
    schema: [{column:"image",dtype:"PIL.Image",nonNull:1281167},{column:"label",dtype:"int64",nonNull:1281167,min:"0",max:"999"},{column:"width",dtype:"int32",nonNull:1281167,mean:"469",min:"75",max:"4288"}],
    sampleRows: [{image:"n01440764_10026.JPEG",label:0,width:500,height:375},{image:"n01440764_10027.JPEG",label:0,width:640,height:480},{image:"n01443537_2.JPEG",label:1,width:320,height:240},{image:"n01443537_23.JPEG",label:1,width:480,height:360},{image:"n01484850_18.JPEG",label:2,width:512,height:384}],
  },
  {
    id: "coco", name: "COCO 2017", category: "Image", samples: 118287, size: "18 GB", format: "JPEG", classes: 80, features: 5, splits: ["train", "val", "test"],
    description: "Object detection, segmentation, and captioning dataset.",
    classDistribution: [{name:"person",count:64115},{name:"car",count:12251},{name:"chair",count:9820},{name:"book",count:6332},{name:"bottle",count:5608},{name:"cup",count:4958},{name:"table",count:4510},{name:"truck",count:2312}],
    schema: [{column:"image_id",dtype:"int64",nonNull:118287},{column:"file_name",dtype:"string",nonNull:118287},{column:"annotations",dtype:"list[dict]",nonNull:118287},{column:"width",dtype:"int32",nonNull:118287,mean:"580",min:"112",max:"640"},{column:"height",dtype:"int32",nonNull:118287,mean:"456",min:"100",max:"640"}],
    sampleRows: [{image_id:139,file_name:"000000000139.jpg",num_annotations:4,width:640,height:426},{image_id:285,file_name:"000000000285.jpg",num_annotations:9,width:640,height:586},{image_id:632,file_name:"000000000632.jpg",num_annotations:2,width:640,height:480},{image_id:724,file_name:"000000000724.jpg",num_annotations:5,width:480,height:640},{image_id:776,file_name:"000000000776.jpg",num_annotations:1,width:640,height:427}],
  },
  {
    id: "mnist", name: "MNIST", category: "Image", samples: 70000, size: "11 MB", format: "IDX", classes: 10, features: 1, splits: ["train", "test"],
    description: "Handwritten digit recognition (28×28 grayscale images).",
    classDistribution: [{name:"0",count:6903},{name:"1",count:7877},{name:"2",count:6990},{name:"3",count:7141},{name:"4",count:6824},{name:"5",count:6313},{name:"6",count:6876},{name:"7",count:7293},{name:"8",count:6825},{name:"9",count:6958}],
    schema: [{column:"image",dtype:"uint8[28,28]",nonNull:70000},{column:"label",dtype:"int64",nonNull:70000,min:"0",max:"9"}],
    sampleRows: [{idx:0,label:5,min_px:0,max_px:255,mean_px:35},{idx:1,label:0,min_px:0,max_px:253,mean_px:29},{idx:2,label:4,min_px:0,max_px:255,mean_px:51},{idx:3,label:1,min_px:0,max_px:255,mean_px:40},{idx:4,label:9,min_px:0,max_px:255,mean_px:44}],
  },
  {
    id: "cifar10", name: "CIFAR-10", category: "Image", samples: 60000, size: "163 MB", format: "Binary", classes: 10, features: 1, splits: ["train", "test"],
    description: "32×32 color images in 10 classes for object recognition.",
    classDistribution: [{name:"airplane",count:6000},{name:"automobile",count:6000},{name:"bird",count:6000},{name:"cat",count:6000},{name:"deer",count:6000},{name:"dog",count:6000},{name:"frog",count:6000},{name:"horse",count:6000},{name:"ship",count:6000},{name:"truck",count:6000}],
    schema: [{column:"image",dtype:"uint8[32,32,3]",nonNull:60000},{column:"label",dtype:"int64",nonNull:60000,min:"0",max:"9"}],
    sampleRows: [{idx:0,label:"frog",r_mean:124,g_mean:108,b_mean:94},{idx:1,label:"truck",r_mean:181,g_mean:167,b_mean:160},{idx:2,label:"truck",r_mean:195,g_mean:179,b_mean:168},{idx:3,label:"deer",r_mean:102,g_mean:128,b_mean:88},{idx:4,label:"automobile",r_mean:156,g_mean:134,b_mean:126}],
  },
  {
    id: "cifar100", name: "CIFAR-100", category: "Image", samples: 60000, size: "163 MB", format: "Binary", classes: 100, features: 1, splits: ["train", "test"],
    description: "Fine-grained classification with 100 classes in 20 superclasses.",
    classDistribution: [{name:"aquatic",count:3000},{name:"flowers",count:3000},{name:"food",count:3000},{name:"furniture",count:3000},{name:"insects",count:3000},{name:"mammals",count:3000},{name:"people",count:3000},{name:"vehicles",count:3000}],
    schema: [{column:"image",dtype:"uint8[32,32,3]",nonNull:60000},{column:"fine_label",dtype:"int64",nonNull:60000,min:"0",max:"99"},{column:"coarse_label",dtype:"int64",nonNull:60000,min:"0",max:"19"}],
    sampleRows: [{idx:0,fine_label:49,coarse_label:10},{idx:1,fine_label:33,coarse_label:7},{idx:2,fine_label:72,coarse_label:15},{idx:3,fine_label:51,coarse_label:10},{idx:4,fine_label:71,coarse_label:15}],
  },
  {
    id: "oxfordpets", name: "Oxford Pets", category: "Image", samples: 7349, size: "774 MB", format: "JPEG", classes: 37, features: 3, splits: ["train", "test"],
    description: "37 breeds of cats and dogs with pixel-level segmentation.",
    classDistribution: [{name:"Abyssinian",count:199},{name:"Bengal",count:200},{name:"Birman",count:199},{name:"Bombay",count:200},{name:"Brit. SH",count:199},{name:"Egyptian",count:198},{name:"Persian",count:199},{name:"Siamese",count:200}],
    schema: [{column:"image",dtype:"PIL.Image",nonNull:7349},{column:"label",dtype:"int64",nonNull:7349,min:"0",max:"36"},{column:"segmentation",dtype:"PIL.Image",nonNull:7349}],
    sampleRows: [{file:"Abyssinian_100.jpg",label:0,breed:"Abyssinian",species:"cat"},{file:"Bengal_101.jpg",label:1,breed:"Bengal",species:"cat"},{file:"Birman_102.jpg",label:2,breed:"Birman",species:"cat"},{file:"Bombay_103.jpg",label:3,breed:"Bombay",species:"cat"},{file:"BritSH_104.jpg",label:4,breed:"British Shorthair",species:"cat"}],
  },
  {
    id: "flowers", name: "Oxford Flowers 102", category: "Image", samples: 8189, size: "330 MB", format: "JPEG", classes: 102, features: 2, splits: ["train", "val", "test"],
    description: "Fine-grained visual categorization of 102 flower categories.",
    classDistribution: [{name:"daisy",count:80},{name:"dandelion",count:80},{name:"rose",count:80},{name:"sunflower",count:80},{name:"tulip",count:80},{name:"iris",count:80},{name:"lily",count:80},{name:"orchid",count:80}],
    schema: [{column:"image",dtype:"PIL.Image",nonNull:8189},{column:"label",dtype:"int64",nonNull:8189,min:"0",max:"101"}],
    sampleRows: [{file:"image_00001.jpg",label:0,category:"pink primrose"},{file:"image_00002.jpg",label:0,category:"pink primrose"},{file:"image_00003.jpg",label:1,category:"hard-leaved pocket orchid"},{file:"image_00004.jpg",label:1,category:"hard-leaved pocket orchid"},{file:"image_00005.jpg",label:2,category:"canterbury bells"}],
  },
  {
    id: "pascalvoc", name: "Pascal VOC 2012", category: "Image", samples: 11540, size: "2 GB", format: "JPEG/XML", classes: 20, features: 4, splits: ["train", "val"],
    description: "Object detection and segmentation with 20 object classes.",
    classDistribution: [{name:"person",count:4528},{name:"car",count:1644},{name:"chair",count:1432},{name:"dog",count:1298},{name:"cat",count:1227},{name:"bird",count:1052},{name:"bottle",count:986},{name:"sofa",count:708}],
    schema: [{column:"image",dtype:"PIL.Image",nonNull:11540},{column:"annotation",dtype:"XML",nonNull:11540},{column:"segmentation",dtype:"PIL.Image",nonNull:11540},{column:"class_set",dtype:"list[str]",nonNull:11540}],
    sampleRows: [{file:"2007_000027.jpg",objects:1,classes:"person",width:486,height:500},{file:"2007_000032.jpg",objects:4,classes:"aeroplane",width:500,height:366},{file:"2007_000033.jpg",objects:2,classes:"aeroplane",width:500,height:375},{file:"2007_000039.jpg",objects:3,classes:"tvmonitor",width:500,height:375},{file:"2007_000042.jpg",objects:1,classes:"train",width:500,height:335}],
  },
  {
    id: "commonvoice", name: "Common Voice", category: "Audio", samples: 1580000, size: "73 GB", format: "MP3", classes: 100, features: 6, splits: ["train", "dev", "test"],
    description: "Open-source multilingual speech corpus for ASR training.",
    classDistribution: [{name:"English",count:320000},{name:"German",count:210000},{name:"French",count:180000},{name:"Spanish",count:160000},{name:"Italian",count:120000},{name:"Japanese",count:85000},{name:"Chinese",count:75000},{name:"Other",count:430000}],
    schema: [{column:"audio",dtype:"Audio",nonNull:1580000},{column:"sentence",dtype:"string",nonNull:1580000},{column:"locale",dtype:"string",nonNull:1580000},{column:"age",dtype:"string",nonNull:1420000},{column:"gender",dtype:"string",nonNull:1380000},{column:"duration_s",dtype:"float32",nonNull:1580000,mean:"5.2",min:"0.8",max:"30.0"}],
    sampleRows: [{clip_id:"common_voice_en_100.mp3",sentence:"The quick brown fox",locale:"en",duration:4.2,gender:"male"},{clip_id:"common_voice_de_201.mp3",sentence:"Hallo Welt",locale:"de",duration:3.1,gender:"female"},{clip_id:"common_voice_fr_302.mp3",sentence:"Bonjour le monde",locale:"fr",duration:2.8,gender:"male"},{clip_id:"common_voice_es_403.mp3",sentence:"Hola mundo",locale:"es",duration:3.5,gender:"female"},{clip_id:"common_voice_it_504.mp3",sentence:"Ciao mondo",locale:"it",duration:2.9,gender:"male"}],
  },
  {
    id: "agnews", name: "AG News", category: "Text", samples: 127600, size: "29 MB", format: "CSV", classes: 4, features: 3, splits: ["train", "test"],
    description: "News articles classified into 4 topics: World, Sports, Business, Sci/Tech.",
    classDistribution: [{name:"World",count:30000},{name:"Sports",count:30000},{name:"Business",count:30000},{name:"Sci/Tech",count:30000}],
    schema: [{column:"label",dtype:"int64",nonNull:127600,min:"0",max:"3"},{column:"title",dtype:"string",nonNull:127600},{column:"description",dtype:"string",nonNull:127600}],
    sampleRows: [{label:2,title:"Wall St. Bears Claw Back",description:"Reuters - Short-sellers...",length:128},{label:2,title:"Carlyle Looks Toward Growth",description:"Reuters - Private equity...",length:145},{label:3,title:"Oil and Economy Cloud",description:"AP - Stocks ended lower...",length:168},{label:3,title:"Iraq Coverage Dominated",description:"Reuters - The war in Iraq...",length:131},{label:0,title:"Peanut Allergy Treatment",description:"AP - A new treatment...",length:112}],
  },
  {
    id: "iris", name: "Iris", category: "Tabular", samples: 150, size: "4 KB", format: "CSV", classes: 3, features: 4, splits: ["full"],
    description: "Classic 3-class flower classification (setosa, versicolor, virginica).",
    classDistribution: [{name:"setosa",count:50},{name:"versicolor",count:50},{name:"virginica",count:50}],
    schema: [{column:"sepal_length",dtype:"float64",nonNull:150,mean:"5.84",min:"4.3",max:"7.9"},{column:"sepal_width",dtype:"float64",nonNull:150,mean:"3.05",min:"2.0",max:"4.4"},{column:"petal_length",dtype:"float64",nonNull:150,mean:"3.76",min:"1.0",max:"6.9"},{column:"petal_width",dtype:"float64",nonNull:150,mean:"1.20",min:"0.1",max:"2.5"}],
    sampleRows: [{sepal_length:5.1,sepal_width:3.5,petal_length:1.4,petal_width:0.2,species:"setosa"},{sepal_length:4.9,sepal_width:3.0,petal_length:1.4,petal_width:0.2,species:"setosa"},{sepal_length:7.0,sepal_width:3.2,petal_length:4.7,petal_width:1.4,species:"versicolor"},{sepal_length:6.3,sepal_width:3.3,petal_length:6.0,petal_width:2.5,species:"virginica"},{sepal_length:5.8,sepal_width:2.7,petal_length:5.1,petal_width:1.9,species:"virginica"}],
  },
  {
    id: "wine", name: "Wine Quality", category: "Tabular", samples: 6497, size: "258 KB", format: "CSV", classes: 7, features: 11, splits: ["train", "test"],
    description: "Physicochemical properties of Portuguese wines with quality ratings.",
    classDistribution: [{name:"Quality 3",count:30},{name:"Quality 4",count:216},{name:"Quality 5",count:2138},{name:"Quality 6",count:2836},{name:"Quality 7",count:1079},{name:"Quality 8",count:193},{name:"Quality 9",count:5}],
    schema: [{column:"fixed_acidity",dtype:"float64",nonNull:6497,mean:"7.22",min:"3.8",max:"15.9"},{column:"volatile_acidity",dtype:"float64",nonNull:6497,mean:"0.34",min:"0.08",max:"1.58"},{column:"citric_acid",dtype:"float64",nonNull:6497,mean:"0.32",min:"0.0",max:"1.66"},{column:"residual_sugar",dtype:"float64",nonNull:6497,mean:"5.44",min:"0.6",max:"65.8"},{column:"alcohol",dtype:"float64",nonNull:6497,mean:"10.49",min:"8.0",max:"14.9"}],
    sampleRows: [{fixed_acidity:7.4,volatile_acidity:0.7,citric_acid:0.0,residual_sugar:1.9,alcohol:9.4,quality:5},{fixed_acidity:7.8,volatile_acidity:0.88,citric_acid:0.0,residual_sugar:2.6,alcohol:9.8,quality:5},{fixed_acidity:7.8,volatile_acidity:0.76,citric_acid:0.04,residual_sugar:2.3,alcohol:9.8,quality:5},{fixed_acidity:6.7,volatile_acidity:0.58,citric_acid:0.08,residual_sugar:1.8,alcohol:9.5,quality:5},{fixed_acidity:5.6,volatile_acidity:0.615,citric_acid:0.0,residual_sugar:1.6,alcohol:9.8,quality:5}],
  },
];

const CATEGORY_COLORS: Record<DatasetCategory, string> = { Image: "#7c6cf8", Text: "#3ba6ff", Tabular: "#f5a623", Audio: "#00d4a0" };
const CATEGORY_ICONS: Record<DatasetCategory, React.ElementType> = { Image: Image, Text: FileText, Tabular: Table2, Audio: Activity };
const ALL_CATEGORIES: DatasetCategory[] = ["Image", "Text", "Tabular", "Audio"];

interface UploadFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "validating" | "valid" | "error";
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function DatasetsView() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DatasetCategory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>("imagenet");
  const [previewTab, setPreviewTab] = useState<"overview" | "schema" | "samples">("overview");
  const [samplePage, setSamplePage] = useState(0);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadIdRef = useRef(0);

  const filtered = useMemo(() => {
    return PRELOADED_DATASETS.filter(d => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.format.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, categoryFilter]);

  const selected = selectedId ? PRELOADED_DATASETS.find(d => d.id === selectedId) ?? null : null;

  // Simulated upload progress
  const simulateUpload = useCallback((file: File) => {
    const id = `upload-${++uploadIdRef.current}`;
    const entry: UploadFile = { id, name: file.name, size: file.size, progress: 0, status: "uploading" };
    setUploads(prev => [...prev, entry]);

    let p = 0;
    const iv = setInterval(() => {
      p += 8 + Math.random() * 12;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: 100, status: "validating" } : u));
        setTimeout(() => {
          const isValid = Math.random() > 0.2;
          setUploads(prev => prev.map(u => u.id === id ? { ...u, status: isValid ? "valid" : "error" } : u));
        }, 1200);
      } else {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: Math.min(100, p) } : u));
      }
    }, 200);
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(f => simulateUpload(f));
  }, [simulateUpload]);

  const removeUpload = (id: string) => setUploads(prev => prev.filter(u => u.id !== id));

  const maxClassCount = selected ? Math.max(...selected.classDistribution.map(c => c.count)) : 0;

  const CHART_PALETTE = ["#00d4a0", "#7c6cf8", "#3ba6ff", "#f5a623", "#f04040", "#e879f9", "#34d399", "#fb923c", "#60a5fa", "#a78bfa"];

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 border-b border-border">
        <div className="max-w-[1600px] mx-auto px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Database size={14} className="text-[#00d4a0]" strokeWidth={1.5} />
                <h1 className="text-sm font-semibold text-[#d4dae8] uppercase tracking-widest" style={MONO}>Datasets</h1>
              </div>
              <p className="text-[11px] text-[#525c70]" style={MONO}>
                {PRELOADED_DATASETS.length} available · {uploads.filter(u => u.status === "valid").length} uploaded · {uploads.filter(u => u.status === "uploading").length} in progress
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest border border-border text-[#525c70] hover:text-[#8891a8] hover:border-[rgba(255,255,255,0.15)] transition-colors" style={MONO}>
                <Download size={10} /> Export
              </button>
            </div>
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { label: "Total Datasets", value: String(PRELOADED_DATASETS.length + uploads.filter(u => u.status === "valid").length), sub: "ready to use", color: "#00d4a0" },
              { label: "Image Datasets", value: String(PRELOADED_DATASETS.filter(d => d.category === "Image").length), sub: `${fmtCount(PRELOADED_DATASETS.filter(d => d.category === "Image").reduce((s, d) => s + d.samples, 0))} samples`, color: "#7c6cf8" },
              { label: "Total Samples", value: fmtCount(PRELOADED_DATASETS.reduce((s, d) => s + d.samples, 0)), sub: "across all datasets", color: "#3ba6ff" },
              { label: "Uploads", value: String(uploads.length), sub: `${uploads.filter(u => u.status === "uploading").length} active`, color: "#f5a623" },
            ].map(c => (
              <div key={c.label} className="border border-border bg-card px-4 py-3">
                <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-1.5" style={MONO}>{c.label}</div>
                <div className="text-xl font-semibold" style={{ color: c.color, ...MONO }}>{c.value}</div>
                <div className="text-[10px] text-[#525c70] mt-0.5 truncate" style={MONO}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: Dataset Library ── */}
        <div className="w-[220px] shrink-0 border-r border-border bg-[#0a0d14] flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5">
              <Search size={11} className="text-[#525c70] shrink-0" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search datasets…"
                className="bg-transparent outline-none text-[11px] text-[#d4dae8] placeholder-[#525c70] w-full"
                style={MONO}
              />
              {search && <button onClick={() => setSearch("")}><X size={10} className="text-[#525c70] hover:text-[#8891a8]" /></button>}
            </div>
          </div>

          {/* Category chips */}
          <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`px-2 py-0.5 text-[9px] uppercase tracking-widest border transition-colors ${
                !categoryFilter
                  ? "border-[#00d4a0]/40 text-[#00d4a0] bg-[rgba(0,212,160,0.06)]"
                  : "border-border text-[#525c70] hover:text-[#8891a8]"
              }`}
              style={MONO}
            >All</button>
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={`px-2 py-0.5 text-[9px] uppercase tracking-widest border transition-colors ${
                  categoryFilter === cat
                    ? `border-[${CATEGORY_COLORS[cat]}]/40 text-[${CATEGORY_COLORS[cat]}] bg-[rgba(0,212,160,0.06)]`
                    : "border-border text-[#525c70] hover:text-[#8891a8]"
                }`}
                style={{ ...(categoryFilter === cat ? { color: CATEGORY_COLORS[cat], borderColor: CATEGORY_COLORS[cat] + "66", backgroundColor: CATEGORY_COLORS[cat] + "0f" } : {}), ...MONO }}
              >{cat}</button>
            ))}
          </div>

          {/* Dataset list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Search size={20} className="text-[#333d50] mx-auto mb-2" />
                <div className="text-[10px] text-[#525c70]" style={MONO}>No datasets found</div>
              </div>
            ) : (
              filtered.map(ds => {
                const isActive = selectedId === ds.id;
                const CatIcon = CATEGORY_ICONS[ds.category];
                return (
                  <button
                    key={ds.id}
                    onClick={() => { setSelectedId(ds.id); setPreviewTab("overview"); setSamplePage(0); }}
                    className={`w-full text-left px-3 py-2.5 border-l-2 transition-all ${
                      isActive
                        ? "border-[#00d4a0] bg-[rgba(0,212,160,0.06)]"
                        : "border-transparent hover:bg-[rgba(255,255,255,0.02)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <CatIcon size={11} style={{ color: CATEGORY_COLORS[ds.category] }} strokeWidth={1.5} />
                      <span className={`text-[11px] font-medium truncate ${isActive ? "text-[#d4dae8]" : "text-[#8891a8]"}`} style={MONO}>{ds.name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-[19px]">
                      <span className="text-[9px] text-[#525c70]" style={MONO}>{fmtCount(ds.samples)} samples</span>
                      <span className="text-[9px] text-[#333d50]">·</span>
                      <span className="text-[9px] text-[#525c70]" style={MONO}>{ds.size}</span>
                      <span className="text-[9px] px-1 py-px border border-border text-[#525c70] ml-auto" style={MONO}>{ds.format}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Center: Preview Panel ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Database size={32} className="text-[#1a2030] mb-3" />
              <div className="text-[11px] text-[#525c70] mb-1" style={MONO}>Select a dataset to preview</div>
              <div className="text-[10px] text-[#333d50]" style={MONO}>Choose from the library or upload your own</div>
            </div>
          ) : (
            <>
              {/* Preview header */}
              <div className="shrink-0 border-b border-border px-5 pt-4 pb-3 bg-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 flex items-center justify-center border border-border" style={{ backgroundColor: CATEGORY_COLORS[selected.category] + "12" }}>
                    {(() => { const CI = CATEGORY_ICONS[selected.category]; return <CI size={14} style={{ color: CATEGORY_COLORS[selected.category] }} />; })()}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#d4dae8]" style={MONO}>{selected.name}</h2>
                    <p className="text-[10px] text-[#525c70]" style={MONO}>{selected.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <StatBadge label="Samples" value={fmtCount(selected.samples)} />
                  <StatBadge label="Classes" value={selected.classes} color="#7c6cf8" />
                  <StatBadge label="Features" value={selected.features} color="#3ba6ff" />
                  <StatBadge label="Format" value={selected.format} color="#f5a623" />
                  <StatBadge label="Size" value={selected.size} color="#8891a8" />
                  <div className="flex items-center gap-1 ml-auto">
                    {selected.splits.map(s => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 border border-border text-[#525c70] uppercase tracking-widest" style={MONO}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="shrink-0 border-b border-border bg-[#0a0d14] flex items-center px-5">
                {(["overview", "schema", "samples"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setPreviewTab(tab); setSamplePage(0); }}
                    className={`px-4 py-2.5 text-[10px] uppercase tracking-widest border-b-2 transition-colors ${
                      previewTab === tab
                        ? "border-[#00d4a0] text-[#00d4a0]"
                        : "border-transparent text-[#525c70] hover:text-[#8891a8]"
                    }`}
                    style={MONO}
                  >{tab}</button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5">
                {previewTab === "overview" && (
                  <div className="grid grid-cols-3 gap-4">
                    {/* Class distribution chart */}
                    <div className="col-span-2 border border-border bg-card p-4">
                      <div className="text-[9px] uppercase tracking-widest text-[#525c70] mb-3" style={MONO}>Class Distribution</div>
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={selected.classDistribution} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 9, fill: "#525c70", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#8891a8", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={80} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "#0d1017", border: "1px solid rgba(255,255,255,0.07)", fontSize: 11, fontFamily: "JetBrains Mono", color: "#d4dae8" }}
                              cursor={{ fill: "rgba(255,255,255,0.03)" }}
                            />
                            <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                              {selected.classDistribution.map((_, i) => (
                                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} fillOpacity={0.75} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Key stats */}
                    <div className="space-y-3">
                      {[
                        { label: "Total Samples", value: fmtCount(selected.samples), icon: Package, color: "#00d4a0" },
                        { label: "Classes", value: String(selected.classes), icon: Layers, color: "#7c6cf8" },
                        { label: "Features", value: String(selected.features), icon: Table2, color: "#3ba6ff" },
                        { label: "Splits", value: selected.splits.join(", "), icon: GitFork, color: "#f5a623" },
                        { label: "Format", value: selected.format, icon: FileArchive, color: "#8891a8" },
                        { label: "Disk Size", value: selected.size, icon: HardDrive, color: "#e879f9" },
                      ].map(s => (
                        <div key={s.label} className="border border-border bg-card px-4 py-3 flex items-center gap-3">
                          <div className="w-7 h-7 flex items-center justify-center border border-border" style={{ backgroundColor: s.color + "10" }}>
                            <s.icon size={13} style={{ color: s.color }} strokeWidth={1.5} />
                          </div>
                          <div>
                            <div className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>{s.label}</div>
                            <div className="text-[12px] font-medium text-[#d4dae8]" style={MONO}>{s.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {previewTab === "schema" && (
                  <div className="border border-border bg-card">
                    <table className="w-full text-[11px]" style={MONO}>
                      <thead>
                        <tr className="border-b border-border bg-[#0a0d14]">
                          <th className="text-left px-4 py-2.5 text-[9px] uppercase tracking-widest text-[#525c70]">Column</th>
                          <th className="text-left px-4 py-2.5 text-[9px] uppercase tracking-widest text-[#525c70]">Type</th>
                          <th className="text-right px-4 py-2.5 text-[9px] uppercase tracking-widest text-[#525c70]">Non-Null</th>
                          <th className="text-right px-4 py-2.5 text-[9px] uppercase tracking-widest text-[#525c70]">Mean</th>
                          <th className="text-right px-4 py-2.5 text-[9px] uppercase tracking-widest text-[#525c70]">Min</th>
                          <th className="text-right px-4 py-2.5 text-[9px] uppercase tracking-widest text-[#525c70]">Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.schema.map((col, i) => (
                          <tr key={col.column} className={`border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${i % 2 === 0 ? "" : "bg-[rgba(255,255,255,0.01)]"}`}>
                            <td className="px-4 py-2.5 text-[#d4dae8] font-medium">{col.column}</td>
                            <td className="px-4 py-2.5"><span className="text-[10px] px-1.5 py-0.5 border border-border text-[#7c6cf8]">{col.dtype}</span></td>
                            <td className="px-4 py-2.5 text-right text-[#8891a8]">{fmtCount(col.nonNull)}</td>
                            <td className="px-4 py-2.5 text-right text-[#00d4a0]">{col.mean ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right text-[#525c70]">{col.min ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right text-[#525c70]">{col.max ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {previewTab === "samples" && (
                  <div>
                    <div className="border border-border bg-card overflow-x-auto">
                      <table className="w-full text-[11px]" style={MONO}>
                        <thead>
                          <tr className="border-b border-border bg-[#0a0d14]">
                            <th className="text-left px-4 py-2.5 text-[9px] uppercase tracking-widest text-[#525c70]">#</th>
                            {Object.keys(selected.sampleRows[0] ?? {}).map(k => (
                              <th key={k} className="text-left px-4 py-2.5 text-[9px] uppercase tracking-widest text-[#525c70]">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selected.sampleRows.slice(samplePage * 5, samplePage * 5 + 5).map((row, i) => (
                            <tr key={i} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                              <td className="px-4 py-2.5 text-[#525c70]">{samplePage * 5 + i}</td>
                              {Object.values(row).map((v, j) => (
                                <td key={j} className="px-4 py-2.5 text-[#d4dae8] truncate max-w-[200px]">{String(v)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-[10px] text-[#525c70]" style={MONO}>
                        Showing {samplePage * 5 + 1}–{Math.min(samplePage * 5 + 5, selected.sampleRows.length)} of {selected.sampleRows.length}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSamplePage(p => Math.max(0, p - 1))}
                          disabled={samplePage === 0}
                          className="px-2 py-1 text-[10px] border border-border text-[#525c70] hover:text-[#8891a8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          style={MONO}
                        ><ChevronLeft size={10} /></button>
                        <span className="text-[10px] text-[#525c70] px-2" style={MONO}>{samplePage + 1}</span>
                        <button
                          onClick={() => setSamplePage(p => p + 1)}
                          disabled={samplePage * 5 + 5 >= selected.sampleRows.length}
                          className="px-2 py-1 text-[10px] border border-border text-[#525c70] hover:text-[#8891a8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          style={MONO}
                        ><ChevronRight size={10} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Right: Upload Hub ── */}
        <div className="w-[280px] shrink-0 border-l border-border bg-[#0a0d14] flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Upload size={12} className="text-[#00d4a0]" strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-widest text-[#d4dae8] font-medium" style={MONO}>Upload Hub</span>
            </div>
          </div>

          {/* Drag-drop zone */}
          <div className="p-3">
            <div
              className={`border-2 border-dashed rounded-sm p-5 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-[#00d4a0] bg-[rgba(0,212,160,0.06)]"
                  : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.01)]"
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={28} className={`mb-2 transition-colors ${dragOver ? "text-[#00d4a0]" : "text-[#333d50]"}`} strokeWidth={1.2} />
              <div className="text-[11px] text-[#8891a8] mb-1" style={MONO}>Drag & drop files here</div>
              <div className="text-[9px] text-[#525c70]" style={MONO}>or click to browse</div>
              <div className="flex items-center gap-1.5 mt-3">
                {[".csv", ".json", ".zip", ".parquet"].map(ext => (
                  <span key={ext} className="text-[8px] px-1.5 py-0.5 border border-border text-[#525c70]" style={MONO}>{ext}</span>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".csv,.json,.zip,.parquet,.tsv,.txt"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>
          </div>

          {/* Browse folder button */}
          <div className="px-3 pb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest border border-border text-[#525c70] hover:text-[#8891a8] hover:border-[rgba(255,255,255,0.15)] transition-colors"
              style={MONO}
            >
              <FolderOpen size={11} /> Browse Files
            </button>
          </div>

          {/* Upload queue */}
          <div className="flex-1 overflow-y-auto border-t border-border">
            {uploads.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Package size={20} className="text-[#1a2030] mx-auto mb-2" />
                <div className="text-[10px] text-[#525c70]" style={MONO}>No uploads yet</div>
                <div className="text-[9px] text-[#333d50] mt-0.5" style={MONO}>Files will appear here</div>
              </div>
            ) : (
              uploads.map(file => {
                const statusCfg = {
                  uploading: { color: "#3ba6ff", bg: "rgba(59,166,255,0.08)", label: "Uploading" },
                  validating: { color: "#f5a623", bg: "rgba(245,166,35,0.08)", label: "Validating" },
                  valid: { color: "#00d4a0", bg: "rgba(0,212,160,0.08)", label: "Valid" },
                  error: { color: "#f04040", bg: "rgba(240,64,64,0.08)", label: "Error" },
                }[file.status];

                const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
                const FileIcon = ext === "json" ? FileText : ext === "zip" ? FileArchive : ext === "csv" || ext === "tsv" ? Table2 : FileText;

                return (
                  <div key={file.id} className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileIcon size={12} style={{ color: statusCfg.color }} strokeWidth={1.5} />
                      <span className="text-[11px] text-[#d4dae8] truncate flex-1" style={MONO}>{file.name}</span>
                      <button onClick={() => removeUpload(file.id)} className="text-[#333d50] hover:text-[#f04040] transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] text-[#525c70]" style={MONO}>{fmtFileSize(file.size)}</span>
                      <span className="text-[9px] text-[#333d50]">·</span>
                      <span
                        className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest px-1 py-px"
                        style={{ color: statusCfg.color, backgroundColor: statusCfg.bg, border: `1px solid ${statusCfg.color}28`, ...MONO }}
                      >
                        {file.status === "uploading" && <Loader2 size={8} className="animate-spin" />}
                        {file.status === "validating" && <Loader2 size={8} className="animate-spin" />}
                        {file.status === "valid" && <CheckCircle2 size={8} />}
                        {file.status === "error" && <AlertCircle size={8} />}
                        {statusCfg.label}
                      </span>
                    </div>
                    {/* Progress bar */}
                    {(file.status === "uploading" || file.status === "validating") && (
                      <div className="h-[3px] bg-[#131825] w-full relative mt-1">
                        <div
                          className="h-full absolute top-0 left-0 transition-all duration-300"
                          style={{
                            width: `${file.progress}%`,
                            backgroundColor: file.status === "validating" ? "#f5a623" : "#3ba6ff",
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "dashboard", icon: BarChart2, label: "Dashboard" },
  { id: "experiments", icon: FlaskConical, label: "Experiments" },
  { id: "models", icon: Layers, label: "Models" },
  { id: "hardware", icon: Server, label: "Hardware" },
  { id: "datasets", icon: HardDrive, label: "Datasets" },
  { id: "terminal", icon: Terminal, label: "Terminal" },
  { id: "settings", icon: Settings, label: "Settings" },
];

export default function App() {
  const [activeNav, setActiveNav] = useState("datasets");
  const [isRunning, setIsRunning] = useState(true);
  const [metrics, setMetrics] = useState<MetricPoint[]>(() => generateMetrics(47));
  const [hw, setHw] = useState<HardwarePoint[]>(() => generateHardware(60));
  const [termLines, setTermLines] = useState<string[]>(LOG_LINES);
  const [termOpen, setTermOpen] = useState(true);
  const [epoch, setEpoch] = useState(47);
  const [params, setParams] = useState<HyperParams>({
    learningRate: "5e-4", batchSize: "48", optimizer: "SGD", scheduler: "OneCycleLR",
    momentum: "0.9", weightDecay: "1e-4", dropout: "0.3", epochs: "100",
    warmupSteps: "500", gradClip: "1.0",
  });
  const tickRef = useRef(0);

  const addLogLine = useCallback(() => {
    const loss = (0.21 + Math.random() * 0.03).toFixed(4);
    const acc = (0.915 + Math.random() * 0.01).toFixed(4);
    const now = new Date();
    const ts = `[${now.getFullYear()}-07-15 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}]`;
    setTermLines(prev => [...prev.slice(-80), `${ts} TRAIN loss=${loss}  acc=${acc}  lr=4.7e-4  grad_norm=${(1.5 + Math.random() * 0.4).toFixed(2)}`]);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      tickRef.current += 1;
      setHw(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(-60), {
          t: last.t + 1,
          cpu: Math.min(99, Math.max(10, last.cpu + (Math.random() - 0.5) * 10)),
          gpu: Math.min(99, Math.max(50, last.gpu + (Math.random() - 0.5) * 6)),
          vram: Math.min(99, Math.max(55, last.vram + (Math.random() - 0.5) * 4)),
          ram: Math.min(99, Math.max(40, last.ram + (Math.random() - 0.5) * 5)),
        }];
      });
      if (tickRef.current % 5 === 0) {
        setMetrics(prev => {
          const last = prev[prev.length - 1];
          return [...prev, {
            step: last.step + 100,
            trainLoss: Math.max(0.05, last.trainLoss - 0.004 + (Math.random() - 0.5) * 0.01),
            valLoss: Math.max(0.08, last.valLoss - 0.003 + (Math.random() - 0.5) * 0.012),
            trainAcc: Math.min(0.99, last.trainAcc + 0.002 + (Math.random() - 0.5) * 0.003),
            valAcc: Math.min(0.98, last.valAcc + 0.0015 + (Math.random() - 0.5) * 0.003),
          }];
        });
        setEpoch(e => Math.min(100, e + 1));
      }
      addLogLine();
    }, 1200);
    return () => clearInterval(id);
  }, [isRunning, addLogLine]);

  const latest = metrics[metrics.length - 1];

  return (
    <div className="size-full flex flex-col bg-background text-foreground overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* ── Top Bar ── */}
      <header className="h-11 shrink-0 border-b border-border flex items-center px-4 bg-[#0a0d14]">
        <div className="flex items-center gap-2 mr-8">
          <div className="w-4 h-4 bg-[#00d4a0] flex items-center justify-center">
            <Zap size={10} className="text-[#07090f]" />
          </div>
          <span className="text-[11px] font-semibold text-[#d4dae8] tracking-widest uppercase" style={MONO}>TRAINCTL</span>
        </div>
        <div className="flex items-center gap-1 mr-6">
          <button onClick={() => setIsRunning(r => !r)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest border transition-colors ${isRunning ? "border-[rgba(0,212,160,0.4)] text-[#00d4a0] hover:bg-[rgba(0,212,160,0.08)]" : "border-[rgba(245,166,35,0.4)] text-[#f5a623] hover:bg-[rgba(245,166,35,0.08)]"}`}
            style={MONO}>
            {isRunning ? <Pause size={10} /> : <Play size={10} />}
            {isRunning ? "Pause" : "Resume"}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest border border-[rgba(240,64,64,0.4)] text-[#f04040] hover:bg-[rgba(240,64,64,0.08)] transition-colors" style={MONO}>
            <Square size={10} /> Stop
          </button>
        </div>
        <div className="flex items-center gap-5 flex-1">
          <StatBadge label="RUN" value="efficientnet-b4-aug" />
          <StatBadge label="EPOCH" value={`${epoch}/100`} />
          <StatBadge label="VAL LOSS" value={latest?.valLoss.toFixed(4) ?? "—"} color="#7c6cf8" />
          <StatBadge label="VAL ACC" value={latest ? (latest.valAcc * 100).toFixed(2) + "%" : "—"} color="#f5a623" />
        </div>
        <div className="flex items-center gap-4 ml-4">
          <div className="flex items-center gap-1.5 text-[10px]" style={MONO}>
            <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-[#00d4a0] animate-pulse" : "bg-[#525c70]"}`} />
            <span style={{ color: isRunning ? "#00d4a0" : "#525c70" }}>{isRunning ? "TRAINING" : "PAUSED"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#525c70] text-[10px]" style={MONO}>
            <Clock size={10} /><span>02:14:33</span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-44 shrink-0 bg-[#0a0d14] border-r border-border flex flex-col">
          <nav className="flex-1 py-4 space-y-0.5">
            {NAV_ITEMS.map(item => (
              <NavItem key={item.id} icon={item.icon} label={item.label}
                active={activeNav === item.id} onClick={() => setActiveNav(item.id)} />
            ))}
          </nav>
          <div className="border-t border-border p-4 space-y-3">
            <div className="text-[9px] uppercase tracking-widest text-[#525c70]" style={MONO}>GPU · A100</div>
            <UtilBar label="" value={hw[hw.length - 1]?.gpu ?? 85} color="#7c6cf8" />
            <div className="text-[10px] text-[#525c70]" style={MONO}>{(hw[hw.length - 1]?.vram ?? 88).toFixed(0)}% VRAM</div>
          </div>
        </aside>

        {/* Main */}
        {activeNav === "experiments" ? (
          <ExperimentsView />
        ) : activeNav === "models" ? (
          <ModelsView />
        ) : activeNav === "hardware" ? (
          <HardwareView liveHw={hw} />
        ) : activeNav === "datasets" ? (
          <DatasetsView />
        ) : (
          <DashboardView
            metrics={metrics} hw={hw} termLines={termLines}
            isRunning={isRunning} epoch={epoch}
            params={params} setParams={setParams}
            termOpen={termOpen} setTermOpen={setTermOpen}
          />
        )}
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
}
