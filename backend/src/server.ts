import express, {
  type Request,
  type Response
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createHash } from 'node:crypto';
import { getMessaging } from 'firebase-admin/messaging';

import { db } from './firebase.js';
import { requireAuth } from './middleware/auth.js';
import { userRoutes } from './userRoutes.js';

const app = express();
const port = Number(process.env.PORT) || 8080;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS
      .split(',')
      .map(origin => origin.trim())
  : ['http://localhost:3000'];

const requestsCollection = db.collection('requests');
const usersCollection = db.collection('users');
const deviceInventoryCollection = db.collection('device_inventory');
const imeiInventoryCollection = db.collection('imei_inventory');
const requestCountersCollection = db.collection('request_counters');
const requestCodeRegistryCollection = db.collection('request_code_registry');
const pushSubscriptionsCollection = db.collection('push_subscriptions');
const notificationsCollection = db.collection('notifications');

/**
 * Allocate a request code centrally so concurrent users cannot receive the same code.
 * A Firestore transaction serializes sequence updates and checks legacy requests
 * that may not yet have a registry record.
 */
async function allocateRequestCode(): Promise<string> {
  const now = new Date();
  const year = Number(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      timeZone: 'Asia/Kuala_Lumpur'
    }).format(now)
  );
  const prefix = `RDR-${year}-`;
  const counterRef = requestCountersCollection.doc(String(year));
  const updatedAt = now.toISOString();

  return db.runTransaction(async transaction => {
    const counterSnapshot = await transaction.get(counterRef);
    let lastSequence = Number(counterSnapshot.data()?.lastSequence || 0);

    if (!counterSnapshot.exists) {
      const latestRequestQuery = requestsCollection
        .where('requestCode', '>=', prefix)
        .where('requestCode', '<', `${prefix}\uf8ff`)
        .orderBy('requestCode', 'desc')
        .limit(1);
      const latestRequestSnapshot = await transaction.get(latestRequestQuery);
      const latestCode = String(latestRequestSnapshot.docs[0]?.data()?.requestCode || '');
      const latestMatch = latestCode.match(new RegExp(`^RDR-${year}-(\\d+)$`, 'i'));
      if (latestMatch) lastSequence = Number(latestMatch[1]) || 0;
    }

    let sequence = lastSequence + 1;
    let requestCode = '';
    let registryRef = requestCodeRegistryCollection.doc();

    while (true) {
      requestCode = `${prefix}${String(sequence).padStart(4, '0')}`;
      registryRef = requestCodeRegistryCollection.doc(requestCode);

      const registrySnapshot = await transaction.get(registryRef);
      const existingRequestSnapshot = await transaction.get(
        requestsCollection.where('requestCode', '==', requestCode).limit(1)
      );

      if (!registrySnapshot.exists && existingRequestSnapshot.empty) break;
      sequence += 1;
    }

    transaction.create(registryRef, {
      requestCode,
      year,
      createdAt: updatedAt
    });
    transaction.set(counterRef, {
      year,
      lastSequence: sequence,
      updatedAt
    });

    return requestCode;
  });
}

interface UserProfile {
  name?: string;
  email?: string;
  role?: string;
  state?: string;
  region?: string;
  avatarUrl?: string;
  headOfUnit?: string;
  headOfSales?: string;
  headOfDepartment?: string;
  userStatus?: string;
  status?: string;
}

type FirestoreRequestRecord = Record<string, unknown> & {
  id: string;
};

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

app.use(express.json({ limit: '2mb' }));

function isRequestBodyValid(
  body: unknown
): body is Record<string, unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body)
  );
}

function getRouteParameter(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() || '';
  }

  return value?.trim() || '';
}

async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  const userDocument = await db
    .collection('users')
    .doc(uid)
    .get();

  if (!userDocument.exists) {
    return null;
  }

  return userDocument.data() as UserProfile;
}

function isUserActive(profile: UserProfile): boolean {
  const status =
    profile.userStatus ||
    profile.status ||
    'Active';

  return status !== 'Inactive';
}

function normalizedComparisonValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().toLowerCase()
    : '';
}

function pushTokenDocumentId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface PushNotificationPlan {
  recipientUids: string[];
  title: string;
  body: string;
}

async function getActiveUsersByRole(
  role: string
): Promise<Array<{ uid: string; profile: UserProfile }>> {
  const snapshot = await usersCollection.where('role', '==', role).get();
  return snapshot.docs
    .map(document => ({
      uid: document.id,
      profile: document.data() as UserProfile
    }))
    .filter(item => isUserActive(item.profile));
}

async function resolvePushNotificationPlan(
  requestData: Record<string, unknown>,
  nextStatus: string,
  actorRole: string
): Promise<PushNotificationPlan | null> {
  // Auth UIDs are case-sensitive; keep their original value for Firestore lookups.
  const requestorUid = typeof requestData.createdByUserId === 'string'
    ? requestData.createdByUserId.trim()
    : '';
  const requestCode = typeof requestData.requestCode === 'string' && requestData.requestCode.trim()
    ? requestData.requestCode.trim()
    : 'A roadshow request';
  const partA = isRequestBodyValid(requestData.partA) ? requestData.partA : {};
  const eventRegion = normalizedComparisonValue(partA.region);

  if (nextStatus === 'Pending Head of Sales' && actorRole === 'Sales Team') {
    const headOfSalesUsers = await getActiveUsersByRole('Head of Sales');
    const creatorProfile = requestorUid ? await getUserProfile(requestorUid) : null;
    let recipients: string[] = [];

    if (creatorProfile) {
      const assignedHeadOfSales = normalizedComparisonValue(creatorProfile.headOfSales);
      recipients = headOfSalesUsers
        .filter(user =>
          assignedHeadOfSales &&
          (assignedHeadOfSales === normalizedComparisonValue(user.profile.name) ||
            assignedHeadOfSales === normalizedComparisonValue(user.uid))
        )
        .map(user => user.uid);
    } else {
      recipients = headOfSalesUsers
        .filter(user => {
          const region = normalizedComparisonValue(user.profile.region);
          return !region || region === 'all' || region === eventRegion;
        })
        .map(user => user.uid);
    }

    return {
      recipientUids: recipients,
      title: 'Roadshow request awaiting your review',
      body: `${requestCode} is waiting for your review.`
    };
  }

  if (
    nextStatus === 'Under Review' &&
    (actorRole === 'Head of Sales' || actorRole === 'Sales Team')
  ) {
    const deviceTeamUsers = await getActiveUsersByRole('Device Team');
    return {
      recipientUids: deviceTeamUsers.map(user => user.uid),
      title: 'Roadshow request waiting for Device Team',
      body: `${requestCode} is ready for device review.`
    };
  }

  if (nextStatus === 'Pending Head of Operation' && actorRole === 'Device Team') {
    const headOfOperationUsers = await getActiveUsersByRole('Head of Operation');
    const assignedName = normalizedComparisonValue(requestData.assignedHeadOfOperation) ||
      (Number(requestData.totalValueRM || 0) > 50000 ? 'noora mat rifin' : 'masila bt shamere');
    return {
      recipientUids: headOfOperationUsers
        .filter(user => normalizedComparisonValue(user.profile.name) === assignedName)
        .map(user => user.uid),
      title: 'Roadshow request awaiting final approval',
      body: `${requestCode} is waiting for your final review.`
    };
  }

  if (
    nextStatus === 'Rejected' &&
    ['Head of Sales', 'Device Team', 'Head of Operation'].includes(actorRole) &&
    requestorUid
  ) {
    return {
      recipientUids: [requestorUid],
      title: 'Roadshow request update',
      body: `${requestCode} was rejected. Open RDR to view the details.`
    };
  }

  if (nextStatus === 'Approved' && actorRole === 'Head of Operation' && requestorUid) {
    return {
      recipientUids: [requestorUid],
      title: 'Roadshow request approved',
      body: `${requestCode} has received final approval.`
    };
  }

  return null;
}

async function sendRequestStatusNotification(
  requestId: string,
  requestData: Record<string, unknown>,
  previousStatus: string,
  actorRole: string
): Promise<void> {
  const nextStatus = typeof requestData.status === 'string' ? requestData.status.trim() : '';
  if (!nextStatus || normalizedComparisonValue(nextStatus) === normalizedComparisonValue(previousStatus)) return;

  const plan = await resolvePushNotificationPlan(requestData, nextStatus, actorRole);
  if (!plan || plan.recipientUids.length === 0) return;

  const uniqueUids = [...new Set(plan.recipientUids)];
  const subscriptionSnapshots = await Promise.all(
    uniqueUids.map(uid => pushSubscriptionsCollection.where('uid', '==', uid).get())
  );
  const subscriptions = subscriptionSnapshots.flatMap(snapshot => snapshot.docs);
  const uniqueSubscriptions = new Map<string, (typeof subscriptions)[number]>();
  for (const document of subscriptions) {
    const token = document.get('token');
    if (typeof token === 'string' && token.trim()) uniqueSubscriptions.set(token, document);
  }

  const tokenEntries = [...uniqueSubscriptions.entries()];
  if (tokenEntries.length === 0) return;

  const appUrl = (process.env.RDR_PUBLIC_URL || 'https://roadshow-device-request-26.web.app')
    .replace(/\/+$/, '');
  const messageData = {
    title: plan.title,
    body: plan.body,
    requestId,
    url: `${appUrl}/`
  };

  for (let index = 0; index < tokenEntries.length; index += 500) {
    const chunk = tokenEntries.slice(index, index + 500);
    const result = await getMessaging().sendEachForMulticast({
      tokens: chunk.map(([token]) => token),
      data: messageData,
      webpush: {
        headers: { Urgency: 'high' }
      }
    });

    const invalidTokenDeletes: Promise<unknown>[] = [];
    result.responses.forEach((item, responseIndex) => {
      if (item.success) return;
      const code = item.error?.code || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        const [token] = chunk[responseIndex];
        invalidTokenDeletes.push(
          pushSubscriptionsCollection.doc(pushTokenDocumentId(token)).delete()
        );
      }
    });
    if (invalidTokenDeletes.length > 0) await Promise.all(invalidTokenDeletes);
  }
}

async function sendPushNotificationToUsers(
  recipientUids: string[],
  title: string,
  body: string,
  requestId: string,
  notificationId: string
): Promise<void> {
  const uniqueUids = [...new Set(recipientUids.filter(Boolean))];
  if (uniqueUids.length === 0) return;

  const subscriptionSnapshots = await Promise.all(
    uniqueUids.map(uid => pushSubscriptionsCollection.where('uid', '==', uid).get())
  );
  const subscriptions = subscriptionSnapshots.flatMap(snapshot => snapshot.docs);
  const uniqueSubscriptions = new Map<string, (typeof subscriptions)[number]>();
  for (const document of subscriptions) {
    const token = document.get('token');
    if (typeof token === 'string' && token.trim()) uniqueSubscriptions.set(token, document);
  }

  const tokenEntries = [...uniqueSubscriptions.entries()];
  if (tokenEntries.length === 0) return;

  const appUrl = (process.env.RDR_PUBLIC_URL || 'https://roadshow-device-request-26.web.app')
    .replace(/\/+$/, '');
  const messageData = {
    title,
    body,
    requestId,
    notificationId,
    url: `${appUrl}/`
  };

  for (let index = 0; index < tokenEntries.length; index += 500) {
    const chunk = tokenEntries.slice(index, index + 500);
    const result = await getMessaging().sendEachForMulticast({
      tokens: chunk.map(([token]) => token),
      data: messageData,
      webpush: { headers: { Urgency: 'high' } }
    });

    const invalidTokenDeletes: Promise<unknown>[] = [];
    result.responses.forEach((item, responseIndex) => {
      if (item.success) return;
      const code = item.error?.code || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        const [token] = chunk[responseIndex];
        invalidTokenDeletes.push(
          pushSubscriptionsCollection.doc(pushTokenDocumentId(token)).delete()
        );
      }
    });
    if (invalidTokenDeletes.length > 0) await Promise.all(invalidTokenDeletes);
  }
}

async function createImeiUploadNotification(
  requestId: string,
  requestData: Record<string, unknown>
): Promise<void> {
  const requestorUid = typeof requestData.createdByUserId === 'string'
    ? requestData.createdByUserId.trim()
    : '';
  if (!requestorUid) return;

  const requestCode = typeof requestData.requestCode === 'string' && requestData.requestCode.trim()
    ? requestData.requestCode.trim()
    : 'your roadshow request';
  const title = 'IMEIs uploaded for your request';
  const body = `The Device Team uploaded IMEIs for ${requestCode}. Open RDR to view the update.`;
  const createdAt = new Date().toISOString();
  const notificationRef = notificationsCollection.doc();

  await notificationRef.set({
    recipientUid: requestorUid,
    type: 'imei-upload',
    title,
    body,
    requestId,
    requestCode,
    createdAt,
    isRead: false
  });

  try {
    await sendPushNotificationToUsers(
      [requestorUid],
      title,
      body,
      requestId,
      notificationRef.id
    );
  } catch (error) {
    console.error('RDR IMEI upload push notification could not be sent:', error);
  }
}

function canUpdateRequest(
  profile: UserProfile,
  uid: string,
  requestData: Record<string, unknown>
): boolean {
  if (profile.role === 'Admin') {
    return true;
  }

  if (profile.role === 'Sales Team' && requestData.createdByUserId === uid) {
    const status = typeof requestData.status === 'string' ? requestData.status : '';
    const hasHeadOfSalesApproved = Boolean(requestData.headOfSalesApproval) ||
      ['Pending Sales Acceptance', 'Pending Head of Operation', 'Approved'].includes(status);
    return !hasHeadOfSalesApproved;
  }

  if (requestData.createdByUserId === uid) {
    return true;
  }

  const workflowRoles = [
    'Head of Sales',
    'Head of Unit',
    'Head of Department',
    'Device Team',
    'Head of Operation'
  ];

  return workflowRoles.includes(profile.role || '');
}

function canDeleteRequest(
  profile: UserProfile,
  uid: string,
  requestData: Record<string, unknown>
): boolean {
  if (profile.role === 'Admin') {
    return true;
  }

  if (profile.role === 'Sales Team' && requestData.createdByUserId === uid) {
    const status = typeof requestData.status === 'string' ? requestData.status : '';
    return !requestData.headOfSalesApproval && (status === 'Draft' || status === 'Rejected');
  }

  return requestData.createdByUserId === uid;
}

function canManageDeviceInventory(profile: UserProfile): boolean {
  return (
    profile.role === 'Admin' ||
    profile.role === 'Device Team'
  );
}

function canUpdateImeiInventory(profile: UserProfile): boolean {
  return (
    profile.role === 'Admin' ||
    profile.role === 'Device Team' ||
    profile.role === 'Sales Team'
  );
}

function normaliseImeiInventoryItem(
  item: Record<string, unknown>,
  updatedAt: string
): Record<string, unknown> | null {
  const imei =
    typeof item.imei === 'string'
      ? item.imei.trim()
      : '';

  const material =
    typeof item.material === 'string'
      ? item.material.trim()
      : '';

  const description =
    typeof item.description === 'string'
      ? item.description.trim()
      : '';

  const rrpRM = Number(item.rrpRM);

  const allowedStatuses = [
    'HOO Approved',
    'Pending Approval',
    'Unassigned Stock'
  ];

  const status =
    typeof item.status === 'string' &&
    allowedStatuses.includes(item.status)
      ? item.status
      : 'Unassigned Stock';

  if (
    !imei ||
    !material ||
    !description ||
    !Number.isFinite(rrpRM)
  ) {
    return null;
  }

  const {
    id: _ignoredId,
    updatedAt: _ignoredUpdatedAt,
    ...otherFields
  } = item;

  return {
    ...otherFields,
    imei,
    material,
    description,
    rrpRM,
    status,
    updatedAt
  };
}

function normalizeInventoryTextKey(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().toLowerCase();
}

function normalizeInventoryMobileKey(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  let normalized = String(value).replace(/[\s\-().]/g, '').trim();
  if (normalized.startsWith('+60')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('60') && normalized.length >= 10) {
    normalized = '0' + normalized.slice(2);
  }

  return normalized.toLowerCase();
}

function findDuplicateInventoryValues(
  values: unknown[],
  normalize: (value: unknown) => string
): string[] {
  const counts = new Map<string, { displayValue: string; count: number }>();

  for (const rawValue of values) {
    const key = normalize(rawValue);
    if (!key) continue;

    const displayValue = String(rawValue).trim();
    const existing = counts.get(key) || { displayValue, count: 0 };
    existing.count += 1;
    counts.set(key, existing);
  }

  return Array.from(counts.values())
    .filter(item => item.count > 1)
    .map(item => item.displayValue);
}

function findValuesAlreadyImported(
  incoming: unknown[],
  existing: unknown[],
  normalize: (value: unknown) => string
): string[] {
  const existingKeys = new Set(existing.map(normalize).filter(Boolean));
  const found = new Map<string, string>();

  for (const rawValue of incoming) {
    const key = normalize(rawValue);
    if (!key || !existingKeys.has(key) || found.has(key)) continue;
    found.set(key, String(rawValue).trim());
  }

  return Array.from(found.values());
}

/*
 * Public API information
 */
app.get(
  '/',
  (_request: Request, response: Response) => {
    response.json({
      service: 'Roadshow Device Request API',
      environment:
        process.env.NODE_ENV || 'development',
      status: 'running'
    });
  }
);

/*
 * Application health check
 */
app.get(
  '/health',
  (_request: Request, response: Response) => {
    response.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }
);

/*
 * Firestore connectivity health check
 */
app.get(
  '/health/firestore',
  async (
    _request: Request,
    response: Response
  ) => {
    try {
      await db.listCollections();

      response.status(200).json({
        status: 'healthy',
        firestore: 'connected'
      });
    } catch (error) {
      console.error(
        'Firestore health check failed:',
        error
      );

      response.status(500).json({
        status: 'unhealthy',
        firestore: 'disconnected'
      });
    }
  }
);

/*
 * Return the authenticated user's RDR profile
 */
app.get(
  '/api/auth/me',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid =
        request.authenticatedUser!.uid;

      const userDocument = await db
        .collection('users')
        .doc(uid)
        .get();

      if (!userDocument.exists) {
        response.status(403).json({
          message:
            'No Roadshow Device Request profile exists for this account.'
        });
        return;
      }

      const profile =
        userDocument.data() as UserProfile;

      if (!isUserActive(profile)) {
        response.status(403).json({
          message:
            'This Roadshow Device Request account is inactive.'
        });
        return;
      }

      response.status(200).json({
        id: userDocument.id,
        ...profile
      });
    } catch (error) {
      console.error(
        'Unable to retrieve user profile:',
        error
      );

      response.status(500).json({
        message:
          'Unable to retrieve the user profile.'
      });
    }
  }
);

/*
 * Register or remove a web push subscription for the authenticated user.
 * FCM tokens are stored server-side and are never accepted with a client-supplied UID.
 */
app.post(
  '/api/push-subscriptions',
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);
      if (!profile || !isUserActive(profile)) {
        response.status(403).json({ message: 'An active RDR user profile is required.' });
        return;
      }

      const token = typeof request.body?.token === 'string'
        ? request.body.token.trim()
        : '';
      if (token.length < 20 || token.length > 4096) {
        response.status(400).json({ message: 'A valid push token is required.' });
        return;
      }

      await pushSubscriptionsCollection.doc(pushTokenDocumentId(token)).set({
        uid,
        token,
        updatedAt: new Date().toISOString()
      });

      response.status(200).json({ message: 'This device is registered for RDR notifications.' });
    } catch (error) {
      console.error('Unable to register RDR push subscription:', error);
      response.status(500).json({ message: 'Unable to enable RDR notifications on this device.' });
    }
  }
);

app.delete(
  '/api/push-subscriptions',
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const token = typeof request.body?.token === 'string'
        ? request.body.token.trim()
        : '';
      if (!token) {
        response.status(400).json({ message: 'A push token is required.' });
        return;
      }

      const subscriptionRef = pushSubscriptionsCollection.doc(pushTokenDocumentId(token));
      const subscription = await subscriptionRef.get();
      if (subscription.exists && subscription.get('uid') === uid) {
        await subscriptionRef.delete();
      }

      response.status(200).json({ message: 'This device was removed from RDR notifications.' });
    } catch (error) {
      console.error('Unable to remove RDR push subscription:', error);
      response.status(500).json({ message: 'Unable to remove this device from RDR notifications.' });
    }
  }
);

app.get(
  '/api/notifications',
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);
      if (!profile || !isUserActive(profile)) {
        response.status(403).json({ message: 'An active RDR user profile is required.' });
        return;
      }

      const snapshot = await notificationsCollection
        .where('recipientUid', '==', uid)
        .limit(100)
        .get();
      const notificationDocuments = [...snapshot.docs]
        .sort((first, second) =>
          String(second.get('createdAt') || '').localeCompare(
            String(first.get('createdAt') || '')
          )
        )
        .slice(0, 50);
      const items = notificationDocuments.map(document => ({
        id: document.id,
        ...document.data()
      }));

      response.status(200).json({ items });
    } catch (error) {
      console.error('Unable to retrieve RDR notifications:', error);
      response.status(500).json({ message: 'Unable to retrieve your notifications.' });
    }
  }
);

app.post(
  '/api/notifications/read-all',
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);
      if (!profile || !isUserActive(profile)) {
        response.status(403).json({ message: 'An active RDR user profile is required.' });
        return;
      }

      const snapshot = await notificationsCollection
        .where('recipientUid', '==', uid)
        .limit(500)
        .get();
      const unreadDocuments = snapshot.docs.filter(document => document.get('isRead') !== true);
      if (unreadDocuments.length > 0) {
        const now = new Date().toISOString();
        const batch = db.batch();
        unreadDocuments.forEach(document => {
          batch.update(document.ref, { isRead: true, readAt: now });
        });
        await batch.commit();
      }

      response.status(200).json({ updatedCount: unreadDocuments.length });
    } catch (error) {
      console.error('Unable to mark RDR notifications as read:', error);
      response.status(500).json({ message: 'Unable to update your notifications.' });
    }
  }
);

app.post(
  '/api/notifications/:notificationId/read',
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);
      if (!profile || !isUserActive(profile)) {
        response.status(403).json({ message: 'An active RDR user profile is required.' });
        return;
      }

      const notificationId = getRouteParameter(request.params.notificationId);
      if (!notificationId) {
        response.status(400).json({ message: 'A notification ID is required.' });
        return;
      }

      const notificationRef = notificationsCollection.doc(notificationId);
      const notification = await notificationRef.get();
      if (!notification.exists || notification.get('recipientUid') !== uid) {
        response.status(404).json({ message: 'The notification was not found.' });
        return;
      }

      await notificationRef.update({
        isRead: true,
        readAt: new Date().toISOString()
      });
      response.status(200).json({ message: 'Notification marked as read.' });
    } catch (error) {
      console.error('Unable to mark RDR notification as read:', error);
      response.status(500).json({ message: 'Unable to update this notification.' });
    }
  }
);

// User directory and administrator onboarding endpoints.
app.use('/api/users', userRoutes);

/*
 * GET /api/requests
 *
 * Retrieve roadshow requests from Firestore.
 */
app.get(
  '/api/requests',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid =
        request.authenticatedUser!.uid;

      const profile =
        await getUserProfile(uid);

      if (!profile) {
        response.status(403).json({
          message:
            'No RDR user profile exists for this account.'
        });
        return;
      }

      if (!isUserActive(profile)) {
        response.status(403).json({
          message:
            'This RDR user account is inactive.'
        });
        return;
      }

      // Sales users may only retrieve requests they created.
      // Keep this restriction in the API so it cannot be bypassed
      // by calling the endpoint directly.
      const requestQuery =
        profile.role === 'Sales Team'
          ? requestsCollection.where(
              'createdByUserId',
              '==',
              uid
            )
          : requestsCollection;

      const snapshot =
        await requestQuery
          .limit(500)
          .get();

      const requests: FirestoreRequestRecord[] =
        snapshot.docs.map(document => ({
          id: document.id,
          ...document.data()
        }));

      requests.sort((first, second) => {
        const firstUpdatedAt =
          first.updatedAt;

        const secondUpdatedAt =
          second.updatedAt;

        const firstDate =
          typeof firstUpdatedAt === 'string'
            ? firstUpdatedAt
            : '';

        const secondDate =
          typeof secondUpdatedAt === 'string'
            ? secondUpdatedAt
            : '';

        return secondDate.localeCompare(firstDate);
      });

      response.status(200).json({
        requests
      });
    } catch (error) {
      console.error(
        'Unable to retrieve requests:',
        error
      );

      response.status(500).json({
        message:
          'Unable to retrieve roadshow requests.'
      });
    }
  }
);

/*
 * POST /api/requests
 *
 * Create a new roadshow request.
 * Only Sales Team and Admin users may create requests.
 */
app.post(
  '/api/requests',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid =
        request.authenticatedUser!.uid;

      const profile =
        await getUserProfile(uid);

      if (!profile) {
        response.status(403).json({
          message:
            'No RDR user profile exists for this account.'
        });
        return;
      }

      if (!isUserActive(profile)) {
        response.status(403).json({
          message:
            'This RDR user account is inactive.'
        });
        return;
      }

      if (
        profile.role !== 'Sales Team' &&
        profile.role !== 'Admin'
      ) {
        response.status(403).json({
          message:
            'Only Sales Team and Admin users may create requests.'
        });
        return;
      }

      if (!isRequestBodyValid(request.body)) {
        response.status(400).json({
          message:
            'A valid request body is required.'
        });
        return;
      }

      const now = new Date().toISOString();
      const requestCode = await allocateRequestCode();

      /*
       * The frontend is not allowed to decide
       * the authenticated creator.
       */
      const {
        id: _ignoredId,
        requestCode: _ignoredRequestCode,
        createdByUserId:
          _ignoredCreatorId,
        createdByName:
          _ignoredCreatorName,
        createdAt:
          _ignoredCreatedAt,
        updatedAt:
          _ignoredUpdatedAt,
        ...submittedData
      } = request.body;

      const requestDocument =
        requestsCollection.doc();

      const newRequest = {
        ...submittedData,
        requestCode,
        createdByUserId: uid,
        createdByName:
          profile.name ||
          request.authenticatedUser!.email ||
          'Unknown User',
        createdAt: now,
        updatedAt: now
      };

      await requestDocument.set(newRequest);
      await sendRequestStatusNotification(
        requestDocument.id,
        newRequest,
        '',
        profile.role || ''
      ).catch(error => console.error('RDR push notification could not be sent:', error));

      response.status(201).json({
        request: {
          id: requestDocument.id,
          ...newRequest
        }
      });
    } catch (error) {
      console.error(
        'Unable to create request:',
        error
      );

      response.status(500).json({
        message:
          'Unable to create the roadshow request.'
      });
    }
  }
);

/*
 * PUT /api/requests/:requestId
 *
 * Replace/update an existing roadshow request.
 */
app.put(
  '/api/requests/:requestId',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid =
        request.authenticatedUser!.uid;

      const profile =
        await getUserProfile(uid);

      if (!profile) {
        response.status(403).json({
          message:
            'No RDR user profile exists for this account.'
        });
        return;
      }

      if (!isUserActive(profile)) {
        response.status(403).json({
          message:
            'This RDR user account is inactive.'
        });
        return;
      }

      if (!isRequestBodyValid(request.body)) {
        response.status(400).json({
          message:
            'A valid request body is required.'
        });
        return;
      }

      const requestId = getRouteParameter(
        request.params.requestId
      );

      if (!requestId) {
        response.status(400).json({
          message:
            'A request ID is required.'
        });
        return;
      }

      const requestDocument =
        requestsCollection.doc(requestId);

      const existingDocument =
        await requestDocument.get();

      if (!existingDocument.exists) {
        response.status(404).json({
          message:
            'The requested roadshow request was not found.'
        });
        return;
      }

      const existingData =
        existingDocument.data() as Record<
          string,
          unknown
        >;

      if (
        !canUpdateRequest(
          profile,
          uid,
          existingData
        )
      ) {
        response.status(403).json({
          message:
            'You do not have permission to update this request.'
        });
        return;
      }

      // A Sales request creator may edit their request, but cannot
      // approve it by writing a status directly through this endpoint.
      if (
        profile.role === 'Sales Team' &&
        existingData.createdByUserId === uid &&
        request.body.status === 'Approved' &&
        existingData.status !== 'Approved'
      ) {
        response.status(403).json({
          message:
            'Request creators cannot approve their own requests.'
        });
        return;
      }

      const {
        id: _ignoredId,
        createdByUserId:
          _ignoredCreatorId,
        createdByName:
          _ignoredCreatorName,
        createdAt:
          _ignoredCreatedAt,
        updatedAt:
          _ignoredUpdatedAt,
        ...submittedData
      } = request.body;

      const updatedRequest = {
        ...submittedData,
        createdByUserId:
          existingData.createdByUserId,
        createdByName:
          existingData.createdByName,
        createdAt:
          existingData.createdAt,
        updatedAt:
          new Date().toISOString()
      };

      await requestDocument.set(
        updatedRequest
      );
      await sendRequestStatusNotification(
        requestDocument.id,
        updatedRequest,
        String(existingData.status || ''),
        profile.role || ''
      ).catch(error => console.error('RDR push notification could not be sent:', error));

      response.status(200).json({
        request: {
          id: requestDocument.id,
          ...updatedRequest
        }
      });
    } catch (error) {
      console.error(
        'Unable to update request:',
        error
      );

      response.status(500).json({
        message:
          'Unable to update the roadshow request.'
      });
    }
  }
);

/*
 * DELETE /api/requests/:requestId
 *
 * Only Admin or the original creator may delete a request.
 */
app.delete(
  '/api/requests/:requestId',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid =
        request.authenticatedUser!.uid;

      const profile =
        await getUserProfile(uid);

      if (!profile) {
        response.status(403).json({
          message:
            'No RDR user profile exists for this account.'
        });
        return;
      }

      if (!isUserActive(profile)) {
        response.status(403).json({
          message:
            'This RDR user account is inactive.'
        });
        return;
      }

      const requestId = getRouteParameter(
        request.params.requestId
      );

      if (!requestId) {
        response.status(400).json({
          message:
            'A request ID is required.'
        });
        return;
      }

      const requestDocument =
        requestsCollection.doc(requestId);

      const existingDocument =
        await requestDocument.get();

      if (!existingDocument.exists) {
        response.status(404).json({
          message:
            'The requested roadshow request was not found.'
        });
        return;
      }

      const existingData =
        existingDocument.data() as Record<
          string,
          unknown
        >;

      if (
        !canDeleteRequest(
          profile,
          uid,
          existingData
        )
      ) {
        response.status(403).json({
          message:
            'You do not have permission to delete this request.'
        });
        return;
      }

      await requestDocument.delete();

      response.status(200).json({
        message:
          'Roadshow request deleted successfully.',
        id: requestId
      });
    } catch (error) {
      console.error(
        'Unable to delete request:',
        error
      );

      response.status(500).json({
        message:
          'Unable to delete the roadshow request.'
      });
    }
  }
);

/*
 * GET /api/device-inventory
 *
 * Return the device catalogue to any active authenticated RDR user.
 */
app.get(
  '/api/device-inventory',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);

      if (!profile || !isUserActive(profile)) {
        response.status(403).json({
          message: 'An active RDR user profile is required.'
        });
        return;
      }

      const snapshot = await deviceInventoryCollection
        .limit(500)
        .get();

      const items = snapshot.docs
       .map<FirestoreRequestRecord>(document => ({
         id: document.id,
        ...document.data()
       }))
        .sort((first, second) => {
          const firstDescription =
            typeof first.description === 'string'
              ? first.description
              : '';

          const secondDescription =
            typeof second.description === 'string'
              ? second.description
              : '';

          return firstDescription.localeCompare(secondDescription);
        });

      response.status(200).json({ items });
    } catch (error) {
      console.error('Unable to retrieve device inventory:', error);

      response.status(500).json({
        message: 'Unable to retrieve the device inventory.'
      });
    }
  }
);

/*
 * POST /api/device-inventory/import
 *
 * Import device inventory in append or replacement mode.
 */
app.post(
  '/api/device-inventory/import',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);

      if (!profile || !isUserActive(profile)) {
        response.status(403).json({
          message: 'An active RDR user profile is required.'
        });
        return;
      }

      if (!canManageDeviceInventory(profile)) {
        response.status(403).json({
          message:
            'Only Device Team and Admin users may import device inventory.'
        });
        return;
      }

      if (
        !isRequestBodyValid(request.body) ||
        !Array.isArray(request.body.items)
      ) {
        response.status(400).json({
          message: 'A device inventory items array is required.'
        });
        return;
      }

      const submittedItems = request.body.items;
      const appendMode = request.body.appendMode === true;

      if (submittedItems.length === 0) {
        response.status(400).json({
          message: 'There are no device inventory items to import.'
        });
        return;
      }

      if (submittedItems.length > 500) {
        response.status(400).json({
          message: 'A maximum of 500 inventory items may be imported at once.'
        });
        return;
      }

      const now = new Date().toISOString();
      const validItems: Array<{
        documentId: string;
        data: Record<string, unknown>;
      }> = [];

      for (const submittedItem of submittedItems) {
        if (!isRequestBodyValid(submittedItem)) {
          continue;
        }

        const material =
          typeof submittedItem.material === 'string'
            ? submittedItem.material.trim()
            : '';

        const description =
          typeof submittedItem.description === 'string'
            ? submittedItem.description.trim()
            : '';

        const rrpRM = Number(submittedItem.rrpRM);

        if (!material || !description || !Number.isFinite(rrpRM)) {
          continue;
        }

        const submittedId =
          typeof submittedItem.id === 'string'
            ? submittedItem.id.trim()
            : '';

        const documentId =
          submittedId && !submittedId.includes('/')
            ? submittedId
            : deviceInventoryCollection.doc().id;

        const {
          id: _ignoredId,
          updatedAt: _ignoredUpdatedAt,
          ...otherFields
        } = submittedItem;

        validItems.push({
          documentId,
          data: {
            ...otherFields,
            material,
            description,
            rrpRM,
            updatedAt: now
          }
        });
      }

      if (validItems.length === 0) {
        response.status(400).json({
          message: 'No valid device inventory items were supplied.'
        });
        return;
      }

      if (!appendMode) {
        const existingSnapshot = await deviceInventoryCollection
          .limit(500)
          .get();

        if (!existingSnapshot.empty) {
          const deleteBatch = db.batch();

          existingSnapshot.docs.forEach(document => {
            deleteBatch.delete(document.ref);
          });

          await deleteBatch.commit();
        }
      }

      const importBatch = db.batch();

      validItems.forEach(item => {
        importBatch.set(
          deviceInventoryCollection.doc(item.documentId),
          item.data
        );
      });

      await importBatch.commit();

      response.status(201).json({
        message: 'Device inventory imported successfully.',
        importedCount: validItems.length,
        items: validItems.map(item => ({
          id: item.documentId,
          ...item.data
        }))
      });
    } catch (error) {
      console.error('Unable to import device inventory:', error);

      response.status(500).json({
        message: 'Unable to import the device inventory.'
      });
    }
  }
);

/*
 * PUT /api/device-inventory/:itemId
 */
app.put(
  '/api/device-inventory/:itemId',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);

      if (!profile || !isUserActive(profile)) {
        response.status(403).json({
          message: 'An active RDR user profile is required.'
        });
        return;
      }

      if (!canManageDeviceInventory(profile)) {
        response.status(403).json({
          message:
            'Only Device Team and Admin users may update device inventory.'
        });
        return;
      }

      if (!isRequestBodyValid(request.body)) {
        response.status(400).json({
          message: 'A valid inventory item is required.'
        });
        return;
      }

      const itemId = getRouteParameter(request.params.itemId);

      if (!itemId) {
        response.status(400).json({
          message: 'A device inventory item ID is required.'
        });
        return;
      }

      const itemDocument = deviceInventoryCollection.doc(itemId);
      const existingDocument = await itemDocument.get();

      if (!existingDocument.exists) {
        response.status(404).json({
          message: 'The device inventory item was not found.'
        });
        return;
      }

      const material =
        typeof request.body.material === 'string'
          ? request.body.material.trim()
          : '';

      const description =
        typeof request.body.description === 'string'
          ? request.body.description.trim()
          : '';

      const rrpRM = Number(request.body.rrpRM);

      if (!material || !description || !Number.isFinite(rrpRM)) {
        response.status(400).json({
          message:
            'Material, description, and a valid RRP are required.'
        });
        return;
      }

      const {
        id: _ignoredId,
        updatedAt: _ignoredUpdatedAt,
        ...otherFields
      } = request.body;

      const updatedItem = {
        ...otherFields,
        material,
        description,
        rrpRM,
        updatedAt: new Date().toISOString()
      };

      await itemDocument.set(updatedItem);

      response.status(200).json({
        item: {
          id: itemDocument.id,
          ...updatedItem
        }
      });
    } catch (error) {
      console.error('Unable to update device inventory:', error);

      response.status(500).json({
        message: 'Unable to update the device inventory item.'
      });
    }
  }
);

/*
 * DELETE /api/device-inventory/:itemId
 */
app.delete(
  '/api/device-inventory/:itemId',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);

      if (!profile || !isUserActive(profile)) {
        response.status(403).json({
          message: 'An active RDR user profile is required.'
        });
        return;
      }

      if (!canManageDeviceInventory(profile)) {
        response.status(403).json({
          message:
            'Only Device Team and Admin users may delete device inventory.'
        });
        return;
      }

      const itemId = getRouteParameter(request.params.itemId);

      if (!itemId) {
        response.status(400).json({
          message: 'A device inventory item ID is required.'
        });
        return;
      }

      const itemDocument = deviceInventoryCollection.doc(itemId);
      const existingDocument = await itemDocument.get();

      if (!existingDocument.exists) {
        response.status(404).json({
          message: 'The device inventory item was not found.'
        });
        return;
      }

      await itemDocument.delete();

      response.status(200).json({
        message: 'Device inventory item deleted successfully.',
        id: itemId
      });
    } catch (error) {
      console.error('Unable to delete device inventory:', error);

      response.status(500).json({
        message: 'Unable to delete the device inventory item.'
      });
    }
  }
);

/*
 * GET /api/imei-inventory
 */
app.get(
  '/api/imei-inventory',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);

      if (!profile || !isUserActive(profile)) {
        response.status(403).json({
          message: 'An active RDR user profile is required.'
        });
        return;
      }

      const snapshot = await imeiInventoryCollection
        .limit(500)
        .get();

      const items = snapshot.docs
        .map<FirestoreRequestRecord>(document => ({
          id: document.id,
          ...document.data()
        }))
        .sort((first, second) => {
          const firstUpdatedAt =
            typeof first.updatedAt === 'string'
              ? first.updatedAt
              : '';

          const secondUpdatedAt =
            typeof second.updatedAt === 'string'
              ? second.updatedAt
              : '';

          return secondUpdatedAt.localeCompare(firstUpdatedAt);
        });

      response.status(200).json({ items });
    } catch (error) {
      console.error('Unable to retrieve IMEI inventory:', error);

      response.status(500).json({
        message: 'Unable to retrieve the IMEI inventory.'
      });
    }
  }
);

/*
 * POST /api/imei-inventory/import
 */
app.post(
  '/api/imei-inventory/import',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);

      if (!profile || !isUserActive(profile)) {
        response.status(403).json({
          message: 'An active RDR user profile is required.'
        });
        return;
      }

      if (!canManageDeviceInventory(profile)) {
        response.status(403).json({
          message:
            'Only Device Team and Admin users may import IMEI inventory.'
        });
        return;
      }

      if (
        !isRequestBodyValid(request.body) ||
        !Array.isArray(request.body.items)
      ) {
        response.status(400).json({
          message: 'An IMEI inventory items array is required.'
        });
        return;
      }

      const submittedItems = request.body.items;
      const appendMode = request.body.appendMode === true;

      if (submittedItems.length === 0) {
        response.status(400).json({
          message: 'There are no IMEI inventory items to import.'
        });
        return;
      }

      if (submittedItems.length > 500) {
        response.status(400).json({
          message:
            'A maximum of 500 IMEI inventory items may be imported at once.'
        });
        return;
      }

      const submittedItemRecords = submittedItems.filter(isRequestBodyValid);
      const now = new Date().toISOString();
      const validItems: Array<{
        documentId: string;
        data: Record<string, unknown>;
      }> = [];

      for (const submittedItem of submittedItemRecords) {

        const data = normaliseImeiInventoryItem(
          submittedItem,
          now
        );

        if (!data) {
          continue;
        }

        const submittedId =
          typeof submittedItem.id === 'string'
            ? submittedItem.id.trim()
            : '';

        const documentId =
          submittedId && !submittedId.includes('/')
            ? submittedId
            : imeiInventoryCollection.doc().id;

        validItems.push({ documentId, data });
      }

      if (validItems.length === 0) {
        response.status(400).json({
          message: 'No valid IMEI inventory items were supplied.'
        });
        return;
      }

      // Validate the full submitted batch before writing or deleting any rows.
      const batchDuplicateMessages: string[] = [];
      const duplicateImeiValues = findDuplicateInventoryValues(
        submittedItemRecords.map(item => item.imei),
        normalizeInventoryTextKey
      );
      const duplicateSppValues = findDuplicateInventoryValues(
        submittedItemRecords.map(item => item.sppOrder),
        normalizeInventoryTextKey
      );
      const duplicateMobileValues = findDuplicateInventoryValues(
        submittedItemRecords.map(item => item.mobileNumber),
        normalizeInventoryMobileKey
      );

      const formatDuplicateValues = (values: string[]) =>
        values.slice(0, 3).map(value => `"${value}"`).join(', ') +
        (values.length > 3 ? ` and ${values.length - 3} more` : '');

      if (duplicateImeiValues.length > 0) {
        batchDuplicateMessages.push(
          `Duplicate Device IMEI No in uploaded file: ${formatDuplicateValues(duplicateImeiValues)}.`
        );
      }
      if (duplicateSppValues.length > 0) {
        batchDuplicateMessages.push(
          `Duplicate SPP Order No in uploaded file: ${formatDuplicateValues(duplicateSppValues)}.`
        );
      }
      if (duplicateMobileValues.length > 0) {
        batchDuplicateMessages.push(
          `Duplicate Mobile Number in uploaded file: ${formatDuplicateValues(duplicateMobileValues)}.`
        );
      }

      if (batchDuplicateMessages.length > 0) {
        response.status(409).json({
          message: batchDuplicateMessages.join(' '),
          importedCount: 0
        });
        return;
      }

      // Existing IMEIs may be recycled; only SPP order and mobile number
      // duplicates are rejected against records already stored.
      if (appendMode) {
        const existingSnapshot = await imeiInventoryCollection
          .limit(500)
          .get();
        const existingItems = existingSnapshot.docs.map(document =>
          document.data() as Record<string, unknown>
        );
        const existingDuplicateMessages: string[] = [];

        const existingSppValues = findValuesAlreadyImported(
          validItems.map(item => item.data.sppOrder),
          existingItems.map(item => item.sppOrder),
          normalizeInventoryTextKey
        );
        const existingMobileValues = findValuesAlreadyImported(
          validItems.map(item => item.data.mobileNumber),
          existingItems.map(item => item.mobileNumber),
          normalizeInventoryMobileKey
        );

        if (existingSppValues.length > 0) {
          existingDuplicateMessages.push(
            `SPP Order No already exists in IMEI Inventory: ${formatDuplicateValues(existingSppValues)}.`
          );
        }
        if (existingMobileValues.length > 0) {
          existingDuplicateMessages.push(
            `Mobile Number already exists in IMEI Inventory: ${formatDuplicateValues(existingMobileValues)}.`
          );
        }

        if (existingDuplicateMessages.length > 0) {
          response.status(409).json({
            message: existingDuplicateMessages.join(' '),
            importedCount: 0
          });
          return;
        }
      }

      if (!appendMode) {
        const existingSnapshot = await imeiInventoryCollection
          .limit(500)
          .get();

        if (!existingSnapshot.empty) {
          const deleteBatch = db.batch();

          existingSnapshot.docs.forEach(document => {
            deleteBatch.delete(document.ref);
          });

          await deleteBatch.commit();
        }
      }

      const importBatch = db.batch();

      validItems.forEach(item => {
        importBatch.set(
          imeiInventoryCollection.doc(item.documentId),
          item.data
        );
      });

      await importBatch.commit();

      if (profile.role === 'Device Team') {
        const requestIds = [...new Set(
          validItems
            .map(item => typeof item.data.requestId === 'string' ? item.data.requestId.trim() : '')
            .filter(Boolean)
        )];

        await Promise.all(requestIds.map(async requestId => {
          const requestDocument = await requestsCollection.doc(requestId).get();
          if (!requestDocument.exists) return;
          try {
            await createImeiUploadNotification(
              requestId,
              requestDocument.data() as Record<string, unknown>
            );
          } catch (error) {
            console.error('RDR in-app IMEI upload notification could not be saved:', error);
          }
        }));
      }

      response.status(201).json({
        message: 'IMEI inventory imported successfully.',
        importedCount: validItems.length,
        items: validItems.map(item => ({
          id: item.documentId,
          ...item.data
        }))
      });
    } catch (error) {
      console.error('Unable to import IMEI inventory:', error);

      response.status(500).json({
        message: 'Unable to import the IMEI inventory.'
      });
    }
  }
);

/*
 * PUT /api/imei-inventory/:itemId
 */
app.put(
  '/api/imei-inventory/:itemId',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);

      if (!profile || !isUserActive(profile)) {
        response.status(403).json({
          message: 'An active RDR user profile is required.'
        });
        return;
      }

      if (!canUpdateImeiInventory(profile)) {
        response.status(403).json({
          message:
            'You do not have permission to update IMEI inventory.'
        });
        return;
      }

      if (!isRequestBodyValid(request.body)) {
        response.status(400).json({
          message: 'A valid IMEI inventory item is required.'
        });
        return;
      }

      const itemId = getRouteParameter(request.params.itemId);

      if (!itemId) {
        response.status(400).json({
          message: 'An IMEI inventory item ID is required.'
        });
        return;
      }

      const itemDocument = imeiInventoryCollection.doc(itemId);
      const existingDocument = await itemDocument.get();

      if (!existingDocument.exists) {
        response.status(404).json({
          message: 'The IMEI inventory item was not found.'
        });
        return;
      }

      const updatedItem = normaliseImeiInventoryItem(
        request.body,
        new Date().toISOString()
      );

      if (!updatedItem) {
        response.status(400).json({
          message:
            'IMEI, material, description, and a valid RRP are required.'
        });
        return;
      }

      await itemDocument.set(updatedItem);

      response.status(200).json({
        item: {
          id: itemDocument.id,
          ...updatedItem
        }
      });
    } catch (error) {
      console.error('Unable to update IMEI inventory:', error);

      response.status(500).json({
        message: 'Unable to update the IMEI inventory item.'
      });
    }
  }
);

/*
 * DELETE /api/imei-inventory/:itemId
 */
app.delete(
  '/api/imei-inventory/:itemId',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid = request.authenticatedUser!.uid;
      const profile = await getUserProfile(uid);

      if (!profile || !isUserActive(profile)) {
        response.status(403).json({
          message: 'An active RDR user profile is required.'
        });
        return;
      }

      if (!canManageDeviceInventory(profile)) {
        response.status(403).json({
          message:
            'Only Device Team and Admin users may delete IMEI inventory.'
        });
        return;
      }

      const itemId = getRouteParameter(request.params.itemId);

      if (!itemId) {
        response.status(400).json({
          message: 'An IMEI inventory item ID is required.'
        });
        return;
      }

      const itemDocument = imeiInventoryCollection.doc(itemId);
      const existingDocument = await itemDocument.get();

      if (!existingDocument.exists) {
        response.status(404).json({
          message: 'The IMEI inventory item was not found.'
        });
        return;
      }

      await itemDocument.delete();

      response.status(200).json({
        message: 'IMEI inventory item deleted successfully.',
        id: itemId
      });
    } catch (error) {
      console.error('Unable to delete IMEI inventory:', error);

      response.status(500).json({
        message: 'Unable to delete the IMEI inventory item.'
      });
    }
  }
);

/*
 * POST /api/admin/migrations/requests
 *
 * One-time migration of the existing prototype requests.
 * Only an active Admin may perform this migration.
 * Migration is blocked when the Firestore collection is not empty.
 */
app.post(
  '/api/admin/migrations/requests',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid =
        request.authenticatedUser!.uid;

      const profile =
        await getUserProfile(uid);

      if (!profile) {
        response.status(403).json({
          message:
            'No RDR user profile exists for this account.'
        });
        return;
      }

      if (!isUserActive(profile)) {
        response.status(403).json({
          message:
            'This RDR user account is inactive.'
        });
        return;
      }

      if (profile.role !== 'Admin') {
        response.status(403).json({
          message:
            'Only an Admin may migrate request data.'
        });
        return;
      }

      if (
        !isRequestBodyValid(request.body) ||
        !Array.isArray(request.body.requests)
      ) {
        response.status(400).json({
          message:
            'A requests array is required.'
        });
        return;
      }

      const submittedRequests =
        request.body.requests;

      if (submittedRequests.length === 0) {
        response.status(400).json({
          message:
            'There are no requests to migrate.'
        });
        return;
      }

      if (submittedRequests.length > 500) {
        response.status(400).json({
          message:
            'A maximum of 500 requests may be migrated at once.'
        });
        return;
      }

      const existingSnapshot =
        await requestsCollection.limit(1).get();

      if (!existingSnapshot.empty) {
        response.status(409).json({
          message:
            'Migration stopped because the Firestore requests collection is not empty.'
        });
        return;
      }

      const batch = db.batch();
      const migrationTime =
        new Date().toISOString();

      let migratedCount = 0;

      for (const submittedRequest of submittedRequests) {
        if (!isRequestBodyValid(submittedRequest)) {
          continue;
        }

        const {
          id,
          ...requestData
        } = submittedRequest;

        const requestedDocumentId =
          typeof id === 'string'
            ? id.trim()
            : '';

        const hasValidDocumentId =
          requestedDocumentId.length > 0 &&
          !requestedDocumentId.includes('/');

        const requestDocument =
          hasValidDocumentId
            ? requestsCollection.doc(
                requestedDocumentId
              )
            : requestsCollection.doc();

        batch.set(requestDocument, {
          ...requestData,
          migratedAt: migrationTime,
          updatedAt:
            typeof requestData.updatedAt ===
            'string'
              ? requestData.updatedAt
              : migrationTime,
          createdAt:
            typeof requestData.createdAt ===
            'string'
              ? requestData.createdAt
              : migrationTime
        });

        migratedCount += 1;
      }

      if (migratedCount === 0) {
        response.status(400).json({
          message:
            'No valid roadshow requests were supplied.'
        });
        return;
      }

      await batch.commit();

      response.status(201).json({
        message:
          'Prototype requests migrated to Firestore successfully.',
        migratedCount
      });
    } catch (error) {
      console.error(
        'Unable to migrate requests:',
        error
      );

      response.status(500).json({
        message:
          'Unable to migrate prototype requests to Firestore.'
      });
    }
  }
);

/*
 * Handle unknown API routes
 */
app.use(
  '/api',
  (_request: Request, response: Response) => {
    response.status(404).json({
      message: 'API endpoint not found.'
    });
  }
);

/*
 * Start the API server
 */
app.listen(port, '0.0.0.0', () => {
  console.log(
    `RDR API listening on port ${port}`
  );
});
