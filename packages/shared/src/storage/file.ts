import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AppendMessageInput,
  ChatMessage,
  ChatSession,
  ChatStore,
  CreateSessionOptions,
  ListSessionsOptions,
  UpdateSessionInput,
} from "./types";

function looksLikeRepoRoot(dir: string) {
  return (
    existsSync(path.join(dir, "package.json")) &&
    existsSync(path.join(dir, "apps")) &&
    existsSync(path.join(dir, "packages"))
  );
}

function resolveDataDir() {
  const override = process.env.TANDEM_DATA_DIR;
  if (override && override.trim().length > 0) {
    return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  }

  let current = process.cwd();
  while (true) {
    if (looksLikeRepoRoot(current)) {
      return path.join(current, ".data");
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.join(process.cwd(), ".data");
}

const DATA_DIR = resolveDataDir();
const SESSIONS_FILE = "sessions.json";
const MESSAGES_FILE = "messages.json";

const createId = () => randomUUID();

async function readJsonFile<T>(filePath: string): Promise<T[]> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, data: unknown) {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tempPath, filePath);
}

function sortSessions(sessions: ChatSession[]) {
  return [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function cloneSession(session: ChatSession): ChatSession {
  return { ...session };
}

function cloneMessage(message: ChatMessage): ChatMessage {
  return { ...message };
}

class FileChatStore implements ChatStore {
  private sessions: ChatSession[] = [];
  private messages: ChatMessage[] = [];
  private ready: Promise<void>;
  private lock: Promise<void> = Promise.resolve();

  constructor(private readonly baseDir: string) {
    this.ready = this.bootstrap();
  }

  private async bootstrap() {
    await fs.mkdir(this.baseDir, { recursive: true });
    this.sessions = await readJsonFile<ChatSession>(path.join(this.baseDir, SESSIONS_FILE));
    this.messages = await readJsonFile<ChatMessage>(path.join(this.baseDir, MESSAGES_FILE));
  }

  private async persist() {
    await writeJsonFile(path.join(this.baseDir, SESSIONS_FILE), this.sessions);
    await writeJsonFile(path.join(this.baseDir, MESSAGES_FILE), this.messages);
  }

  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.ready;
    const next = this.lock.then(fn);
    this.lock = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async createSession(businessId: string, options?: CreateSessionOptions): Promise<ChatSession> {
    return this.runExclusive(async () => {
      const timestamp = new Date().toISOString();
      const session: ChatSession = {
        id: createId(),
        businessId,
        locationSlug: options?.locationSlug,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.sessions.push(session);
      await this.persist();
      return cloneSession(session);
    });
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    await this.ready;
    const session = this.sessions.find((entry) => entry.id === sessionId);
    return session ? cloneSession(session) : null;
  }

  async listSessions(businessId: string, options?: ListSessionsOptions): Promise<ChatSession[]> {
    await this.ready;
    const limit = options?.limit ?? 20;
    const filtered = this.sessions.filter((session) => session.businessId === businessId);
    return sortSessions(filtered).slice(0, limit).map(cloneSession);
  }

  async appendMessage(sessionId: string, messageInput: AppendMessageInput): Promise<ChatMessage> {
    return this.runExclusive(async () => {
      const session = this.sessions.find((entry) => entry.id === sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const createdAt = messageInput.createdAt ?? new Date().toISOString();
      const message: ChatMessage = {
        id: createId(),
        sessionId,
        businessId: session.businessId,
        role: messageInput.role,
        content: messageInput.content,
        createdAt,
      };
      this.messages.push(message);
      session.updatedAt = createdAt;
      await this.persist();
      return cloneMessage(message);
    });
  }

  async listMessages(sessionId: string): Promise<ChatMessage[]> {
    await this.ready;
    return this.messages
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(cloneMessage);
  }

  async updateSession(sessionId: string, patch: UpdateSessionInput): Promise<ChatSession> {
    return this.runExclusive(async () => {
      const index = this.sessions.findIndex((entry) => entry.id === sessionId);
      if (index === -1) {
        throw new Error(`Session ${sessionId} not found`);
      }
      const next: ChatSession = {
        ...this.sessions[index],
        ...patch,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      };
      this.sessions[index] = next;
      await this.persist();
      return cloneSession(next);
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.runExclusive(async () => {
      this.sessions = this.sessions.filter((entry) => entry.id !== sessionId);
      this.messages = this.messages.filter((entry) => entry.sessionId !== sessionId);
      await this.persist();
    });
  }
}

export async function createFileChatStore(): Promise<ChatStore> {
  return new FileChatStore(DATA_DIR);
}
