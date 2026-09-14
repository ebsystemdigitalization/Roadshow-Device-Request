import { auth } from '../lib/firebase';
import type { DeviceInventoryItem } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

interface DeviceInventoryResponse {
  items: DeviceInventoryItem[];
}

interface DeviceInventoryItemResponse {
  item: DeviceInventoryItem;
}

interface ImportDeviceInventoryResponse {
  message: string;
  importedCount: number;
  items: DeviceInventoryItem[];
}

interface DeleteDeviceInventoryResponse {
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
      'You must be signed in to access the device inventory.'
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
        `Device Inventory API request failed with status ${response.status}.`
    );
  }

  return payload as T;
}

export async function getDeviceInventory(): Promise<
  DeviceInventoryItem[]
> {
  const response =
    await apiRequest<DeviceInventoryResponse>(
      '/api/device-inventory'
    );

  return response.items;
}

export async function importDeviceInventory(
  items: DeviceInventoryItem[],
  appendMode: boolean
): Promise<ImportDeviceInventoryResponse> {
  return apiRequest<ImportDeviceInventoryResponse>(
    '/api/device-inventory/import',
    {
      method: 'POST',
      body: JSON.stringify({
        items,
        appendMode
      })
    }
  );
}

export async function updateDeviceInventoryItem(
  item: DeviceInventoryItem
): Promise<DeviceInventoryItem> {
  const response =
    await apiRequest<DeviceInventoryItemResponse>(
      `/api/device-inventory/${encodeURIComponent(
        item.id
      )}`,
      {
        method: 'PUT',
        body: JSON.stringify(item)
      }
    );

  return response.item;
}

export async function deleteDeviceInventoryItem(
  itemId: string
): Promise<DeleteDeviceInventoryResponse> {
  return apiRequest<DeleteDeviceInventoryResponse>(
    `/api/device-inventory/${encodeURIComponent(
      itemId
    )}`,
    {
      method: 'DELETE'
    }
  );
}