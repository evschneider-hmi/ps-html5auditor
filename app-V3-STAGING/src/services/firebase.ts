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
  };

  // Simplify bundleResult if it exists
  if (upload.bundleResult) {
    simplified.bundleResult = {
      ...upload.bundleResult,
      content: undefined, // Remove binary content
      rawFiles: undefined, // Remove file buffers
      files: upload.bundleResult.files ? upload.bundleResult.files.map((f: any) => ({
        name: f.name,
        path: f.path,
        size: f.size,
        gzipSize: f.gzipSize,
        // Remove buffer data
        buffer: undefined,
        content: undefined,
      })) : undefined,
    };
  }

  // Simplify tagResult if it exists (tags have much less data)
  if (upload.tagResult) {
    simplified.tagResult = {
      ...upload.tagResult,
      raw: undefined, // Remove raw file data
    };
  }

  return simplified;
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

  try {
    await setDoc(doc(db, 'sessions', sessionId), sessionData);
    return sessionId;
  } catch (error) {
    console.error('Error saving session:', error);
    throw new Error('Failed to save session to cloud');
  }
}

// Load session from Firestore
export async function loadSessionFromCloud(sessionId: string): Promise<CloudSession | null> {
  try {
    const docRef = doc(db, 'sessions', sessionId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as CloudSession;

    // Check if session is expired
    const expiresAt = new Date(data.expiresAt);
    if (expiresAt < new Date()) {
      console.warn('Session expired');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error loading session:', error);
    return null;
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
