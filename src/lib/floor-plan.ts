// Floor plan model and recommended-layout generator for venue bookings.
// Coordinates are in a fixed 980 x 620 logical canvas; shapes are centered on (x, y).

export const STAGE_W = 980;
export const STAGE_H = 620;

export type ItemType =
  | "round_table"
  | "cocktail_table"
  | "rect_table"
  | "chair"
  | "sofa"
  | "stage"
  | "podium"
  | "screen"
  | "buffet"
  | "door"
  | "emergency_exit"
  | "plant";

export type PlanItem = {
  id: string;
  type: ItemType | string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  width?: number | undefined;
  height?: number | undefined;
  radius?: number | undefined;
  seats?: number | undefined;
  color?: string | undefined;
  stroke?: string | undefined;
  textColor?: string | undefined;
};

export type FloorPlan = {
  stage: { width: number; height: number };
  style: string;
  attendees?: number | undefined;
  items: PlanItem[];
};

// Canvas drawing palette (stored with each item so saved plans render identically).
export const PLAN_COLORS = {
  ink: "#1b2440",
  inkText: "#f6f3ea",
  gold: "#c99a2e",
  goldSoft: "#f6ecd2",
  table: "#ffffff",
  tableStroke: "#2c3a63",
  chair: "#dfe5f2",
  chairStroke: "#2c3a63",
  green: "#2f8a5f",
  red: "#c2412d",
  plant: "#e3f1e6",
  plantStroke: "#3d8b55",
  slate: "#4a5470",
};

export const PALETTE: { key: string; group: string; label: string; template: Omit<PlanItem, "id" | "x" | "y" | "rotation"> }[] = [
  { key: "round_table", group: "Tables", label: "Round table (8)", template: { type: "round_table", name: "Round Table", radius: 35, seats: 8, color: PLAN_COLORS.table, stroke: PLAN_COLORS.tableStroke } },
  { key: "rect_table", group: "Tables", label: "Rect table (4)", template: { type: "rect_table", name: "Table", width: 120, height: 40, seats: 4, color: PLAN_COLORS.table, stroke: PLAN_COLORS.tableStroke } },
  { key: "cocktail_table", group: "Tables", label: "High-top (4)", template: { type: "cocktail_table", name: "High-top", radius: 22, seats: 4, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold } },
  { key: "head_table", group: "Tables", label: "Head table (6)", template: { type: "rect_table", name: "Head Table", width: 220, height: 45, seats: 6, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold } },
  { key: "chair", group: "Seating", label: "Chair", template: { type: "chair", name: "Chair", width: 22, height: 22, seats: 1, color: PLAN_COLORS.chair, stroke: PLAN_COLORS.chairStroke } },
  { key: "sofa", group: "Seating", label: "Lounge sofa (3)", template: { type: "sofa", name: "Lounge Sofa", width: 120, height: 45, seats: 3, color: PLAN_COLORS.chair, stroke: PLAN_COLORS.chairStroke } },
  { key: "stage", group: "Stage and AV", label: "Main stage", template: { type: "stage", name: "Stage", width: 260, height: 65, color: PLAN_COLORS.ink, textColor: PLAN_COLORS.inkText } },
  { key: "podium", group: "Stage and AV", label: "Podium", template: { type: "podium", name: "Podium", width: 44, height: 36, color: PLAN_COLORS.gold, textColor: PLAN_COLORS.ink } },
  { key: "screen", group: "Stage and AV", label: "Projector screen", template: { type: "screen", name: "Screen", width: 140, height: 16, color: PLAN_COLORS.slate, textColor: PLAN_COLORS.inkText } },
  { key: "av_booth", group: "Stage and AV", label: "AV console", template: { type: "rect_table", name: "AV Console", width: 120, height: 38, color: PLAN_COLORS.slate, textColor: PLAN_COLORS.inkText } },
  { key: "buffet", group: "Amenities", label: "Buffet station", template: { type: "buffet", name: "Buffet Station", width: 200, height: 40, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold } },
  { key: "bar", group: "Amenities", label: "Beverage bar", template: { type: "buffet", name: "Beverage Bar", width: 180, height: 40, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold } },
  { key: "door", group: "Amenities", label: "Entrance", template: { type: "door", name: "Entrance", width: 80, height: 26, color: PLAN_COLORS.green, textColor: PLAN_COLORS.inkText } },
  { key: "plant", group: "Amenities", label: "Decor plant", template: { type: "plant", name: "Plant", radius: 16, seats: 0, color: PLAN_COLORS.plant, stroke: PLAN_COLORS.plantStroke } },
];

export function isRound(type: string): boolean {
  return type === "round_table" || type === "cocktail_table" || type === "plant";
}

export function seatsOf(item: PlanItem): number {
  if (item.seats && item.seats > 0) return item.seats;
  return item.type === "chair" ? 1 : 0;
}

export function countSeats(items: PlanItem[]): number {
  return items.reduce((sum, i) => sum + seatsOf(i), 0);
}

export function generateRecommendedLayout(
  venue: { capacity: number; capacity_tables: number },
  attendees: number,
  style: string,
): FloorPlan {
  const items: PlanItem[] = [];
  let n = 1;
  const id = () => `item_${n++}`;
  const add = (i: Omit<PlanItem, "id" | "rotation"> & { rotation?: number }) =>
    items.push({ rotation: 0, ...i, id: id() });

  const usesTables = ["banquet", "classroom", "ushape"].includes(style);
  const cap = usesTables ? venue.capacity_tables || 100 : venue.capacity || 150;
  const pax = Math.max(1, Math.min(attendees || 1, cap));

  // Fixed room features
  if (style === "ushape") {
    add({ type: "screen", name: "Projection Screen", x: 490, y: 50, width: 220, height: 16, color: PLAN_COLORS.slate, textColor: PLAN_COLORS.inkText });
  } else {
    add({ type: "stage", name: "Main Stage", x: 490, y: 65, width: 300, height: 70, color: PLAN_COLORS.ink, textColor: PLAN_COLORS.inkText });
    add({ type: "podium", name: "Podium", x: 490, y: 130, width: 54, height: 34, color: PLAN_COLORS.gold, textColor: PLAN_COLORS.ink });
  }
  add({ type: "door", name: "Entrance A", x: 105, y: 595, width: 90, height: 28, color: PLAN_COLORS.green, textColor: PLAN_COLORS.inkText });
  add({ type: "door", name: "Entrance B", x: 875, y: 595, width: 90, height: 28, color: PLAN_COLORS.green, textColor: PLAN_COLORS.inkText });
  add({ type: "emergency_exit", name: "Fire Exit", x: 70, y: 40, width: 80, height: 26, color: PLAN_COLORS.red, textColor: PLAN_COLORS.inkText });

  if (style === "banquet") {
    const count = Math.max(2, Math.ceil(pax / 8));
    const cols = 5;
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      add({ type: "round_table", name: `Table ${i + 1}`, x: 170 + c * 160, y: 215 + r * 100, radius: 36, seats: 8, color: PLAN_COLORS.table, stroke: PLAN_COLORS.tableStroke });
    }
    add({ type: "buffet", name: "Buffet Station", x: 490, y: 555, width: 280, height: 40, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold });
  } else if (style === "classroom") {
    const count = Math.ceil(pax / 4);
    const cols = 5;
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      add({ type: "rect_table", name: `Desk ${i + 1}`, x: 170 + c * 160, y: 200 + r * 68, width: 136, height: 36, seats: 4, color: PLAN_COLORS.table, stroke: PLAN_COLORS.tableStroke });
    }
  } else if (style === "ushape") {
    const tables = Math.ceil(pax / 3);
    const perSide = Math.min(8, Math.max(2, Math.ceil(tables / 3)));
    let placed = 0;
    const tbl = (x: number, y: number, rotation: number) => {
      placed++;
      add({ type: "rect_table", name: `Table ${placed}`, x, y, rotation, width: 100, height: 36, seats: 3, color: PLAN_COLORS.table, stroke: PLAN_COLORS.tableStroke });
    };
    for (let i = 0; i < perSide && placed < tables; i++) tbl(250, 150 + i * 52, 90);
    for (let i = 0; i < perSide && placed < tables; i++) tbl(730, 150 + i * 52, 90);
    const bottomY = 150 + perSide * 52;
    const bottomCount = Math.min(4, tables - placed);
    for (let i = 0; i < bottomCount; i++) tbl(325 + i * 110, bottomY, 0);
    add({ type: "rect_table", name: "AV Console", x: 870, y: 120, width: 110, height: 36, color: PLAN_COLORS.slate, textColor: PLAN_COLORS.inkText });
  } else if (style === "cocktail") {
    const count = Math.ceil(pax / 5);
    const cols = 8;
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      add({ type: "cocktail_table", name: `High-top ${i + 1}`, x: 160 + c * 94 + (r % 2) * 30, y: 220 + r * 72, radius: 22, seats: 0, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold });
    }
    add({ type: "buffet", name: "Beverage Bar", x: 490, y: 560, width: 240, height: 40, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold });
    add({ type: "sofa", name: "Lounge Sofa", x: 880, y: 300, rotation: 90, width: 120, height: 45, seats: 3, color: PLAN_COLORS.chair, stroke: PLAN_COLORS.chairStroke });
    add({ type: "plant", name: "Plant", x: 60, y: 300, radius: 16, color: PLAN_COLORS.plant, stroke: PLAN_COLORS.plantStroke });
  } else {
    // theater: chair rows sized to the attendee count
    const cols = 15;
    const rows = Math.ceil(pax / cols);
    let placed = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols && placed < pax; c++) {
        const aisle = c >= 8 ? 30 : 0;
        add({ type: "chair", name: `R${r + 1}-S${c + 1}`, x: 185 + c * 38 + aisle, y: 200 + r * 36, width: 26, height: 24, seats: 1, color: PLAN_COLORS.chair, stroke: PLAN_COLORS.chairStroke });
        placed++;
      }
    }
  }

  return { stage: { width: STAGE_W, height: STAGE_H }, style, attendees: pax, items };
}

/** Accepts plans saved by the previous system, dropping fields the new editor does not use. */
export function normalizePlan(raw: unknown): FloorPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { items?: unknown; style?: unknown; attendees?: unknown };
  if (!Array.isArray(r.items)) return null;
  const items: PlanItem[] = r.items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i, idx) => ({
      id: String(i["id"] ?? `item_${idx + 1}`),
      type: String(i["type"] ?? "rect_table"),
      name: String(i["name"] ?? "Item"),
      x: Number(i["x"] ?? 100),
      y: Number(i["y"] ?? 100),
      rotation: Number(i["rotation"] ?? 0),
      width: i["width"] != null ? Number(i["width"]) : undefined,
      height: i["height"] != null ? Number(i["height"]) : undefined,
      radius: i["radius"] != null ? Number(i["radius"]) : undefined,
      seats: i["seats"] != null ? Number(i["seats"]) : undefined,
      color: typeof i["color"] === "string" ? i["color"] : undefined,
      stroke: typeof i["stroke"] === "string" ? i["stroke"] : undefined,
      textColor: typeof i["textColor"] === "string" ? i["textColor"] : undefined,
    }));
  return {
    stage: { width: STAGE_W, height: STAGE_H },
    style: typeof r.style === "string" ? r.style : "custom",
    attendees: typeof r.attendees === "number" ? r.attendees : undefined,
    items,
  };
}
