declare module '#auth-utils' {
  // Module augmentation merges into the nuxt-auth-utils declaration, which
  // only an interface can do.
  interface User {
    id: string;
    email: string;
    emailVerified: boolean;
    sessionVersion: number;
  }
}

export {};
