export type UserRole = 'user' | 'admin';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}
