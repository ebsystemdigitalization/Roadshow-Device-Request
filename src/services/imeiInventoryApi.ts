import { auth } from '../lib/firebase';
import type { ImeiInventoryItem } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

interface ImeiInventoryResponse {
  items: ImeiInventoryItem[];
}

interface ImeiInventoryItemResponse {
  item: ImeiInventoryItem;
}

interface ImportImeiInventoryResponse {
  message: string;
  importedCount: number;
  items: ImeiInventoryItem[];
}

interface DeleteImeiInventoryResponse {
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
      'You must be signed in to access the IMEI inventory.'
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
    const errorPayload = payload as ApiErrorResponse;

    throw new Error(
      errorPayload.message ||
        `IMEI Inventory API request failed with status ${response.status}.`
    );
  }

  return payload as T;
}

export async function getImeiInventory(): Promise<
  ImeiInventoryItem[]
> {
  const response =
    await apiRequest<ImeiInventoryResponse>(
      '/api/imei-inventory'
    );

  return response.items;
}

export async function importImeiInventory(
  items: ImeiInventoryItem[],
  appendMode: boolean
): Promise<ImportImeiInventoryResponse> {
  return apiRequest<ImportImeiInventoryResponse>(
    '/api/imei-inventory/import',
    {
      method: 'POST',
      body: JSON.stringify({
        items,
        appendMode
      })
    }
  );
}

export async function updateImeiInventoryItem(
  item: ImeiInventoryItem
): Promise<ImeiInventoryItem> {
  const response =
    await apiRequest<ImeiInventoryItemResponse>(
      `/api/imei-inventory/${encodeURIComponent(
        item.id
      )}`,
      {
        method: 'PUT',
        body: JSON.stringify(item)
      }
    );

  return response.item;
}

export async function deleteImeiInventoryItem(
  itemId: string
): Promise<DeleteImeiInventoryResponse> {
  return apiRequest<DeleteImeiInventoryResponse>(
    `/api/imei-inventory/${encodeURIComponent(
      itemId
    )}`,
    {
      method: 'DELETE'
    }
  );
}