import { Client as RealClient, Databases as RealDatabases, Account as RealAccount } from "node-appwrite";
import { cookies } from "next/headers";

const isMock = !process.env.APPWRITE_API_KEY || 
               !process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 
               !process.env.APPWRITE_DATABASE_ID;

// Persist mock state across Next.js dev server hot reloads
const globalForAppwrite = global as unknown as {
  mockUsers: Map<string, any>;
  mockSessions: Map<string, any>;
  mockDocuments: Map<string, any[]>;
};

if (!globalForAppwrite.mockUsers) {
  globalForAppwrite.mockUsers = new Map();
  globalForAppwrite.mockSessions = new Map();
  globalForAppwrite.mockDocuments = new Map();
}

const mockUsers = globalForAppwrite.mockUsers;
const mockSessions = globalForAppwrite.mockSessions;
const mockDocuments = globalForAppwrite.mockDocuments;

class MockClient {
  config = { session: "" };
  setEndpoint() { return this; }
  setProject() { return this; }
  setKey() { return this; }
  setSession(value: string) {
    this.config.session = value;
    return this;
  }
}

class MockAccount {
  constructor(private client: any) {}

  async create(userId: string, email: string, password: string, name?: string) {
    // Reject duplicate emails just like real Appwrite
    if (mockUsers.has(email)) {
      const err = new Error("A user with the same email already exists");
      (err as any).code = 409;
      throw err;
    }
    const finalUserId = userId === "unique()" ? "u_" + Math.random().toString(36).substring(2, 11) : userId;
    const user = { $id: finalUserId, email, name: name || "", preferences: {} };
    mockUsers.set(email, { ...user, password });
    return user;
  }

  async createEmailPasswordSession(params: { email: string; password: any }) {
    const user = mockUsers.get(params.email);
    if (!user || user.password !== params.password) {
      const err = new Error("Invalid credentials");
      (err as any).code = 401;
      throw err;
    }
    const secret = "sess_" + Math.random().toString(36).substring(2, 15);
    const session = { secret, userId: user.$id };
    mockSessions.set(secret, session);
    return session;
  }

  async createAnonymousSession() {
    const userId = "anon_" + Math.random().toString(36).substring(2, 11);
    const user = { $id: userId, email: "", name: "Anonymous", preferences: {} };
    mockUsers.set(userId, user);
    const secret = "sess_" + Math.random().toString(36).substring(2, 15);
    const session = { secret, userId };
    mockSessions.set(secret, session);
    return session;
  }

  async get() {
    const token = this.client.config.session;
    console.log("DEBUG MockAccount.get: token =", token, "sessions =", Array.from(mockSessions.entries()));
    const session = mockSessions.get(token);
    if (!session) {
      const err = new Error("No active session");
      (err as any).code = 401;
      throw err;
    }
    const user = Array.from(mockUsers.values()).find(u => u.$id === session.userId);
    if (!user) {
      const err = new Error("User not found");
      (err as any).code = 404;
      throw err;
    }
    return user;
  }

  async deleteSession(params: { sessionId: string }) {
    const token = this.client.config.session;
    mockSessions.delete(token);
    return {};
  }
}

class MockDatabases {
  constructor(private client: any) {}

  async create(params: any) { return { $id: params.databaseId }; }

  async createCollection(params: any) {
    if (!mockDocuments.has(params.collectionId)) {
      mockDocuments.set(params.collectionId, []);
    }
    return { $id: params.collectionId, attributes: [] };
  }

  async createStringAttribute() {}
  async createIntegerAttribute() {}
  async createBooleanAttribute() {}
  async createIndex() {}

  async getCollection(params: any) {
    return {
      attributes: [
        { key: "createdAt", status: "available" },
        { key: "creatorId", status: "available" },
        { key: "pollId", status: "available" },
        { key: "userId", status: "available" },
      ]
    };
  }

  async createDocument({ collectionId, documentId, data }: any) {
    let docs = mockDocuments.get(collectionId);
    if (!docs) {
      docs = [];
      mockDocuments.set(collectionId, docs);
    }
    const finalDocId = documentId === "unique()" ? "d_" + Math.random().toString(36).substring(2, 11) : documentId;

    if (docs.some(d => d.$id === finalDocId)) {
      const err = new Error("Document already exists");
      (err as any).code = 409;
      throw err;
    }

    const doc = { $id: finalDocId, ...data };
    docs.push(doc);
    return doc;
  }

  async getDocument({ collectionId, documentId }: any) {
    const docs = mockDocuments.get(collectionId) || [];
    const doc = docs.find(d => d.$id === documentId);
    if (!doc) {
      const err = new Error("Document not found");
      (err as any).code = 404;
      throw err;
    }
    return doc;
  }

  async updateDocument({ collectionId, documentId, data }: any) {
    const docs = mockDocuments.get(collectionId) || [];
    const doc = docs.find(d => d.$id === documentId);
    if (!doc) {
      const err = new Error("Document not found");
      (err as any).code = 404;
      throw err;
    }
    Object.assign(doc, data);
    return doc;
  }

  async deleteDocument({ collectionId, documentId }: any) {
    const docs = mockDocuments.get(collectionId) || [];
    const idx = docs.findIndex(d => d.$id === documentId);
    if (idx === -1) {
      const err = new Error("Document not found");
      (err as any).code = 404;
      throw err;
    }
    docs.splice(idx, 1);
    return { success: true };
  }

  async listDocuments({ collectionId, queries }: any) {
    let docs = [...(mockDocuments.get(collectionId) || [])];

    if (queries && Array.isArray(queries)) {
      for (const q of queries) {
        let parsed: any;
        try {
          parsed = JSON.parse(q);
        } catch {
          continue;
        }

        if (parsed.method === "equal") {
          const attr = parsed.attribute;
          const vals = Array.isArray(parsed.values) ? parsed.values : [parsed.values];
          docs = docs.filter(d => vals.includes(d[attr]));
        } else if (parsed.method === "limit") {
          const limit = parsed.values[0];
          docs = docs.slice(0, limit);
        } else if (parsed.method === "orderDesc") {
          const attr = parsed.attribute;
          docs.sort((a, b) => (b[attr] > a[attr] ? 1 : -1));
        }
      }
    }

    return { documents: docs, total: docs.length };
  }
}

export function createAdminClient() {
  if (isMock) {
    const client = new MockClient();
    return {
      get account() { return new MockAccount(client) as any; },
      get databases() { return new MockDatabases(client) as any; },
    };
  }

  const client = new RealClient()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "");

  return {
    get account() { return new RealAccount(client); },
    get databases() { return new RealDatabases(client); },
  };
}

export async function createSessionClient(sessionValue?: string) {
  if (isMock) {
    const client = new MockClient();
    let token = sessionValue;
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get("pollify_session")?.value;
    }
    if (!token) {
      throw new Error("No active session");
    }
    client.setSession(token);
    return {
      get account() { return new MockAccount(client) as any; },
      get databases() { return new MockDatabases(client) as any; },
    };
  }

  const client = new RealClient()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "");

  let token = sessionValue;
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get("pollify_session")?.value;
  }

  if (!token) {
    throw new Error("No active session");
  }

  client.setSession(token);

  return {
    get account() { return new RealAccount(client); },
    get databases() { return new RealDatabases(client); },
  };
}

// Default export/compatibility layer
const client = isMock ? new MockClient() : new RealClient()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "")
  .setKey(process.env.APPWRITE_API_KEY || "");

export const serverDatabases = isMock ? new MockDatabases(client) as any : new RealDatabases(client as any);
export { client as serverClient };
