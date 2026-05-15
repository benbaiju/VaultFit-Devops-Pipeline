import type { Trainer } from "../../types/api";

export const sampleTrainersList: Trainer[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    bio: "Strength coach",
    specialty: "Hypertrophy",
    hourly_rate: 80,
    verified: true,
    profiles: { full_name: "Alex Trainer", role: "trainer" },
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    bio: "Meal plans",
    specialty: "Nutrition coaching",
    hourly_rate: 70,
    verified: true,
    profiles: { full_name: "Nina Nutritionist", role: "nutritionist" },
  },
];
