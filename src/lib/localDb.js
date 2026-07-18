// Data layer backed by Supabase (Postgres + Auth + Storage + Realtime).
// Keeps the exact same filter/get/create/update/delete/subscribe API the
// UI components already expect, so no component code needs to change.

import { supabase } from "./supabaseClient";

// Même serveur Render que celui utilisé pour la signalisation vocale
// (wss://websocketshift.onrender.com), en https:// pour les appels HTTP
// classiques (upload de fichiers).
const UPLOAD_SERVER_URL = "https://websocketshift.onrender.com";


// Map our "entity" names (used throughout the app) to real Supabase table names.
const TABLES = {
  Ban: "bans",
  CallHistory: "call_history",
  Channel: "channels",
  DMConversation: "dm_conversations",
  Friendship: "friendships",
  Message: "messages",
  Role: "roles",
  Server: "servers",
  ServerMember: "server_members",
  UserProfil: "user_profiles",
  UserProfile: "user_profiles",
  VoiceParticipant: "voice_participants",
};

function tableName(entityName) {
  return TABLES[entityName] || entityName.toLowerCase();
}

// Normalizes a row coming back from Supabase so components that expect
// `created_date` (from the old localStorage version) keep working.
function normalizeRow(row) {
  if (!row) return row;
  if (row.created_at && !row.created_date) {
    return { ...row, created_date: row.created_at };
  }
  return row;
}

// Un seul channel Supabase Realtime par table (limitation du client :
// un topic donné ne peut être "subscribe()" qu'une fois). On multiplexe
// donc ici : le premier appel à subscribe() pour une table crée le canal
// réel, les suivants s'ajoutent juste à la liste d'écouteurs et
// réutilisent ce même canal, sans jamais rappeler .subscribe() dessus.
const realtimeChannels = {}; // table -> { channel, listeners: Set }

function getOrCreateRealtimeChannel(table) {
  let entry = realtimeChannels[table];
  if (entry) return entry;

  const listeners = new Set();
  const channel = supabase
    .channel(`realtime:${table}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        const type =
          payload.eventType === "INSERT" ? "create" : payload.eventType === "DELETE" ? "delete" : "update";
        const data = normalizeRow(payload.new && Object.keys(payload.new).length ? payload.new : payload.old);
        listeners.forEach((cb) => {
          try {
            cb({ type, data });
          } catch (err) {
            console.error(`supabaseDb: listener error on "${table}"`, err);
          }
        });
      }
    )
    .subscribe();

  entry = { channel, listeners };
  realtimeChannels[table] = entry;
  return entry;
}

function createEntityClient(entityName) {
  const table = tableName(entityName);

  return {
    filter: async (query = {}) => {
      let q = supabase.from(table).select("*");
      Object.entries(query || {}).forEach(([key, value]) => {
        q = q.eq(key, value);
      });
      const { data, error } = await q;
      if (error) {
        console.error(`supabaseDb: filter "${entityName}" failed`, error);
        return [];
      }
      return (data || []).map(normalizeRow);
    },

    get: async (id) => {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (error) {
        console.error(`supabaseDb: get "${entityName}" failed`, error);
        return null;
      }
      return normalizeRow(data);
    },

    create: async (data = {}) => {
      const { data: inserted, error } = await supabase.from(table).insert(data).select().single();
      if (error) {
        console.error(`supabaseDb: create "${entityName}" failed`, error);
        throw error;
      }
      return normalizeRow(inserted);
    },

    update: async (id, data = {}) => {
      const { data: updated, error } = await supabase
        .from(table)
        .update(data)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) {
        console.error(`supabaseDb: update "${entityName}" failed`, error);
        throw error;
      }
      return normalizeRow(updated);
    },

    delete: async (id) => {
      const { data: removed, error } = await supabase
        .from(table)
        .delete()
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) {
        console.error(`supabaseDb: delete "${entityName}" failed`, error);
        throw error;
      }
      return normalizeRow(removed);
    },

    // Realtime subscription: fires callback({ type, data }) whenever a row
    // in this table is inserted/updated/deleted, mirroring the old pub/sub
    // API. Plusieurs composants peuvent s'abonner à la même table en même
    // temps (voir getOrCreateRealtimeChannel ci-dessus).
    subscribe: (callback) => {
      const { channel, listeners } = getOrCreateRealtimeChannel(table);
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
        if (listeners.size === 0) {
          supabase.removeChannel(channel);
          delete realtimeChannels[table];
        }
      };
    },
  };
}

export const db = {
  auth: {
    isAuthenticated: async () => {
      const { data } = await supabase.auth.getSession();
      return !!data?.session;
    },
    me: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user || null;
    },
    // Sends a 6-digit code (and magic link) to the given email.
    // Supabase creates the account automatically on first login (shouldCreateUser: true).
    register: async ({ email } = {}) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      return { email };
    },
    // Verifies the 6-digit code the user received by email.
    verifyEmail: async ({ email, code } = {}) => {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      return data;
    },
    // Same OTP flow covers "login" too: existing users just get a fresh code.
    loginViaEmailPassword: async ({ email } = {}) => {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      return { email };
    },
    loginWithProvider: async (provider = "google") => {
      const { error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) throw error;
    },
    resetPasswordRequest: async ({ email } = {}) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },
    resetPassword: async ({ newPassword } = {}) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    logout: async () => {
      await supabase.auth.signOut();
    },
    redirectToLogin: () => {},
  },

  entities: new Proxy(
    {},
    {
      get: (_target, entityName) => createEntityClient(String(entityName)),
    }
  ),

  integrations: {
    Core: {
      // Envoie le fichier à notre serveur Render, qui le pousse vers
      // Backblaze B2 (bucket privé) et renvoie une URL de lecture servie
      // par ce même serveur. Remplace l'ancien upload direct vers Supabase
      // Storage, qui plafonnait à 50 Mo sur le plan gratuit.
      UploadFile: async ({ file } = {}) => {
        if (!file) return { file_url: "" };
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${UPLOAD_SERVER_URL}/upload`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const message = await res.text().catch(() => "");
          console.error("supabaseDb: UploadFile failed", res.status, message);
          throw new Error(`Échec de l'upload (${res.status})`);
        }
        const data = await res.json();
        return { file_url: data.file_url };
      },
    },
  },
};

export default db;
