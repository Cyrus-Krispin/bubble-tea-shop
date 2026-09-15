export type Credentials = {
  email: string;
  password: string;
};

export type AuthSession = {
  accessToken: string;
  expiresAt: number;
  email: string;
};
