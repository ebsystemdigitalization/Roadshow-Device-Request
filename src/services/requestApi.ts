import { auth } from '../lib/firebase';
import type { RoadshowRequest } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

interface RequestsResponse {
  requests: RoadshowRequest[];
}

interface RequestResponse {
  request: RoadshowRequest;
}

interface DeleteResponse {
  message: string;
  id: string;
}

interface ApiErrorResponse {
  message?: string;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      'You must be signed in to perform this action.'
    );
  }

  const idToken = await firebaseUser.getIdToken();

  const response = await fetch(
    `${apiBaseUrl}${path}`,
    {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...options.headers
      }
    }
  );

  const payload = (await response.json()) as
    | T
    | ApiErrorResponse;

  if (!response.ok) {
    const errorPayload =
      payload as ApiErrorResponse;

    throw new Error(
      errorPayload.message ||
        `RDR API request failed with status ${response.status}.`
    );
  }

  return payload as T;
}

export async function getRequests(): Promise<
  RoadshowRequest[]
> {
  const response =
    await apiRequest<RequestsResponse>(
      '/api/requests'
    );

  return response.requests;
}

export async function createRequest(
  request: RoadshowRequest
): Promise<RoadshowRequest> {
  const response =
    await apiRequest<RequestResponse>(
      '/api/requests',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

  return response.request;
}

export async function updateRequest(
  request: RoadshowRequest
): Promise<RoadshowRequest> {
  const response =
    await apiRequest<RequestResponse>(
      `/api/requests/${encodeURIComponent(
        request.id
      )}`,
      {
        method: 'PUT',
        body: JSON.stringify(request)
      }
    );

  return response.request;
}

export async function deleteRequest(
  requestId: string
): Promise<DeleteResponse> {
  return apiRequest<DeleteResponse>(
    `/api/requests/${encodeURIComponent(
      requestId
    )}`,
    {
      method: 'DELETE'
    }
  );
}