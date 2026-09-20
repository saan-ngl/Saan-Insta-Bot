/**
 * Type definitions for InstaBOT & User-Session Emulation Architecture
 * Speaks the same HTTP/GraphQL and MQTT protocols the browser client uses,
 * providing programmatic access to messages, threads, reactions, typing indicators, and more.
 */

/// <reference types="node" />

import { EventEmitter } from "events";

export type ID = string;
export type ThreadID = string;
export type MessageID = string;
export type UserID = string;

export interface AppStateCookie {
  key?: string;
  name?: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
  sameSite?: "Strict" | "Lax" | "None" | string;
}

export type AppState = AppStateCookie[];

export interface PasswordCredentials {
  email?: string;
  username?: string;
  password?: string;
}

export type LoginCredentials =
  | string
  | AppState
  | { appState: AppState }
  | { cookie: string }
  | { cookies: string | AppState }
  | PasswordCredentials;

export interface EmulationOptions {
  userAgent?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  proxy?: string;
  timeout?: number;
  selfListen?: boolean;
  listenEvents?: boolean;
  autoReconnect?: boolean;
  commandPrefix?: string;
  stopOnSignals?: boolean;
}

export interface SendMessagePayload {
  body?: string;
  text?: string;
  attachment?: string | Buffer | NodeJS.ReadableStream | Array<string | Buffer | NodeJS.ReadableStream>;
  attachments?: Array<string | Buffer | NodeJS.ReadableStream>;
  url?: string;
  photo?: string;
  image?: string;
  video?: string;
  audio?: string;
  voice?: string;
  gif?: string;
  effect?: "love" | "gift" | "celebration" | "fire" | string;
  avatarEffect?: "love" | "angry" | "laugh" | "cry" | string;
  replyTo?: MessageID;
  replyToMessageID?: MessageID;
  textFirst?: boolean;
  clientContext?: string;
}

export type MessageInput = string | SendMessagePayload;

export interface SendResult {
  messageID: MessageID;
  threadID: ThreadID;
  timestamp?: number | string;
  clientContext?: string;
}

export interface MessageReply {
  messageID: MessageID;
  senderID: UserID;
  body: string;
  attachments: Array<{ type: string; url?: string }>;
  timestamp?: string;
}

export interface UnifiedEvent {
  type: "message" | "message_reply" | "reaction" | "typing" | "join" | "leave" | "message_unsent" | string;
  threadID: ThreadID;
  senderID: UserID;
  userID: UserID;
  messageID?: MessageID;
  body?: string;
  args?: string[];
  isGroup?: boolean;
  isSelf?: boolean;
  timestamp?: number | string;
  messageReply?: MessageReply;
  repliedMessage?: MessageReply;
  attachments?: Array<{ type: string; url?: string; [key: string]: unknown }>;
  reaction?: string;
  reactionStatus?: "created" | "deleted";
  userIDs?: UserID[];
  [key: string]: unknown;
}

export interface UserInfo {
  id: UserID;
  userID?: UserID;
  username: string;
  fullName?: string;
  name?: string;
  isPrivate?: boolean;
  isVerified?: boolean;
  profilePicUrl?: string;
  followerCount?: number;
  followingCount?: number;
  [key: string]: unknown;
}

export interface ThreadInfo {
  threadID: ThreadID;
  title?: string;
  name?: string;
  isGroup: boolean;
  participants: UserInfo[];
  participantIDs?: UserID[];
  adminIDs?: UserID[];
  unreadCount?: number;
  lastActivityAt?: string | number;
  [key: string]: unknown;
}

export interface InboxOptions {
  limit?: number;
  cursor?: string;
  pending?: boolean;
}

export interface InboxResult {
  threads: ThreadInfo[];
  hasOlder?: boolean;
  cursor?: string;
}

export type Callback<T> = (err: Error | null, result?: T) => void;

/**
 * Programmatic flat API surface
 */
export interface Api {
  getCurrentUserID(): UserID | null;
  getAppState(): AppState;

  sendMessage(message: MessageInput, threadID: ThreadID): Promise<SendResult>;
  sendMessage(message: MessageInput, threadID: ThreadID, callback: Callback<SendResult>): void;
  sendMessage(message: MessageInput, threadID: ThreadID, callback: Callback<SendResult>, replyToMessageID?: MessageID): void;
  sendMessage(message: MessageInput, threadID: ThreadID, replyToMessageID: MessageID): Promise<SendResult>;

  replyToMessage(threadID: ThreadID, message: MessageInput, replyToMessageID: MessageID): Promise<SendResult>;
  replyToMessage(threadID: ThreadID, message: MessageInput, replyToMessageID: MessageID, callback: Callback<SendResult>): void;

  sendPhoto(threadID: ThreadID, pathOrUrl: string, opts?: { caption?: string; replyToMessageID?: MessageID }): Promise<SendResult>;
  sendPhoto(threadID: ThreadID, pathOrUrl: string, opts: { caption?: string; replyToMessageID?: MessageID }, callback: Callback<SendResult>): void;

  sendImage(source: string | Buffer, threadID: ThreadID, caption?: string, callback?: Callback<SendResult>, replyToMessageID?: MessageID): Promise<SendResult>;
  sendVideo(source: string | Buffer, threadID: ThreadID, opts?: { caption?: string; replyToMessageID?: MessageID }, callback?: Callback<SendResult>, replyToMessageID?: MessageID): Promise<SendResult>;
  sendVoice(threadID: ThreadID, pathOrUrl: string, opts?: { replyToMessageID?: MessageID }, callback?: Callback<SendResult>): Promise<SendResult>;
  sendAudio(source: string | Buffer, threadID: ThreadID, callback?: Callback<SendResult>, replyToMessageID?: MessageID): Promise<SendResult>;
  sendGIF(threadID: ThreadID, url: string, opts?: { replyToMessageID?: MessageID }, callback?: Callback<SendResult>): Promise<SendResult>;

  sendReaction(reaction: string, messageID: MessageID, threadID?: ThreadID): Promise<{ success: boolean }>;
  sendReaction(reaction: string, messageID: MessageID, threadID: ThreadID | undefined, callback: Callback<{ success: boolean }>): void;
  setMessageReaction(reaction: string, messageID: MessageID, threadID?: ThreadID, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  unsendMessage(messageID: MessageID, threadID?: ThreadID): Promise<{ success: boolean }>;
  unsendMessage(messageID: MessageID, threadID: ThreadID | undefined, callback: Callback<{ success: boolean }>): void;

  sendTypingIndicator(threadID: ThreadID, callback?: Callback<() => Promise<void>>): (() => Promise<void>) | Promise<() => Promise<void>>;
  stopTypingIndicator(threadID: ThreadID, callback?: Callback<void>): Promise<void>;

  markAsRead(threadID: ThreadID, read?: boolean, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  getThreadInfo(threadID: ThreadID, callback?: Callback<ThreadInfo>): Promise<ThreadInfo>;
  getThreadList(options?: InboxOptions, callback?: Callback<InboxResult | ThreadInfo[]>): Promise<InboxResult | ThreadInfo[]>;
  getThreadHistory(threadID: ThreadID, amount?: number, timestamp?: number | string, callback?: Callback<UnifiedEvent[]>): Promise<UnifiedEvent[]>;
  getUserInfo(userID: UserID, callback?: Callback<UserInfo | Record<string, UserInfo>>): Promise<UserInfo | Record<string, UserInfo>>;
  getUserInfoByUsername(username: string, callback?: Callback<UserInfo>): Promise<UserInfo>;

  sendTextEffect(text: string, threadID: ThreadID, effect: string, callback?: Callback<SendResult>): Promise<SendResult>;
  sendAvatarTextEffect(text: string, threadID: ThreadID, effect: string, callback?: Callback<SendResult>): Promise<SendResult>;
  sendMusic(threadID: ThreadID, track: string | Record<string, unknown>, callback?: Callback<unknown>): Promise<unknown>;
  musicSearch(query: string, callback?: Callback<unknown[]>): Promise<unknown[]>;

  listen(callback: (err: Error | null, event?: UnifiedEvent) => void): () => void;
  listenMqtt(callback: (err: Error | null, event?: UnifiedEvent) => void): () => void;
  stopListening(): void;
}

/**
 * MessageContext helper passed to bot commands
 */
export interface MessageContext {
  threadID: ThreadID;
  event: UnifiedEvent;
  send(form: MessageInput, callback?: Callback<SendResult>): Promise<SendResult>;
  reply(form: MessageInput, callback?: Callback<SendResult>): Promise<SendResult>;
  unsend(messageID?: MessageID, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  react(emoji: string, messageID?: MessageID, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  reaction(emoji: string, messageID?: MessageID, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  effect(text: string, effect: string, callback?: Callback<SendResult>): Promise<SendResult>;
  avatarEffect(text: string, effect: string, callback?: Callback<SendResult>): Promise<SendResult>;
  music(track: string, callback?: Callback<unknown>): Promise<unknown>;
  musicSearch(query: string, callback?: Callback<unknown[]>): Promise<unknown[]>;
  typing(): () => void;
  SyntaxError(customGuide?: string): Promise<SendResult>;
}

export interface BotCommandContext {
  message: MessageContext;
  event: UnifiedEvent;
  args: string[];
  prefix: string;
  config: Record<string, unknown>;
  registry: Record<string, unknown>;
  bot: Record<string, unknown>;
}

export interface CommandContext {
  event: UnifiedEvent;
  args: string[];
  threadID: ThreadID;
  messageID?: MessageID;
  senderID: UserID;
  replyAsync(text: string): Promise<SendResult>;
  sendAsync(text: string): Promise<SendResult>;
  reactAsync(emoji: string): Promise<{ success: boolean }>;
}

/**
 * Event-Driven MessengerBot / InstagramBot instance
 */
export interface MessengerBot extends EventEmitter {
  on(event: "messageCreate", listener: (event: UnifiedEvent) => void): this;
  on(event: "reaction", listener: (event: UnifiedEvent) => void): this;
  on(event: "typing", listener: (event: UnifiedEvent) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "ready", listener: (data: { userID: UserID; api: Api }) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;

  command(name: string, handler: (ctx: CommandContext) => void | Promise<void>): this;
  start(): Promise<this>;
  stopListening(): void;
}

export function createMessengerBot(credentials: LoginCredentials, options?: EmulationOptions): Promise<MessengerBot>;
export function createInstagramBot(credentials: LoginCredentials, options?: EmulationOptions): Promise<MessengerBot>;
export function login(credentials: LoginCredentials, callback?: Callback<Api>): Promise<Api>;
export function login(credentials: LoginCredentials, options?: EmulationOptions, callback?: Callback<Api>): Promise<Api>;

export class UserSessionEmulation extends EventEmitter implements Api {
  constructor(credentials?: LoginCredentials, options?: EmulationOptions);
  getCurrentUserID(): UserID | null;
  getAppState(): AppState;
  sendMessage(message: MessageInput, threadID: ThreadID, callback?: Callback<SendResult>, replyToMessageID?: MessageID): Promise<SendResult>;
  replyToMessage(threadID: ThreadID, message: MessageInput, replyToMessageID: MessageID, callback?: Callback<SendResult>): Promise<SendResult>;
  sendPhoto(threadID: ThreadID, pathOrUrl: string, opts?: { caption?: string; replyToMessageID?: MessageID }): Promise<SendResult>;
  sendImage(source: string | Buffer, threadID: ThreadID, caption?: string, callback?: Callback<SendResult>, replyToMessageID?: MessageID): Promise<SendResult>;
  sendVideo(source: string | Buffer, threadID: ThreadID, opts?: { caption?: string; replyToMessageID?: MessageID }, callback?: Callback<SendResult>, replyToMessageID?: MessageID): Promise<SendResult>;
  sendVoice(threadID: ThreadID, pathOrUrl: string, opts?: { replyToMessageID?: MessageID }, callback?: Callback<SendResult>): Promise<SendResult>;
  sendAudio(source: string | Buffer, threadID: ThreadID, callback?: Callback<SendResult>, replyToMessageID?: MessageID): Promise<SendResult>;
  sendGIF(threadID: ThreadID, url: string, opts?: { replyToMessageID?: MessageID }, callback?: Callback<SendResult>): Promise<SendResult>;
  sendReaction(reaction: string, messageID: MessageID, threadID?: ThreadID, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  setMessageReaction(reaction: string, messageID: MessageID, threadID?: ThreadID, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  unsendMessage(messageID: MessageID, threadID?: ThreadID, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  sendTypingIndicator(threadID: ThreadID, callback?: Callback<() => Promise<void>>): Promise<() => Promise<void>>;
  stopTypingIndicator(threadID: ThreadID, callback?: Callback<void>): Promise<void>;
  markAsRead(threadID: ThreadID, read?: boolean, callback?: Callback<{ success: boolean }>): Promise<{ success: boolean }>;
  getThreadInfo(threadID: ThreadID, callback?: Callback<ThreadInfo>): Promise<ThreadInfo>;
  getThreadList(options?: InboxOptions, callback?: Callback<InboxResult | ThreadInfo[]>): Promise<InboxResult | ThreadInfo[]>;
  getThreadHistory(threadID: ThreadID, amount?: number, timestamp?: number | string, callback?: Callback<UnifiedEvent[]>): Promise<UnifiedEvent[]>;
  getUserInfo(userID: UserID, callback?: Callback<UserInfo | Record<string, UserInfo>>): Promise<UserInfo | Record<string, UserInfo>>;
  getUserInfoByUsername(username: string, callback?: Callback<UserInfo>): Promise<UserInfo>;
  sendTextEffect(text: string, threadID: ThreadID, effect: string, callback?: Callback<SendResult>): Promise<SendResult>;
  sendAvatarTextEffect(text: string, threadID: ThreadID, effect: string, callback?: Callback<SendResult>): Promise<SendResult>;
  sendMusic(threadID: ThreadID, track: string | Record<string, unknown>, callback?: Callback<unknown>): Promise<unknown>;
  musicSearch(query: string, callback?: Callback<unknown[]>): Promise<unknown[]>;
  listen(callback: (err: Error | null, event?: UnifiedEvent) => void): () => void;
  listenMqtt(callback: (err: Error | null, event?: UnifiedEvent) => void): () => void;
  stopListening(): void;
  graphQL(docId: string, variables?: Record<string, unknown>): Promise<unknown>;
  graphQLQuery(query: string, variables?: Record<string, unknown>): Promise<unknown>;
  command(name: string, handler: (ctx: CommandContext) => void | Promise<void>): this;
  start(): Promise<this>;
}

export default login;
