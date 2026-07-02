/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBzgjxAPVFcMXyk-NowjWX5DuaWfaWCpEw",
  authDomain: "carbide-smoke-58kj5.firebaseapp.com",
  projectId: "carbide-smoke-58kj5",
  storageBucket: "carbide-smoke-58kj5.firebasestorage.app",
  messagingSenderId: "951174260571",
  appId: "1:951174260571:web:86f03a8a209b6efbab9c7e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);

// Use the specific firestore database ID from firebase-applet-config.json
export const db = getFirestore(app, "ai-studio-c86e6e15-ca3b-4131-b875-1767b7d8d9ca");

export default app;
