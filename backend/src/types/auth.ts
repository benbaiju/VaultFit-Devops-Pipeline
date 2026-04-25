export type AppRole = "client" | "trainer" | "nutritionist" | "admin";

export interface AuthUserClaims {
  sub: string;
  email?: string;
  role?: AppRole;
}

export interface RequestUser {
  id: string;
  email?: string;
  role?: AppRole;
}
