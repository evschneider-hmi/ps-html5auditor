import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

// Firebase configuration
// PASTE YOUR CONFIG HERE (replace the placeholder values below)
const firebaseConfig = {
  apiKey: "AIzaSyCfOXQoz2RGI1D-4sFgfiiDRTg8BXPVGxs",
  authDomain: "creative-suite-auditor.firebaseapp.com",
  projectId: "creative-suite-auditor",
  storageBucket: "creative-suite-auditor.firebasestorage.app",
  messagingSenderId: "997189244229",
  appId: "1:997189244229:web:5f8af64802871e970c5a2c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Session structure
interface CloudSession {
  id: string;
  uploads: any[]; // Simplified uploads (no binary data)
  selectedUploadId: string | null;
  activeTab: 'creatives' | 'tags' | null;
  viewMode: 'list' | 'grid';
  sortConfig: { field: string; direction: 'asc' | 'desc' };
  createdAt: any; // Firestore Timestamp
  expiresAt: string; // ISO date string
}

// Generate unique session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Simplify upload data (remove binary content and non-serializable data)
function simplifyUpload(upload: any) {
  // Remove binary data, File objects, Uint8Array buffers, etc.
  const simplified: any = {
    id: upload.id,
    name: upload.name,
    type: upload.type,
    subtype: upload.subtype,
    status: upload.status,
    uploadedAt: upload.uploadedAt,
    timestamp: upload.timestamp,
    findings: upload.findings || [],
    creativeMetadata: upload.creativeMetadata,
    tagType: upload.tagType,
  };

    // Preserve bundle metadata with stub values for excluded properties
  if (upload.bundle) {
    const { file, bytes, files, ...bundleMeta } = upload.bundle;
    simplified.bundle = {
      ...bundleMeta,
      // Add stub values for properties that components may expect
      bytes: new Uint8Array(0), // Empty array instead of undefined
      files: {},                 // Empty object instead of undefined
      file: null,                // Explicitly null
    };
  } else {
    // If no bundle, create minimal stub
    simplified.bundle = {
      id: upload.id,
      name: upload.name || 'Unknown',
      bytes: new Uint8Array(0),
      files: {},
      file: null,
      lowerCaseIndex: {},
    };
  }

  // Simplify bundleResult if it exists
  if (upload.bundleResult) {
    const { content, rawFiles, ...rest } = upload.bundleResult;
    simplified.bundleResult = {
      ...rest,
      content: null, // Explicitly null instead of undefined
      rawFiles: [],  // Empty array instead of undefined
      files: upload.bundleResult.files ? upload.bundleResult.files.map((f: any) => {
        const { buffer, content, ...fileRest } = f;
        return {
          name: f.name,
          path: f.path,
          size: f.size,
          gzipSize: f.gzipSize,
          buffer: null,  // Stub for buffer
          content: null, // Stub for content
          ...fileRest,   // Include other safe fields
        };
      }) : [],
    };
  } else {
    // If no bundleResult, create minimal stub
    simplified.bundleResult = {
      bundleId: upload.id,
      bundleName: upload.name || 'Unknown',
      primary: undefined,
      adSize: { width: 0, height: 0 },
      findings: [],
      references: [],
      content: null,
      rawFiles: [],
      files: [],
      summary: {
        status: 'PASS',
        totalFindings: 0,
        fails: 0,
        warns: 0,
        pass: 0,
        orphanCount: 0,
        missingAssetCount: 0,
      },
    };
  }

  // Simplify tagResult if it exists (tags have much less data)
  if (upload.tagResult) {
    const { rawFile, content, ...rest } = upload.tagResult;
    simplified.tagResult = rest;
  }

  return simplified;
}

// Helper function to remove undefined values from objects
function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item));
  } else if (obj && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned;
  }
  return obj;
}

// Save session to Firestore
export async function saveSessionToCloud(
  uploads: any[],
  selectedUploadId: string | null,
  activeTab: 'creatives' | 'tags' | null,
  viewMode: 'list' | 'grid',
  sortConfig: { field: string; direction: 'asc' | 'desc' }
): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  const sessionData: CloudSession = {
    id: sessionId,
    uploads: uploads.map(simplifyUpload),
    selectedUploadId,
    activeTab,
    viewMode,
    sortConfig,
    createdAt: Timestamp.now(),
    expiresAt: expiresAt.toISOString()
  };

  // Remove all undefined values before saving
  const cleanedData = removeUndefined(sessionData);

  try {
    await setDoc(doc(db, 'sessions', sessionId), cleanedData);
    return sessionId;
  } catch (error) {
    console.error('Error saving session:', error);
    console.error('Session data:', JSON.stringify(cleanedData, null, 2));
    throw new Error('Failed to save session to cloud');
  }
}

// Load session from Firestore
export async function loadSessionFromCloud(sessionId: string): Promise<CloudSession | null> {
  console.log('[Firebase] Loading session:', sessionId);
  try {
    const docRef = doc(db, 'sessions', sessionId);
    console.log('[Firebase] Fetching document from Firestore...');
    const docSnap = await getDoc(docRef);

    console.log('[Firebase] Document exists:', docSnap.exists());
    if (!docSnap.exists()) {
      console.warn('[Firebase] Session document not found');
      return null;
    }

    const data = docSnap.data() as CloudSession;
    console.log('[Firebase] Session data retrieved:', {
      id: data.id,
      uploads: data.uploads?.length || 0,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt
    });

    // Check if session is expired
    const expiresAt = new Date(data.expiresAt);
    if (expiresAt < new Date()) {
      console.warn('[Firebase] Session expired:', expiresAt);
      return null;
    }

    console.log('[Firebase] ✓ Session loaded successfully');
    return data;
  } catch (error) {
    console.error('[Firebase] Error loading session:', error);
    console.error('[Firebase] Error details:', {
      name: (error as any)?.name,
      code: (error as any)?.code,
      message: (error as any)?.message
    });
    throw error; // Re-throw so App.tsx can catch and display it
  }
}

// Generate shareable URL
export function generateShareUrl(sessionId: string): string {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?resultId=${sessionId}`;
}

// Get session ID from URL
export function getSessionIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('resultId');
}
