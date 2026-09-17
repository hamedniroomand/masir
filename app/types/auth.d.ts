declare module '#auth-utils' {
  interface User {
    id: string;
    email: string;
    emailVerified: boolean;
    sessionVersion: number;
  }
}

export {};
