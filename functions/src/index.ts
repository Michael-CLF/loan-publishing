// functions/src/index.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const getUserByEmail = onCall(async (request) => {
  // Check if user is authenticated
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated to use this function'
    );
  }

  try {
    // Type check the email from the request data
    const email = request.data.email;
    if (!email || typeof email !== 'string') {
      throw new HttpsError(
        'invalid-argument',
        'Email must be provided as a string'
      );
    }

    // Use the Admin SDK to get user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Return only the data you want client-side
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      // Add other fields you need
    };
  } catch (error: unknown) {
    // TypeScript requires explicit type checking for unknown errors
    if (error instanceof Error) {
      throw new HttpsError('internal', error.message);
    } else {
      throw new HttpsError('internal', 'An unknown error occurred');
    }
  }
});
