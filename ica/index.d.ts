// Type definitions for @neoaz07/nkxica
// Project: https://github.com/neoaz07/nkxica
// Definitions by: NKXICA contributors

/// <reference types="node" />

// ─────────────────────────────────────────────────────────────────────────────
// Login credentials
// ─────────────────────────────────────────────────────────────────────────────

/** Cookie payload — Netscape string, header string, JSON string, array, or object form. */
export type Cookies =
  | string
  | CookieEntry[]
  | { [name: string]: string }
  | { cookies: CookieEntry[] };

export interface CookieEntry {
  name?: string;
  key?: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
  sameSite?: 'Strict' | 'Lax' | 'None' | string;
}

export interface PasswordCredentials {
  username?: string;
  email?: string;
  password: string;
}

export type LoginCredentials = Cookies | PasswordCredentials;

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

export interface LoginOptions {
  /** Pino-style log level. Default: `'info'`. */
  logLevel?: LogLevel;
  /** Outbound HTTPS proxy URL (e.g. `http://user:pass@host:port`). */
  proxy?: string;
  /** Override the User-Agent header used for HTTP and MQTT. */
  userAgent?: string;
  /** Reuse a previously generated Android device id. */
  deviceId?: string;
  /** Reuse a previously generated phone id (UUID). */
  phoneId?: string;
  /** Reuse a previously generated client UUID. */
  uuid?: string;
  /** Advertising id (UUID). */
  advertisingId?: string;
  /** Persistent client session id (UUID). */
  clientSessionId?: string;
  /** Auto start listening via MQTT after login or session restore. Default: `true`. */
  autoListen?: boolean;
  /** MQTT connection timeout, in ms. Default: `30000`. */
  mqttConnectionTimeout?: number;
  /** Global minimum delay between any two HTTP requests, in ms. Default: `1500`. */
  globalRateLimitDelay?: number;
  /** Per-URL baseline delay used by the adaptive limiter, in ms. Default: `1000`. */
  perUrlBaseDelayMs?: number;
  /** Max retries for retryable HTTP errors (5xx, 429, transient network). Default: `3`. */
  maxRetries?: number;
  /** Base retry delay (ms) for the backoff schedule. Default: `2000`. */
  retryDelay?: number;
  /** Number of consecutive failures before the circuit opens. Default: `5`. */
  circuitFailureThreshold?: number;
  /** Cooldown (ms) before the circuit transitions to half-open. Default: `30000`. */
  circuitCooldownMs?: number;
  /** Enable the optional SQLite session/message database. */
  database?: boolean;
  /** Options forwarded to the database. */
  dbOptions?: Record<string, unknown>;
  /** Enable the optional cron-style task scheduler. */
  scheduler?: boolean;
  /** Options forwarded to the scheduler. */
  schedulerOptions?: Record<string, unknown>;
}

export interface SetGlobalOptions {
  logLevel?: LogLevel;
  selfListen?: boolean;
  listenEvents?: boolean;
  updatePresence?: boolean;
  autoMarkRead?: boolean;
  autoMarkDelivery?: boolean;
  forceLogin?: boolean;
  online?: boolean;
  pageID?: string;
  proxy?: string;
  userAgent?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Messages, events, and shared shapes
// ─────────────────────────────────────────────────────────────────────────────

/** Identifier returned by Instagram for an item, thread, or user. */
export type ID = string;

export interface SendMessageObject {
  /** Plain text body. */
  body?: string;
  /** Alias for `body` accepted by some helpers. */
  text?: string;
  /** Local file path or remote URL. Type is auto-detected from the extension. */
  attachment?: string | string[];
  /** Remote image URL. */
  image?: string;
  /** Remote video URL (streamed upload). */
  video?: string;
  /** GIF or Giphy URL. */
  gif?: string;
  /** Local audio path or remote audio URL. */
  audio?: string;
  /** Local photo path or remote photo URL. */
  photo?: string;
  /** Instagram sticker id. */
  sticker?: string;
  /** Reply to a specific message in the thread. */
  replyTo?: string;
  /** Alias for `replyTo`. */
  replied_to_item_id?: string;
  /**
   * If provided, repeat calls with the same key inside the cache TTL
   * return the cached result instead of re-sending the message.
   */
  idempotencyKey?: string;
  /** Forwarded to the underlying media helpers (caption, waveform, …). */
  options?: Record<string, unknown>;
}

export type Message = string | SendMessageObject;

export interface SendResult {
  threadID: string;
  messageID: string;
  timestamp: string;
  clientContext?: string;
}

export interface ListenEvent {
  /** Discriminator for the event kind, e.g. `'message'`, `'typ'`, `'reaction'`, `'presence'`, `'event'`. */
  type: string;
  threadID?: string;
  senderID?: string;
  body?: string;
  messageID?: string;
  timestamp?: string | number;
  isGroup?: boolean;
  /** Original raw payload from Instagram for advanced consumers. */
  raw?: unknown;
  [key: string]: unknown;
}

export type Callback<T> = (err: Error | null, result?: T) => void;
export type ErrorCallback = (err: Error | null) => void;
export type ListenCallback = (err: Error | null, event?: ListenEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Domain object shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface UserInfo {
  id: string;
  username: string;
  fullName?: string;
  isPrivate?: boolean;
  isVerified?: boolean;
  profilePicUrl?: string;
  followerCount?: number;
  followingCount?: number;
  [key: string]: unknown;
}

export interface ThreadInfo {
  threadID: string;
  title?: string;
  isGroup: boolean;
  participants: UserInfo[];
  lastActivityAt?: string;
  unreadCount?: number;
  [key: string]: unknown;
}

export interface InboxResult {
  threads: ThreadInfo[];
  hasOlder?: boolean;
  cursor?: string;
  [key: string]: unknown;
}

export interface ThreadHistory {
  threadID: string;
  messages: ListenEvent[];
  hasOlder?: boolean;
  cursor?: string;
  [key: string]: unknown;
}

export interface InboxOptions {
  limit?: number;
  cursor?: string;
  pending?: boolean;
  [key: string]: unknown;
}

export interface SearchOptions {
  limit?: number;
  [key: string]: unknown;
}

export interface MediaOptions {
  text?: string;
  caption?: string;
  allowFullAspect?: boolean;
  waveform?: number[];
  waveformFrequency?: number;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health snapshot
// ─────────────────────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitSnapshot {
  state: CircuitState;
  failures: number;
  successes: number;
}

export interface RateLimitSnapshot {
  delayMs: number;
  successStreak: number;
}

export interface HttpHealth {
  lastSuccessfulResponseAt: number;
  msSinceLastSuccess: number | null;
  circuits: Record<string, CircuitSnapshot>;
  rateLimits: Record<string, RateLimitSnapshot>;
}

export interface MqttHealth {
  initialized: boolean;
  connected: boolean;
  connecting: boolean;
  endpoint: string | null;
  reconnectAttempts: number;
}

export interface Health {
  authenticated: boolean;
  userId: string | null;
  listening: boolean;
  mqtt: MqttHealth;
  http: HttpHealth;
  database: boolean;
  scheduler: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionState {
  cookies?: unknown;
  authorization?: string | null;
  userId?: string | null;
  username?: string | null;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface CookieUtils {
  parse(cookies: Cookies): unknown;
  parseHeaderString(header: string): CookieEntry[];
  parseNetscape(text: string): CookieEntry[];
  parseJSON(json: string | object): CookieEntry[];
  serialize(jar: unknown): string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Api object returned by login()
// ─────────────────────────────────────────────────────────────────────────────

export interface Api {
  /** Currently authenticated user id and username (if known). */
  getCurrentUserID(): { userId: string | null; username: string | null } | null;

  // Listening
  listen(callback: ListenCallback): void;
  listen(): Promise<void>;
  stopListening(): void;
  on(event: string, listener: (...args: unknown[]) => void): Api;
  off(event: string, listener: (...args: unknown[]) => void): Api;
  once(event: string, listener: (...args: unknown[]) => void): Api;

  // Messaging
  sendMessage(message: Message, threadID: ID): Promise<SendResult | SendResult[]>;
  sendMessage(message: Message, threadID: ID, callback: Callback<SendResult | SendResult[]>): void;

  sendDirectMessage(userID: ID, message: Message): Promise<SendResult | SendResult[]>;
  sendDirectMessage(userID: ID, message: Message, callback: Callback<SendResult | SendResult[]>): void;

  replyToMessage(threadID: ID, message: Message, replyToMessageID: ID): Promise<SendResult | SendResult[]>;
  replyToMessage(
    threadID: ID,
    message: Message,
    replyToMessageID: ID,
    callback: Callback<SendResult | SendResult[]>
  ): void;

  unsendMessage(messageID: ID): Promise<{ success: boolean }>;
  unsendMessage(messageID: ID, callback: Callback<{ success: boolean }>): void;

  // Media
  sendPhoto(threadID: ID, path: string, opts?: MediaOptions): Promise<SendResult>;
  sendPhoto(threadID: ID, path: string, opts: MediaOptions | undefined, callback: Callback<SendResult>): void;

  sendVideo(threadID: ID, path: string, opts?: MediaOptions): Promise<SendResult>;
  sendVideo(threadID: ID, path: string, opts: MediaOptions | undefined, callback: Callback<SendResult>): void;

  sendVoice(threadID: ID, path: string, opts?: MediaOptions): Promise<SendResult>;
  sendVoice(threadID: ID, path: string, opts: MediaOptions | undefined, callback: Callback<SendResult>): void;

  sendGIF(threadID: ID, url: string, opts?: MediaOptions): Promise<SendResult>;
  sendGIF(threadID: ID, url: string, opts: MediaOptions | undefined, callback: Callback<SendResult>): void;

  sendPhotoFromUrl(threadID: ID, url: string, opts?: MediaOptions): Promise<SendResult>;
  sendPhotoFromUrl(threadID: ID, url: string, opts: MediaOptions | undefined, callback: Callback<SendResult>): void;

  sendVideoFromUrl(threadID: ID, url: string, opts?: MediaOptions): Promise<SendResult>;
  sendVideoFromUrl(threadID: ID, url: string, opts: MediaOptions | undefined, callback: Callback<SendResult>): void;

  sendVoiceFromUrl(threadID: ID, url: string, opts?: MediaOptions): Promise<SendResult>;
  sendVoiceFromUrl(threadID: ID, url: string, opts: MediaOptions | undefined, callback: Callback<SendResult>): void;

  // Reactions
  sendReaction(reaction: string, messageID: ID): Promise<{ success: boolean }>;
  sendReaction(reaction: string, messageID: ID, callback: Callback<{ success: boolean }>): void;
  removeReaction(messageID: ID): Promise<{ success: boolean }>;
  removeReaction(messageID: ID, callback: Callback<{ success: boolean }>): void;

  // Threads
  getThreadInfo(threadID: ID): Promise<ThreadInfo>;
  getThreadInfo(threadID: ID, callback: Callback<ThreadInfo>): void;

  getThreadHistory(threadID: ID, amount: number, timestamp?: number | string): Promise<ThreadHistory>;
  getThreadHistory(
    threadID: ID,
    amount: number,
    timestamp: number | string | undefined,
    callback: Callback<ThreadHistory>
  ): void;

  getInbox(opts?: InboxOptions): Promise<InboxResult>;
  getInbox(opts: InboxOptions | undefined, callback: Callback<InboxResult>): void;

  deleteThread(threadID: ID): Promise<{ success: boolean }>;
  deleteThread(threadID: ID, callback: Callback<{ success: boolean }>): void;

  markAsRead(threadID: ID, read?: boolean): Promise<{ success: boolean }>;
  markAsRead(threadID: ID, read: boolean | undefined, callback: Callback<{ success: boolean }>): void;

  markAsUnread(threadID: ID): Promise<{ success: boolean }>;
  markAsUnread(threadID: ID, callback: Callback<{ success: boolean }>): void;

  getPendingRequests(opts?: InboxOptions): Promise<InboxResult>;
  getPendingRequests(opts: InboxOptions | undefined, callback: Callback<InboxResult>): void;

  searchThreads(query: string, opts?: SearchOptions): Promise<InboxResult>;
  searchThreads(query: string, opts: SearchOptions | undefined, callback: Callback<InboxResult>): void;

  approveRequest(threadID: ID): Promise<{ success: boolean }>;
  approveRequest(threadID: ID, callback: Callback<{ success: boolean }>): void;

  declineRequest(threadID: ID): Promise<{ success: boolean }>;
  declineRequest(threadID: ID, callback: Callback<{ success: boolean }>): void;

  muteThread(threadID: ID): Promise<{ success: boolean }>;
  muteThread(threadID: ID, callback: Callback<{ success: boolean }>): void;

  unmuteThread(threadID: ID): Promise<{ success: boolean }>;
  unmuteThread(threadID: ID, callback: Callback<{ success: boolean }>): void;

  changeThreadTitle(threadID: ID, title: string): Promise<{ success: boolean }>;
  changeThreadTitle(threadID: ID, title: string, callback: Callback<{ success: boolean }>): void;

  changeNickname(userID: ID, threadID: ID, nickname: string): Promise<{ success: boolean }>;
  changeNickname(userID: ID, threadID: ID, nickname: string, callback: Callback<{ success: boolean }>): void;

  // Typing
  sendTypingIndicator(threadID: ID): Promise<void>;
  sendTypingIndicator(threadID: ID, callback: ErrorCallback): void;
  stopTypingIndicator(threadID: ID): Promise<void>;
  stopTypingIndicator(threadID: ID, callback: ErrorCallback): void;

  // Users
  getUserInfo(userID: ID): Promise<UserInfo>;
  getUserInfo(userID: ID, callback: Callback<UserInfo>): void;

  getUserInfoByUsername(username: string): Promise<UserInfo>;
  getUserInfoByUsername(username: string, callback: Callback<UserInfo>): void;

  searchUsers(query: string, opts?: SearchOptions): Promise<UserInfo[]>;
  searchUsers(query: string, opts: SearchOptions | undefined, callback: Callback<UserInfo[]>): void;

  // Stories
  getUserStories(userID: ID): Promise<unknown>;
  getUserStories(userID: ID, callback: Callback<unknown>): void;
  getFeedStories(opts?: Record<string, unknown>): Promise<unknown>;
  getFeedStories(opts: Record<string, unknown> | undefined, callback: Callback<unknown>): void;
  reactToStory(storyId: string, userId: string, emoji: string): Promise<{ success: boolean }>;
  reactToStory(
    storyId: string,
    userId: string,
    emoji: string,
    callback: Callback<{ success: boolean }>
  ): void;
  replyToStory(storyId: string, userId: string, message: Message): Promise<SendResult>;
  replyToStory(
    storyId: string,
    userId: string,
    message: Message,
    callback: Callback<SendResult>
  ): void;

  // Live
  getLiveFeed(opts?: Record<string, unknown>): Promise<unknown>;
  getLiveFeed(opts: Record<string, unknown> | undefined, callback: Callback<unknown>): void;
  sendLiveComment(broadcastId: string, message: string): Promise<unknown>;
  sendLiveComment(broadcastId: string, message: string, callback: Callback<unknown>): void;
  sendLiveHeart(broadcastId: string, count?: number): Promise<unknown>;
  sendLiveHeart(broadcastId: string, count: number | undefined, callback: Callback<unknown>): void;

  // Search
  search(query: string, opts?: SearchOptions): Promise<UserInfo[]>;
  search(query: string, opts: SearchOptions | undefined, callback: Callback<UserInfo[]>): void;
  searchHashtags(query: string, opts?: SearchOptions): Promise<unknown>;
  searchHashtags(query: string, opts: SearchOptions | undefined, callback: Callback<unknown>): void;
  searchPlaces(query: string, opts?: SearchOptions): Promise<unknown>;
  searchPlaces(query: string, opts: SearchOptions | undefined, callback: Callback<unknown>): void;
  searchReels(query: string, opts?: SearchOptions): Promise<unknown>;
  searchReels(query: string, opts: SearchOptions | undefined, callback: Callback<unknown>): void;

  // Health / monitoring
  getHealth(): Health;

  // Session
  getSession(): SessionState;
  saveSession(filePath?: string): Promise<SessionState>;
  loadSession(state: SessionState): Promise<void> | void;
  loadSessionFromFile(filePath?: string): Promise<SessionState>;

  // Auth
  logout(): Promise<{ success: boolean }>;
  logout(callback: Callback<{ success: boolean }>): void;
  verifyTwoFactor(code: string, identifier: string): Promise<{ success: boolean; userID?: string }>;
  verifyTwoFactor(
    code: string,
    identifier: string,
    callback: Callback<{ success: boolean; userID?: string }>
  ): void;

  // Options
  setOptions(opts: SetGlobalOptions): void;

  // Database & Scheduler
  initDatabase(): Promise<void>;
  scheduleTask(name: string, cronExpression: string, task: () => void | Promise<void>): void;

  // Cookie utilities (also available as `login.CookieUtils` before logging in)
  CookieUtils: CookieUtils;

  /** Direct access to the underlying client for advanced use. */
  _client: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Two-factor error
// ─────────────────────────────────────────────────────────────────────────────

export interface TwoFactorError extends Error {
  twoFactorRequired: true;
  twoFactorIdentifier: string;
  verify(code: string): Promise<{ success: boolean; userID?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// login()
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginFunction {
  (credentials: LoginCredentials): Promise<Api>;
  (credentials: LoginCredentials, options: LoginOptions): Promise<Api>;
  (credentials: LoginCredentials, callback: Callback<Api>): void;
  (credentials: LoginCredentials, options: LoginOptions, callback: Callback<Api>): void;

  /** Pre-login cookie helpers. */
  CookieUtils: CookieUtils;
  /** Set library-wide options. */
  setOptions(opts: SetGlobalOptions): void;
  /** Construct an unauthenticated client (advanced). */
  createClient(opts?: LoginOptions): unknown;
}

export const login: LoginFunction;
export default login;