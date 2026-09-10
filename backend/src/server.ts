import express, {
  type Request,
  type Response
} from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { db } from './firebase.js';
import { requireAuth } from './middleware/auth.js';

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

function canUpdateRequest(
  profile: UserProfile,
  uid: string,
  requestData: Record<string, unknown>
): boolean {
  if (profile.role === 'Admin') {
    return true;
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

  return requestData.createdByUserId === uid;
}

function canManageDeviceInventory(profile: UserProfile): boolean {
  return (
    profile.role === 'Admin' ||
    profile.role === 'Device Team'
  );
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
 * GET /api/users
 *
 * Return the active RDR user directory used for workflow routing.
 * Authentication is required. Only approved, non-sensitive fields are
 * returned to the frontend.
 */
app.get(
  '/api/users',
  requireAuth,
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const uid =
        request.authenticatedUser!.uid;

      const requestingProfile =
        await getUserProfile(uid);

      if (!requestingProfile) {
        response.status(403).json({
          message:
            'No RDR user profile exists for this account.'
        });
        return;
      }

      if (!isUserActive(requestingProfile)) {
        response.status(403).json({
          message:
            'This RDR user account is inactive.'
        });
        return;
      }

      const snapshot = await usersCollection
        .limit(500)
        .get();

      const users = snapshot.docs
        .map(document => {
          const profile =
            document.data() as UserProfile;

          return {
            id: document.id,
            name: profile.name || '',
            email: profile.email || '',
            role: profile.role || '',
            state: profile.state || '',
            region: profile.region || '',
            avatarUrl: profile.avatarUrl,
            headOfUnit: profile.headOfUnit,
            headOfSales: profile.headOfSales,
            headOfDepartment:
              profile.headOfDepartment,
            userStatus:
              profile.userStatus ||
              profile.status ||
              'Active',
            status: profile.status
          };
        })
        .filter(user => user.userStatus !== 'Inactive')
        .sort((first, second) =>
          first.name.localeCompare(second.name)
        );

      response.status(200).json({
        users
      });
    } catch (error) {
      console.error(
        'Unable to retrieve users:',
        error
      );

      response.status(500).json({
        message:
          'Unable to retrieve the RDR user directory.'
      });
    }
  }
);

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

      const snapshot =
        await requestsCollection
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

      /*
       * The frontend is not allowed to decide
       * the authenticated creator.
       */
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

      const requestDocument =
        requestsCollection.doc();

      const newRequest = {
        ...submittedData,
        createdByUserId: uid,
        createdByName:
          profile.name ||
          request.authenticatedUser!.email ||
          'Unknown User',
        createdAt: now,
        updatedAt: now
      };

      await requestDocument.set(newRequest);

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
