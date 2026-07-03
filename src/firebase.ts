/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Configuration for Supabase with smart formatting and fallbacks
let rawUrl = ((import.meta as any).env?.VITE_SUPABASE_URL) || '';
let rawKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || '';

// If rawUrl is a 20-character project reference ID (like 'wkqmckbtdkfpviprjbul'), convert to URL
if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = `https://${rawUrl.trim()}.supabase.co`;
}

// If rawKey is a 20-character project reference ID and rawUrl is empty, use it to construct the URL
if (rawKey && !rawKey.startsWith('http://') && !rawKey.startsWith('https://') && rawKey.length === 20 && !rawUrl) {
  rawUrl = `https://${rawKey.trim()}.supabase.co`;
}

export const supabaseUrl = rawUrl;
export const supabaseAnonKey = rawKey;

// We need both the URL and a valid anon key (usually a long JWT starting with eyJ or new sb_publishable format)
// If the key is just the project ID, warn that the real anon key is also needed.
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  (supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.startsWith('sb_publishable') || supabaseAnonKey.length > 25)
);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase is not fully configured yet.\n" +
    "- VITE_SUPABASE_URL: " + (supabaseUrl || "Missing") + "\n" +
    "- VITE_SUPABASE_ANON_KEY: " + (supabaseAnonKey ? "Configured (starts with " + supabaseAnonKey.slice(0, 5) + "...)" : "Missing") + "\n" +
    "Falling back to local Mock Mode."
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project-id.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// Cast to any to bypass deep/recursive TypeScript type checking for builder methods
const client: any = supabase;

// Session tracking for current logged in user
let currentSession: any = null;
client.auth.getSession().then(({ data: { session } }: any) => {
  currentSession = session;
});

client.auth.onAuthStateChange((_event: any, session: any) => {
  currentSession = session;
});

// App mock default export
const app = {};
export default app;

// Auth Compatibility Layer
export const auth: any = {
  get currentUser() {
    if (!isSupabaseConfigured) return null;
    const user = currentSession?.user;
    if (!user) return null;
    return {
      uid: user.id,
      email: user.email,
    };
  }
};

export const db = {};

export async function signInWithEmailAndPassword(_authInstance: any, email: string, password: string): Promise<any> {
  if (!isSupabaseConfigured) {
    const err: any = new Error('Supabase is not configured yet');
    err.code = 'auth/operation-not-allowed';
    throw err;
  }
  
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    const err: any = new Error(error.message);
    err.code = 'auth/invalid-credential';
    throw err;
  }
  
  return {
    user: {
      uid: data.user?.id || '',
      email: data.user?.email || '',
    }
  };
}

export async function createUserWithEmailAndPassword(_authInstance: any, email: string, password: string): Promise<any> {
  if (!isSupabaseConfigured) {
    const err: any = new Error('Supabase is not configured yet');
    err.code = 'auth/operation-not-allowed';
    throw err;
  }
  
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    const err: any = new Error(error.message);
    err.code = 'auth/invalid-credential';
    throw err;
  }
  
  return {
    user: {
      uid: data.user?.id || '',
      email: data.user?.email || '',
    }
  };
}

export async function signOut(_authInstance: any): Promise<void> {
  if (isSupabaseConfigured) {
    await client.auth.signOut();
  }
}

export function onAuthStateChanged(_authInstance: any, callback: any): any {
  if (!isSupabaseConfigured) {
    // Immediately call callback with null if not configured
    setTimeout(() => callback(null), 0);
    return () => {};
  }
  
  // Get initial session
  client.auth.getSession().then(({ data: { session } }: any) => {
    if (session?.user) {
      callback({
        uid: session.user.id,
        email: session.user.email,
      });
    } else {
      callback(null);
    }
  });
  
  const { data: { subscription } } = client.auth.onAuthStateChange((_event: any, session: any) => {
    if (session?.user) {
      callback({
        uid: session.user.id,
        email: session.user.email,
      });
    } else {
      callback(null);
    }
  });
  
  return () => {
    subscription.unsubscribe();
  };
}

export async function updatePassword(_userInstance: any, newPassword: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export const EmailAuthProvider = {
  credential(email: string, currentPassword: string) {
    return { email, password: currentPassword };
  }
};

export async function reauthenticateWithCredential(_userInstance: any, credential: any): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await client.auth.signInWithPassword({
    email: credential.email,
    password: credential.password
  });
  if (error) throw error;
}

// Firestore Compatibility Layer
export function collection(_dbInstance: any, path: string): any {
  return { type: 'collection', name: path };
}

export function doc(_dbInstance: any, path: string, id: string): any {
  return { type: 'doc', collection: path, id };
}

export function query(collRef: any, ...constraints: any[]): any {
  return { type: 'query', collection: collRef.name, constraints };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): any {
  return { type: 'orderBy', field, dir };
}

export function where(field: string, op: string, value: any): any {
  return { type: 'where', field, op, value };
}

export async function getDoc(docRef: any): Promise<any> {
  const { collection: tableName, id } = docRef;
  if (!isSupabaseConfigured) {
    return { exists: () => false, data: () => null, id };
  }
  
  const { data, error } = await client.from(tableName).select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error(`Error getDoc on ${tableName}:${id}`, error);
  }
  
  return {
    exists: () => !!data,
    data: () => data,
    id
  };
}

export async function getDocs(queryRef: any): Promise<any> {
  const tableName = queryRef.type === 'collection' ? queryRef.name : queryRef.collection;
  const constraints = queryRef.type === 'query' ? queryRef.constraints : [];
  
  if (!isSupabaseConfigured) {
    return {
      empty: true,
      docs: [],
      forEach: () => {}
    };
  }
  
  let q: any = client.from(tableName).select('*');
  
  if (constraints) {
    for (const c of constraints) {
      if (c.type === 'where') {
        if (c.op === '==' || c.op === '===') {
          q = q.eq(c.field, c.value);
        } else if (c.op === '>=') {
          q = q.gte(c.field, c.value);
        } else if (c.op === '<=') {
          q = q.lte(c.field, c.value);
        } else if (c.op === '>') {
          q = q.gt(c.field, c.value);
        } else if (c.op === '<') {
          q = q.lt(c.field, c.value);
        }
      } else if (c.type === 'orderBy') {
        q = q.order(c.field, { ascending: c.dir === 'asc' });
      }
    }
  }
  
  const { data, error } = await q;
  if (error) {
    console.error(`Error getDocs on ${tableName}`, error);
  }
  
  const items = data || [];
  return {
    empty: items.length === 0,
    docs: items.map(item => ({
      id: item.id,
      data: () => item
    })),
    forEach: (callback: any) => {
      items.forEach(item => {
        callback({
          id: item.id,
          data: () => item
        });
      });
    }
  };
}

export async function setDoc(docRef: any, data: any, _options?: any): Promise<void> {
  const { collection: tableName, id } = docRef;
  if (!isSupabaseConfigured) return;
  
  const payload = { id, ...data };
  
  const { error } = await client.from(tableName).upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error(`Error setDoc on ${tableName}:${id}`, error);
    throw error;
  }
}

export async function addDoc(collectionRef: any, data: any): Promise<any> {
  const tableName = collectionRef.name;
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
  
  // Generate random id
  const id = Math.random().toString(36).substring(2, 15);
  const payload = { id, ...data };
  
  const { error } = await client.from(tableName).insert([payload]);
  if (error) {
    console.error(`Error addDoc on ${tableName}`, error);
    throw error;
  }
  
  return { id };
}

export async function updateDoc(docRef: any, data: any): Promise<void> {
  const { collection: tableName, id } = docRef;
  if (!isSupabaseConfigured) return;
  
  const { error } = await client.from(tableName).update(data).eq('id', id);
  if (error) {
    console.error(`Error updateDoc on ${tableName}:${id}`, error);
    throw error;
  }
}

export async function deleteDoc(docRef: any): Promise<void> {
  const { collection: tableName, id } = docRef;
  if (!isSupabaseConfigured) return;
  
  const { error } = await client.from(tableName).delete().eq('id', id);
  if (error) {
    console.error(`Error deleteDoc on ${tableName}:${id}`, error);
    throw error;
  }
}

export function onSnapshot(queryOrColl: any, callback: any, onError?: any): any {
  const tableName = queryOrColl.type === 'collection' ? queryOrColl.name : queryOrColl.collection;
  
  if (!isSupabaseConfigured) {
    // Call callback with empty snapshot if not configured
    setTimeout(() => {
      callback({
        empty: true,
        docs: [],
        forEach: () => {}
      });
    }, 0);
    return () => {};
  }
  
  const fetchAndTrigger = async () => {
    try {
      const snap = await getDocs(queryOrColl);
      callback(snap);
    } catch (err) {
      console.error(`Error in onSnapshot fetching ${tableName}`, err);
      if (onError) {
        onError(err);
      }
    }
  };
  
  // Initial fetch
  fetchAndTrigger();
  
  // Real-time subscription
  const channelName = `realtime:${tableName}:${Math.random().toString(36).substring(2, 10)}`;
  const channel = client.channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
      fetchAndTrigger();
    })
    .subscribe();
    
  return () => {
    client.removeChannel(channel);
  };
}
