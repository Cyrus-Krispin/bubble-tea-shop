export type Credentials = {
  email: string;
  password: string;
};

export type AuthSession = {
  userId: string;
  accessToken: string;
  expiresAt: number;
  email: string;
};
