import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStaff } from "./staff-scope";

export type MealPlan = {
  id: number;
  venue_id: number;
  name: string;
  description: string;
  price_per_person: number;
  inclusions: string[];
  active: boolean;
};

// Initial default meal plans for university venues
const defaultMealPlans: MealPlan[] = [
  // HRT Center Meal Plans
  {
    id: 1,
    venue_id: 1,
    name: "Silver Banquet Buffet",
    description: "Classic collegiate dining with welcome refreshment, 2 mains, rice, and dessert.",
    price_per_person: 380,
    inclusions: [
      "Welcome chilled iced tea",
      "Soup of the day & dinner rolls",
      "Chicken Inasal skewers & Roast Pork tenderloin",
      "Steamed Pandan Jasmine Rice",
      "Leche flan & seasonal fruit cup",
    ],
    active: true,
  },
  {
    id: 2,
    venue_id: 1,
    name: "Gold Gala Executive Buffet",
    description: "Premium 3-course gala spread tailored for conferences and formal banquets.",
    price_per_person: 550,
    inclusions: [
      "Welcome fruit punch cocktail",
      "Cream of wild mushroom soup & Caesar salad bar",
      "Beef Stroganoff, Grilled Fish Fillet in Lemon Butter & Herb Roast Chicken",
      "Garlic Buttered Rice & Fettuccine Alfredo",
      "Assorted mini French pastries & Fresh fruit platter",
      "Free-flow iced tea & brewed university coffee",
    ],
    active: true,
  },
  {
    id: 3,
    venue_id: 1,
    name: "Academic Seminar Package",
    description: "Packed conference menu with morning snack, hearty lunch, and afternoon pastry.",
    price_per_person: 320,
    inclusions: [
      "AM Snack: Chicken clubhouse sandwich & fruit juice",
      "Lunch: Grilled pork belly, chicken teriyaki, steamed rice & dessert bar",
      "PM Snack: Baked lasagna slice & chilled lemon tea",
      "Unlimited brewed coffee station",
    ],
    active: true,
  },
  {
    id: 4,
    venue_id: 1,
    name: "No Meal Plan (Outside / Self-Catering)",
    description: "Bring your own accredited food provider or self-organized banquet setup.",
    price_per_person: 0,
    inclusions: ["Catering prep area access", "Trash disposal station"],
    active: true,
  },

  // TLE Service Center Meal Plans
  {
    id: 5,
    venue_id: 2,
    name: "TLE Standard Workshop Spread",
    description: "Economical and wholesome meal bundle for student workshops and symposia.",
    price_per_person: 280,
    inclusions: [
      "AM Snack: Ham & cheese croissant with calamansi juice",
      "Lunch: Breaded pork cutlet, buttered vegetables, steamed rice & sweet gelatin",
      "PM Snack: Native bibingka & hot chocolate or coffee",
    ],
    active: true,
  },
  {
    id: 6,
    venue_id: 2,
    name: "TLE Executive Conference Buffet",
    description: "Full buffet spread with 3 savory entrees, soup, pasta, and unlimited drinks.",
    price_per_person: 480,
    inclusions: [
      "Welcome tropical fruit blend",
      "Corn and crab soup & fresh tossed salad",
      "Braised Beef Caldereta, Crispy Garlic Fish & Honey Glazed Chicken",
      "Spaghetti Bolognese & fragrant steamed rice",
      "Buko pandan salad & chocolate moist cake",
      "Unlimited iced tea and coffee",
    ],
    active: true,
  },
  {
    id: 7,
    venue_id: 2,
    name: "Coffee Break & Heavy Snacks",
    description: "Light all-day refreshment service for briefings and board meetings.",
    price_per_person: 180,
    inclusions: [
      "All-day hot brewed coffee & herbal tea selection",
      "2 assorted savory pastries (Empanada & Tuna Puff)",
      "Fresh seasonal fruit bites",
    ],
    active: true,
  },
  {
    id: 8,
    venue_id: 2,
    name: "No Meal Plan (Outside / Self-Catering)",
    description: "Bring your own accredited food provider or self-organized banquet setup.",
    price_per_person: 0,
    inclusions: ["Catering prep area access", "Trash disposal station"],
    active: true,
  },
];

// In-memory store for runtime modifications
let mealPlansStore: MealPlan[] = [...defaultMealPlans];

export function getVenueMealPlansList(venueId: number, onlyActive = true): MealPlan[] {
  return mealPlansStore.filter((m) => m.venue_id === venueId && (!onlyActive || m.active));
}

export const getVenueMealPlans = createServerFn({ method: "GET" })
  .inputValidator((d: { venueId: number }) =>
    z.object({ venueId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) => {
    return getVenueMealPlansList(data.venueId, true);
  });

export const listAdminMealPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { venueId: number }) =>
    z.object({ venueId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    return getVenueMealPlansList(data.venueId, false);
  });

const mealPlanInput = z.object({
  id: z.number().int().positive().optional(),
  venue_id: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).default(""),
  price_per_person: z.number().min(0).max(50000),
  inclusions: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const saveMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof mealPlanInput>) => mealPlanInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    if (data.id) {
      const idx = mealPlansStore.findIndex((m) => m.id === data.id);
      if (idx >= 0) {
        mealPlansStore[idx] = {
          ...mealPlansStore[idx]!,
          name: data.name,
          description: data.description,
          price_per_person: data.price_per_person,
          inclusions: data.inclusions,
          active: data.active,
        };
        return { ok: true, mealPlan: mealPlansStore[idx] };
      }
    }
    const nextId = mealPlansStore.length > 0 ? Math.max(...mealPlansStore.map((m) => m.id)) + 1 : 1;
    const newPlan: MealPlan = {
      id: nextId,
      venue_id: data.venue_id,
      name: data.name,
      description: data.description,
      price_per_person: data.price_per_person,
      inclusions: data.inclusions,
      active: data.active,
    };
    mealPlansStore.push(newPlan);
    return { ok: true, mealPlan: newPlan };
  });

export const deleteMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const idx = mealPlansStore.findIndex((m) => m.id === data.id);
    if (idx >= 0) {
      mealPlansStore[idx]!.active = false;
      return { ok: true };
    }
    return { ok: false, message: "Meal plan not found" };
  });
