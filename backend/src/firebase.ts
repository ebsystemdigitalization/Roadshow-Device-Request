import {
  applicationDefault,
  getApps,
  initializeApp
} from 'firebase-admin/app';

import { getFirestore } from 'firebase-admin/firestore';

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: applicationDefault(),
        projectId:
          process.env.GOOGLE_CLOUD_PROJECT ||
          'roadshow-device-request-26'
      });

export const db = getFirestore(firebaseApp);