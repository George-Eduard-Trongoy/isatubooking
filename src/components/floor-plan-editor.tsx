import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import {
  ArrowRight,
  Copy,
  Download,
  Eraser,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PALETTE,
  STAGE_H,
  STAGE_W,
  countSeats,
  generateRecommendedLayout,
  isRound,
  type FloorPlan,
  type PlanItem,
} from "@/lib/floor-plan";
import { LAYOUT_STYLES } from "@/lib/booking-rules";

type Props = {
  initial: FloorPlan;
  venue: { capacity: number; capacity_tables: number };
  attendees: number;
  canEdit: boolean;
  onSave: (plan: { style: string; items: PlanItem[] }) => Promise<boolean>;
  /** Next step after the floor plan (saves pending changes first). */
  onContinue?: () => void;
  continueLabel?: string;
  fileName: string;
};

let uid = 0;
const newId = () => `item_${Date.now().toString(36)}_${(uid++).toString(36)}`;

export default function FloorPlanEditor({ initial, venue, attendees, canEdit, onSave, onContinue, continueLabel = "Continue", fileName }: Props) {
  const [items, setItems] = useState<PlanItem[]>(initial.items);
  const [style, setStyle] = useState<string>(LAYOUT_STYLES.some((s) => s.value === initial.style) ? initial.style : "banquet");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(900);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const holderRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Group>());

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => { const e = entries[0]; if (e) setWidth(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = width / STAGE_W;
  const scale = fit * zoom;
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const seats = useMemo(() => countSeats(items), [items]);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : undefined;
    tr.nodes(node && canEdit ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, items, canEdit]);

  const update = useCallback((id: string, patch: Partial<PlanItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setDirty(true);
  }, []);

  const addItem = (key: string) => {
    const p = PALETTE.find((x) => x.key === key);
    if (!p) return;
    const item: PlanItem = { ...p.template, id: newId(), x: STAGE_W / 2 + (Math.random() * 60 - 30), y: STAGE_H / 2 + (Math.random() * 60 - 30), rotation: 0 };
    setItems((prev) => [...prev, item]);
    setSelectedId(item.id);
    setDirty(true);
  };

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedId(null);
    setDirty(true);
  }, [selectedId]);

  const duplicate = () => {
    if (!selected) { toast("Select an item first."); return; }
    const copy = { ...selected, id: newId(), x: selected.x + 28, y: selected.y + 28 };
    setItems((prev) => [...prev, copy]);
    setSelectedId(copy.id);
    setDirty(true);
  };

  const rotate = () => {
    if (!selected) { toast("Select an item first."); return; }
    update(selected.id, { rotation: (selected.rotation + 90) % 360 });
  };

  const regenerate = () => {
    const plan = generateRecommendedLayout(venue, attendees, style);
    setItems(plan.items);
    setSelectedId(null);
    setDirty(true);
    toast.success("Recommended layout applied.");
  };

  const clearAll = () => {
    if (!window.confirm("Remove every item from the floor plan?")) return;
    setItems([]);
    setSelectedId(null);
    setDirty(true);
  };

  const exportPng = () => {
    setSelectedId(null);
    requestAnimationFrame(() => {
      const uri = stageRef.current?.toDataURL({ pixelRatio: 2 / scale });
      if (!uri) return;
      const a = document.createElement("a");
      a.download = `${fileName}.png`;
      a.href = uri;
      a.click();
    });
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave({ style, items });
    setSaving(false);
    if (ok) setDirty(false);
    return ok;
  };

  const saveAndContinue = async () => {
    if (canEdit && dirty && !(await save())) return;
    onContinue?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && canEdit) {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, canEdit, removeSelected]);

  const groups = [...new Set(PALETTE.map((p) => p.group))];
  const cap = venue.capacity;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Palette */}
      <aside className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-soft lg:self-start">
        <div>
          <p className="eyebrow text-muted-foreground">Recommended layout</p>
          <Select value={style} onValueChange={setStyle} disabled={!canEdit}>
            <SelectTrigger className="mt-3 h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LAYOUT_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="soft" className="mt-2 w-full" onClick={regenerate} disabled={!canEdit}>
            <Sparkles /> Generate for {attendees} guests
          </Button>
        </div>
        {groups.map((g) => (
          <div key={g} className="border-t border-border pt-5">
            <p className="eyebrow text-muted-foreground">{g}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PALETTE.filter((p) => p.group === g).map((p) => (
                <button
                  key={p.key}
                  onClick={() => addItem(p.key)}
                  disabled={!canEdit}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left text-xs font-medium transition-colors hover:border-gold hover:bg-gold-soft disabled:opacity-50"
                >
                  <ShapeSwatch item={p.template} />
                  <span className="leading-tight">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      {/* Canvas */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))} aria-label="Zoom out"><Minus /></Button>
            <Button size="sm" variant="ghost" onClick={() => setZoom(1)} className="w-14 font-semibold">{Math.round(zoom * 100)}%</Button>
            <Button size="icon" variant="outline" onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))} aria-label="Zoom in"><Plus /></Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={rotate} disabled={!canEdit}><RotateCw /> Rotate</Button>
            <Button size="sm" variant="outline" onClick={duplicate} disabled={!canEdit}><Copy /> Duplicate</Button>
            <Button size="sm" variant="outline" onClick={removeSelected} disabled={!canEdit || !selected} className="text-destructive"><Trash2 /> Delete</Button>
            <Button size="sm" variant="ghost" onClick={clearAll} disabled={!canEdit}><Eraser /> Clear</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2.5 text-sm">
          <span className="rounded-full bg-card px-3 py-1 ring-1 ring-border">
            Seats <b className={seats > cap ? "text-destructive" : "text-foreground"}>{seats}</b>
            <span className="text-muted-foreground"> / {cap}</span>
          </span>
          <span className="rounded-full bg-card px-3 py-1 ring-1 ring-border">Items <b>{items.length}</b></span>
          {selected ? (
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Label</span>
              <Input
                value={selected.name}
                onChange={(e) => update(selected.id, { name: e.target.value.slice(0, 80) })}
                className="h-8 w-44"
                disabled={!canEdit}
              />
            </span>
          ) : (
            <span className="text-muted-foreground">Click an item to select it. Drag to move, use the handles to rotate or resize.</span>
          )}
        </div>

        <div ref={holderRef} className="overflow-auto bg-grid" style={{ height: Math.max(360, STAGE_H * fit) }}>
          <Stage
            ref={stageRef}
            width={STAGE_W * scale}
            height={STAGE_H * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
            onTouchStart={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          >
            <Layer>
              <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#ffffff" stroke="#d9dce4" strokeWidth={2} cornerRadius={6} listening={false} />
              {items.map((item) => (
                <PlanShape
                  key={item.id}
                  item={item}
                  draggable={canEdit}
                  registerRef={(n) => { if (n) nodeRefs.current.set(item.id, n); else nodeRefs.current.delete(item.id); }}
                  onSelect={() => setSelectedId(item.id)}
                  onChange={(patch) => update(item.id, patch)}
                />
              ))}
              <Transformer
                ref={trRef}
                rotateAnchorOffset={24}
                anchorSize={9}
                anchorCornerRadius={2}
                borderStroke="#c99a2e"
                anchorStroke="#c99a2e"
                anchorFill="#ffffff"
                borderDash={[4, 4]}
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 12 || newBox.height < 12 ? oldBox : newBox)}
              />
            </Layer>
          </Stage>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {canEdit ? (dirty ? "You have unsaved changes." : "All changes saved.") : "This booking is closed, so the floor plan is read-only."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPng}><Download /> Export PNG</Button>
            {canEdit && (
              <Button variant={onContinue ? "outline" : "gold"} onClick={save} disabled={saving || !dirty}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Save floor plan
              </Button>
            )}
            {onContinue && (
              <Button variant={canEdit ? "default" : "gold"} onClick={saveAndContinue} disabled={saving}>
                {canEdit && dirty ? "Save and continue" : continueLabel} <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function PlanShape({
  item,
  draggable,
  registerRef,
  onSelect,
  onChange,
}: {
  item: PlanItem;
  draggable: boolean;
  registerRef: (n: Konva.Group | null) => void;
  onSelect: () => void;
  onChange: (patch: Partial<PlanItem>) => void;
}) {
  const round = isRound(item.type);
  const w = item.width ?? 60;
  const h = item.height ?? 40;
  const r = item.radius ?? 30;
  const fill = item.color ?? "#ffffff";
  const stroke = item.stroke ?? "#2c3a63";
  const textColor = item.textColor ?? "#1b2440";
  const isChair = item.type === "chair";

  return (
    <Group
      ref={registerRef}
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      onDragEnd={(e) => onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
      onTransformEnd={(e) => {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const patch: Partial<PlanItem> = { x: Math.round(node.x()), y: Math.round(node.y()), rotation: Math.round(node.rotation()) };
        if (round) patch.radius = Math.max(6, Math.round(r * Math.max(sx, sy)));
        else {
          patch.width = Math.max(10, Math.round(w * sx));
          patch.height = Math.max(10, Math.round(h * sy));
        }
        onChange(patch);
      }}
    >
      {round ? (
        <Circle radius={r} fill={fill} stroke={stroke} strokeWidth={2} shadowColor="#1b2440" shadowOpacity={0.12} shadowBlur={8} shadowOffsetY={3} />
      ) : (
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} cornerRadius={isChair ? 4 : 6} fill={fill} stroke={stroke} strokeWidth={isChair ? 1.5 : 2} shadowColor="#1b2440" shadowOpacity={isChair ? 0 : 0.08} shadowBlur={6} shadowOffsetY={2} />
      )}
      {!isChair && (
        <Text
          x={round ? -r : -w / 2 + 4}
          y={round ? -6 : -6}
          width={round ? r * 2 : w - 8}
          text={item.name}
          fontSize={round ? Math.max(8, Math.min(11, r / 3.2)) : Math.min(12, Math.max(8, Math.floor(h / 3.4)))}
          fontFamily="Manrope, sans-serif"
          fontStyle="bold"
          fill={textColor}
          align="center"
          wrap="none"
          ellipsis
          listening={false}
        />
      )}
    </Group>
  );
}

function ShapeSwatch({ item }: { item: Omit<PlanItem, "id" | "x" | "y" | "rotation"> }) {
  const round = isRound(item.type);
  return (
    <span
      className={round ? "size-5 shrink-0 rounded-full border-2" : "h-3.5 w-5 shrink-0 rounded-sm border-2"}
      style={{ backgroundColor: item.color, borderColor: item.stroke ?? item.color }}
      aria-hidden
    />
  );
}
