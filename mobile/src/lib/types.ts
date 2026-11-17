/* Shapes returned by the website's /api/mobile endpoints (see app/api/mobile in the web project). */

export type Point = { label: string; value: number };
export type MemberState = {
  day: string;
  weekStart: string;
  tracker: { water: number; steps: number; sleep: number | null; mood: string | null; trained: boolean; weights: Point[]; fats: Point[] };
  workout: { done: number[]; finished: boolean; feedback: string; completedDays: number[] };
  checkin: { submitted: boolean; energy: string; planFit: string };
  booking: string | null;
  payment: { submitted: boolean; reference: string };
  nutrition: { preference: string; logged: string[]; water: Record<string, number> };
};

export type PlannedWorkout = { title: string; exercises: string[]; time: string | null; durationMin: number | null; meetingUrl: string | null };
export type WeekPlan = (PlannedWorkout | null)[];
export type Message = { id: number; body: string; at: string; author: string; fromMember: boolean };
export type NutritionPlan = { calories: number | null; protein: number | null; meals: { name: string; detail: string }[]; notes: string };

export type HealthDay = {
  day: string;
  steps: number | null;
  activeKcal: number | null;
  restingHr: number | null;
  sleepMin: number | null;
  workouts: number | null;
  workoutMin: number | null;
  weightKg: number | null;
};

export type Dashboard = {
  today: string;
  weekStart: string;
  user: { name: string; initials: string; email: string };
  needsOnboarding: boolean;
  member: { memberNo: number; goal: string; stage: string; joinedOn: string | null; cancelled: boolean; meetingUrl: string | null } | null;
  coach: { name: string; initials: string } | null;
  state: MemberState;
  revision: number;
  schedule: WeekPlan | null;
  nutritionPlan: NutritionPlan | null;
  confirmed: string[];
  messages: Message[];
  health: { days: HealthDay[]; lastSync: string | null };
};

export const moods = ['Low', 'Okay', 'Good', 'Great'] as const;
export const feedbacks = ['Too easy', 'About right', 'Too difficult'] as const;
/** The website stores at most this many steps in the daily tracker. */
export const TRACKER_STEPS_MAX = 15000;
