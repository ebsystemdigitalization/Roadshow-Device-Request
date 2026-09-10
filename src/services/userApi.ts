import { auth } from '../lib/firebase';
import type { User } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

interface UsersResponse {
  users: User[];
}

interface ApiErrorResponse {
  message?: string;
}

export async function getUsers(): Promise<User[]> {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      'You must be signed in to retrieve the user directory.'
    );
  }

  const idToken = await firebaseUser.getIdToken();

  const response = await fetch(
    `${apiBaseUrl}/api/users`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`
      }
    }
  );

  const payload = (await response.json()) as
    | UsersResponse
    | ApiErrorResponse;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse;

    throw new Error(
      errorPayload.message ||
        `Unable to retrieve users. Status: ${response.status}.`
    );
  }

  return (payload as UsersResponse).users;
}