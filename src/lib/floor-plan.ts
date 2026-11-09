// Floor plan model and recommended-layout generator for venue bookings.
// Coordinates are in a fixed 980 x 620 logical canvas; shapes are centered on (x, y).

export const STAGE_W = 980;
export const STAGE_H = 620;
export const GRID = 10;

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

export type PaletteEntry = {
  key: string;
  group: string;
  label: string;
  hint: string;
  template: Omit<PlanItem, "id" | "x" | "y" | "rotation">;
};

export const PALETTE: PaletteEntry[] = [
  { key: "round_table", group: "Tables", label: "Round table", hint: "Seats 8", template: { type: "round_table", name: "Round Table", radius: 35, seats: 8, color: PLAN_COLORS.table, stroke: PLAN_COLORS.tableStroke } },
  { key: "rect_table", group: "Tables", label: "Long table", hint: "Seats 3", template: { type: "rect_table", name: "Table", width: 110, height: 36, seats: 3, color: PLAN_COLORS.table, stroke: PLAN_COLORS.tableStroke } },
  { key: "head_table", group: "Tables", label: "Head table", hint: "Seats 6", template: { type: "rect_table", name: "Head Table", width: 220, height: 44, seats: 6, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold } },
  { key: "cocktail_table", group: "Tables", label: "High-top", hint: "Standing", template: { type: "cocktail_table", name: "High-top", radius: 22, seats: 0, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold } },
  { key: "chair", group: "Seating", label: "Chair", hint: "1 seat", template: { type: "chair", name: "Chair", width: 26, height: 24, seats: 1, color: PLAN_COLORS.chair, stroke: PLAN_COLORS.chairStroke } },
  { key: "sofa", group: "Seating", label: "Lounge sofa", hint: "Seats 3", template: { type: "sofa", name: "Lounge Sofa", width: 120, height: 45, seats: 3, color: PLAN_COLORS.chair, stroke: PLAN_COLORS.chairStroke } },
  { key: "stage", group: "Stage and AV", label: "Stage", hint: "Main platform", template: { type: "stage", name: "Stage", width: 260, height: 65, color: PLAN_COLORS.ink, textColor: PLAN_COLORS.inkText } },
  { key: "podium", group: "Stage and AV", label: "Podium", hint: "Speaker", template: { type: "podium", name: "Podium", width: 50, height: 34, color: PLAN_COLORS.gold, textColor: PLAN_COLORS.ink } },
  { key: "screen", group: "Stage and AV", label: "Screen", hint: "Projector", template: { type: "screen", name: "Screen", width: 160, height: 16, color: PLAN_COLORS.slate, textColor: PLAN_COLORS.inkText } },
  { key: "av_booth", group: "Stage and AV", label: "AV console", hint: "Sound and lights", template: { type: "rect_table", name: "AV Console", width: 110, height: 36, seats: 0, color: PLAN_COLORS.slate, textColor: PLAN_COLORS.inkText } },
  { key: "buffet", group: "Room features", label: "Buffet", hint: "Food station", template: { type: "buffet", name: "Buffet Station", width: 200, height: 40, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold } },
  { key: "bar", group: "Room features", label: "Drinks bar", hint: "Beverages", template: { type: "buffet", name: "Beverage Bar", width: 180, height: 40, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold } },
  { key: "door", group: "Room features", label: "Entrance", hint: "Door", template: { type: "door", name: "Entrance", width: 90, height: 26, color: PLAN_COLORS.green, textColor: PLAN_COLORS.inkText } },
  { key: "emergency_exit", group: "Room features", label: "Fire exit", hint: "Keep clear", template: { type: "emergency_exit", name: "Fire Exit", width: 80, height: 26, color: PLAN_COLORS.red, textColor: PLAN_COLORS.inkText } },
  { key: "plant", group: "Room features", label: "Plant", hint: "Decor", template: { type: "plant", name: "Plant", radius: 16, seats: 0, color: PLAN_COLORS.plant, stroke: PLAN_COLORS.plantStroke } },
];

export function isRound(type: string): boolean {
  return type === "round_table" || type === "cocktail_table" || type === "plant";
}

/** Item types whose seat count the user can change. */
export function hasAdjustableSeats(type: string): boolean {
  return type === "round_table" || type === "rect_table" || type === "cocktail_table" || type === "sofa";
}

export function seatsOf(item: PlanItem): number {
  if (item.seats && item.seats > 0) return item.seats;
  return item.type === "chair" ? 1 : 0;
}

export function countSeats(items: PlanItem[]): number {
  return items.reduce((sum, i) => sum + seatsOf(i), 0);
}

/** Styles where guests stand, so seat counts are only a guide. */
export function isStandingStyle(style: string): boolean {
  return style === "cocktail";
}

export type ChairMark = { x: number; y: number };

/**
 * Where to draw the chairs of a table, relative to its center (before rotation).
 * Long tables seat one side (the +y side) until it is full, then both sides.
 */
export function chairMarks(item: PlanItem): ChairMark[] {
  const seats = item.type === "chair" || item.type === "sofa" ? 0 : seatsOf(item);
  if (seats <= 0) return [];
  if (isRound(item.type)) {
    const r = (item.radius ?? 30) + 10;
    return Array.from({ length: seats }, (_, i) => {
      const a = (Math.PI * 2 * i) / seats - Math.PI / 2;
      return { x: Math.round(r * Math.cos(a) * 10) / 10, y: Math.round(r * Math.sin(a) * 10) / 10 };
    });
  }
  const w = item.width ?? 60;
  const h = item.height ?? 40;
  const perSide = Math.max(1, Math.floor(w / 32));
  const front = Math.min(seats, perSide);
  const back = seats > perSide ? seats - front : 0;
  const row = (n: number, y: number) =>
    Array.from({ length: n }, (_, i) => ({ x: Math.round((-w / 2 + (w * (i + 0.5)) / n) * 10) / 10, y }));
  return [...row(front, h / 2 + 9), ...row(back, -h / 2 - 9)];
}

/** Keeps an item's center on the canvas. */
export function clampToStage(x: number, y: number): { x: number; y: number } {
  return { x: Math.min(STAGE_W - 5, Math.max(5, x)), y: Math.min(STAGE_H - 5, Math.max(5, y)) };
}

export function snap(v: number, grid = GRID): number {
  return Math.round(v / grid) * grid;
}

/** X positions for `count` columns spaced `gap` apart, centered on the canvas. */
function centeredColumns(count: number, gap: number): number[] {
  const start = STAGE_W / 2 - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, i) => Math.round(start + i * gap));
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
  const table = PLAN_COLORS.table;
  const tableStroke = PLAN_COLORS.tableStroke;

  const usesTables = ["banquet", "classroom", "ushape"].includes(style);
  const cap = usesTables ? venue.capacity_tables || 100 : venue.capacity || 150;
  const pax = Math.max(1, Math.min(attendees || 1, cap));

  // Fixed room features
  if (style === "ushape") {
    add({ type: "screen", name: "Projection Screen", x: 490, y: 50, width: 220, height: 16, color: PLAN_COLORS.slate, textColor: PLAN_COLORS.inkText });
    add({ type: "rect_table", name: "AV Console", x: 880, y: 50, width: 110, height: 34, seats: 0, color: PLAN_COLORS.slate, textColor: PLAN_COLORS.inkText });
  } else {
    add({ type: "stage", name: "Main Stage", x: 490, y: 65, width: 300, height: 70, color: PLAN_COLORS.ink, textColor: PLAN_COLORS.inkText });
    add({ type: "podium", name: "Podium", x: 490, y: 130, width: 54, height: 34, color: PLAN_COLORS.gold, textColor: PLAN_COLORS.ink });
  }
  add({ type: "door", name: "Entrance A", x: 105, y: 595, width: 90, height: 28, color: PLAN_COLORS.green, textColor: PLAN_COLORS.inkText });
  add({ type: "door", name: "Entrance B", x: 875, y: 595, width: 90, height: 28, color: PLAN_COLORS.green, textColor: PLAN_COLORS.inkText });
  add({ type: "emergency_exit", name: "Fire Exit", x: 70, y: 40, width: 80, height: 26, color: PLAN_COLORS.red, textColor: PLAN_COLORS.inkText });

  if (style === "banquet") {
    const count = Math.max(2, Math.ceil(pax / 8));
    const cols = Math.min(5, count);
    const xs = centeredColumns(cols, 160);
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const inRow = Math.min(cols, count - r * cols);
      const rowXs = inRow === cols ? xs : centeredColumns(inRow, 160);
      add({ type: "round_table", name: `Table ${i + 1}`, x: rowXs[i % cols]!, y: 225 + r * 105, radius: 36, seats: 8, color: table, stroke: tableStroke });
    }
    add({ type: "buffet", name: "Buffet Station", x: 490, y: 560, width: 280, height: 40, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold });
  } else if (style === "classroom") {
    const count = Math.ceil(pax / 4);
    const cols = Math.min(5, count);
    const xs = centeredColumns(cols, 160);
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      add({ type: "rect_table", name: `Desk ${i + 1}`, x: xs[i % cols]!, y: 200 + r * 70, width: 136, height: 34, seats: 4, color: table, stroke: tableStroke });
    }
  } else if (style === "ushape") {
    // Outer U of conference tables; a second, inner U is added for larger groups.
    type Slot = { x: number; y: number; rotation: number };
    const ring = (left: number, right: number, top: number, bottom: number): Slot[] => {
      const slots: Slot[] = [];
      for (let y = top; y + 50 <= bottom - 40; y += 104) slots.push({ x: left, y, rotation: 90 });
      for (let y = top; y + 50 <= bottom - 40; y += 104) slots.push({ x: right, y, rotation: 270 });
      const span = right - left - 120;
      const count = Math.max(1, Math.floor((span + 4) / 104));
      const start = (left + right) / 2 - ((count - 1) * 104) / 2;
      for (let i = 0; i < count; i++) slots.push({ x: Math.round(start + i * 104), y: bottom, rotation: 0 });
      return slots;
    };
    const outer = ring(170, 810, 140, 545);
    const inner = ring(330, 650, 140, 395);
    const single = pax <= outer.length * 3;
    const seatsPer = single ? 3 : 6;
    const needed = Math.ceil(pax / seatsPer);
    const slots = [...outer, ...inner].slice(0, needed);
    slots.forEach((s, i) =>
      add({ type: "rect_table", name: `Table ${i + 1}`, x: s.x, y: s.y, rotation: s.rotation, width: 100, height: 36, seats: seatsPer, color: table, stroke: tableStroke }),
    );
  } else if (style === "cocktail") {
    const count = Math.ceil(pax / 5);
    const cols = Math.min(8, count);
    const xs = centeredColumns(cols, 90);
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      add({ type: "cocktail_table", name: `High-top ${i + 1}`, x: xs[c]! - 15 + (r % 2) * 30, y: 220 + r * 72, radius: 22, seats: 0, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold });
    }
    add({ type: "buffet", name: "Beverage Bar", x: 490, y: 560, width: 240, height: 40, color: PLAN_COLORS.goldSoft, stroke: PLAN_COLORS.gold });
    add({ type: "sofa", name: "Lounge Sofa", x: 900, y: 300, rotation: 90, width: 120, height: 45, seats: 3, color: PLAN_COLORS.chair, stroke: PLAN_COLORS.chairStroke });
    add({ type: "plant", name: "Plant", x: 60, y: 300, radius: 16, color: PLAN_COLORS.plant, stroke: PLAN_COLORS.plantStroke });
  } else {
    // theater: chair rows sized to the attendee count, with a center aisle
    const cols = 15;
    const rows = Math.ceil(pax / cols);
    const startX = STAGE_W / 2 - (14 * 38 + 30) / 2;
    let placed = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols && placed < pax; c++) {
        const aisle = c >= 8 ? 30 : 0;
        add({ type: "chair", name: `Row ${r + 1} Seat ${c + 1}`, x: Math.round(startX + c * 38 + aisle), y: 200 + r * 36, width: 26, height: 24, seats: 1, color: PLAN_COLORS.chair, stroke: PLAN_COLORS.chairStroke });
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
