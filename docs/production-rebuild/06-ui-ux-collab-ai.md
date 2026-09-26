# Focal - Detailed Page UI/UX: Collaboration & AI Pages

> Pixel-perfect visual descriptions, interaction patterns, and component inventories for Collaboration Hub, Process Assistant, Live Chat, and Chat Projects.

---

### 15.6 Collaboration Hub (`/v3/collaboration`)

**File:** `frontend/src/app/components/collaboration-hub/collaboration-hub.html`

#### Visual Layout Structure
- **Three-pane layout (desktop):** 320px left (rooms) + flexible center (chat) + 320px right (room details) — *right pane only for channel admins*
- **Left pane:** Header → Create Channel/DM buttons → Filter input → Room list (Channels, DMs, Saved/Mentions)
- **Center pane:** Room header → Search → Message stream (virtualized) → Composer
- **Right pane:** Room control, topic editor, member management, KB links, pinned messages, mentions, online users

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **Left Header** | "Collaboration" kicker + "focal Channels" title + "Ultra Dev Mode" badge |
| **Create Buttons** | "+ Channel" (primary), "+ Direct" (ghost), toggle visibility |
| **Channel Create Form** | Name, description, topic, private checkbox, member multi-select chips |
| **DM Create** | User dropdown → "Open Direct Chat" |
| **Room Filter** | Search input, filters both channels + DMs |
| **Room Item** | 56px height: #name (+ lock icon if private), topic/description, unread badge, star toggle |
| **Room Groups** | Section headers: "Channels", "Direct Messages", "Saved / Mentions" (mini rows) |
| **Center Header** | Room title, topic/description, Star/Mute toggles |
| **Message Stream** | Virtualized list, date dividers, "New messages" divider |
| **Message Card** | Own: right-aligned, brand bg; Other: left-aligned, gray bg; System: centered, muted |
| **Message Header** | Sender name + @handle + status chip (colored dot), timestamp, edited badge |
| **Message Actions** | Pin, Save, Edit (own), Delete (own) — hover-revealed |
| **Message Content** | `[innerHTML]` with mention highlighting |
| **Article Links** | Chips with article title, click → opens KB in new tab |
| **Reactions** | Emoji pills with count, click to toggle, palette for adding |
| **Delivery State** | "Sent" / "Seen" (DMs only) |
| **Thread Summary** | "N replies • Open thread" button (channels only) |
| **Thread Panel** | Slides in from right, root message + replies |
| **Composer** | Mention buttons (@handles), KB article tagger dropdown, textarea (4 rows), typing indicator, Send |
| **Right: Room Control** | Type, member count, pinned count, topic editor (channels) |
| **Right: Members** | Badge chips, invite dropdown + button (admins only) |
| **Right: KB Links** | Article dropdown + "Link" button, linked articles list with unlink |
| **Right: Pinned** | Mini message cards with unpin |
| **Right: Mentions** | Mini message cards (mentions of current user) |
| **Right: Online Team** | List with status dot (green/offline), name, role |

#### Interaction Patterns
- **Room select:** Click room item → loads messages via `CollaborationService.getMessages(roomId)`
- **Create channel:** Toggle form → fill → POST `/api/collaboration/channels` → appears in list
- **Create DM:** Select user → POST `/api/collaboration/direct` → opens room
- **Send message:** Enter (Shift+Enter for newline) → POST `/api/collaboration/rooms/{id}/messages`
- **Edit message:** Click "Edit" → textarea replaces content → Save/Cancel
- **Reactions:** Click emoji → POST `/api/collaboration/messages/{id}/reactions`
- **Pin/Unpin:** Click pin icon → PUT `/api/collaboration/messages/{id}/pin`
- **Save/Unsave:** Click save icon → adds to saved messages list
- **Thread:** Click "Open thread" → loads replies → thread panel slides in
- **Mentions:** Type @ → mention buttons appear → click inserts `@handle `
- **KB tagging:** Dropdown select → adds article chip to composer → sends with message
- **Topic edit:** Channel only → input + save → PUT `/api/collaboration/channels/{id}`
- **Invite members:** Channel only → dropdown + invite → POST `/api/collaboration/channels/{id}/members`
- **Star room:** Click star → toggles `starredRooms` set → persists to localStorage
- **Mute room:** Click mute → toggles `mutedRooms` set → suppresses notifications

#### Real-time Updates (Polling-based)
- **Messages:** `CollaborationService` polls `/api/collaboration/rooms/{id}/messages` every 3s
- **Typing:** Debounced broadcast via POST `/api/collaboration/typing` → shows "X is typing..."
- **Presence:** Polls `/api/presence/users` every 10s → updates status dots
- **Unread counts:** Computed client-side from `last_read_at` vs message timestamps

#### Visual States
| State | Description |
|-------|-------------|
| **Loading workspace** | Centered spinner "Loading collaboration workspace..." |
| **Error** | Red state box with error message, retry button |
| **Empty room** | "No messages yet. Start the conversation!" |
| **Thread open** | Right panel slides over (320px), backdrop on mobile |
| **Composing** | Typing indicator shows other users' typing status |

#### Responsive Behavior
- **< 1200px:** Right pane collapses to bottom sheet (slide up)
- **< 900px:** Left pane becomes drawer (same as shell sidebar)
- **< 640px:** Message cards stack vertically, composer textarea full-width, mention buttons scroll horizontally

---

### 15.7 Process Assistant (`/v3/process-assistant`)

**File:** `frontend/src/app/components/process-assistant/process-assistant.html`

#### Visual Layout Structure
- **Three-pane layout:** 300px left (history) + flexible center (chat) + 300px right (prompt details)
- **Left:** Header with "New chat" button → Prompt profile dropdown → Conversation list
- **Center:** Chat header → Message stream → Composer
- **Right:** Selected prompt profile details (system prompt, model params)

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **History Header** | "Process Copilot" title + "New chat" primary button |
| **Role Badge** | Muted text "Role: {normalizedRole}" |
| **Prompt Profile Dropdown** | Select with profile names, change → loads new conversation context |
| **Conversation List** | Items: title (bold), last message preview (muted), timestamp, delete icon (hover) |
| **Empty State** | "No conversations yet." centered |
| **Chat Header** | Conversation title + current prompt profile name |
| **Message Bubbles** | User: right, brand bg, white text; Assistant: left, gray bg; System: centered, muted |
| **Message Header** | Role label ("You" / "Focal Copilot") + timestamp |
| **Thinking State** | Assistant bubble with "Thinking" + animated 3-dot pulse |
| **Composer** | Textarea (4 rows), placeholder hint, "Enter to send, Shift+Enter for newline", Send button |
| **Right Panel** | Prompt name, model/temp/tokens, full system prompt in `<pre>` (monospace, scrollable) |

#### Interaction Patterns
- **New conversation:** Click "New chat" → POST `/api/process-assistant/conversations` → selects new
- **Select conversation:** Click list item → GET `/api/process-assistant/conversations/{id}` → loads messages
- **Switch prompt profile:** Dropdown change → creates new conversation with that profile
- **Send message:** Enter → POST `/api/process-assistant/conversations/{id}/messages` → shows thinking → streams response
- **Delete conversation:** Click delete icon → DELETE → removes from list
- **Keyboard:** Enter = send, Shift+Enter = newline, Escape = clear draft

#### Visual States
| State | Description |
|-------|-------------|
| **Loading conversations** | Spinner in history list |
| **Loading messages** | "Loading conversation..." centered in chat |
| **Sending** | Thinking animation in new assistant bubble, composer disabled |
| **Error** | Red error message in right panel, toast notification |
| **Empty conversation** | "No messages yet. Ask anything about process..." |

#### Data Flow
- `promptProfiles` loaded on init from `/api/process-assistant/profiles`
- `conversations` loaded on init from `/api/process-assistant/conversations`
- Messages loaded per conversation
- OpenAI calls proxied through backend (API key never exposed to frontend)

---

### 15.8 Live Chat (`/v3/live-chat`)

**File:** `frontend/src/app/components/live-chat/live-chat.html`

#### Visual Layout Structure
- **Two-pane layout:** Flexible main (conversation) + 320px right sidebar (queue)
- **Main (conversation):** Header (project/queue, customer name/email, status badge + close) → Message thread → Composer
- **Sidebar:** Header with "Play" button (claim next) → Project/Status filters → Session list cards

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **Conversation Header** | Project/queue line, customer name H1, email small, status badge (colored), Close button |
| **Message Bubbles** | Customer: left, gray bg; Agent: right, brand bg; Bot: left, purple bg; System: centered, muted |
| **Message Meta** | Sender name + timestamp |
| **Composer** | Textarea + Send button (Ctrl+Enter shortcut) |
| **Sidebar Header** | "Realtime queue" kicker + "Assigned chats" title + "Play" button (primary, large) |
| **Filters** | Project dropdown + Status dropdown (Waiting/Assigned/Bot/Closed) |
| **Session Cards** | Unread badge (red), customer name, project-queue, last message preview, status text |
| **Empty State** | "Select a conversation or press Play to claim the oldest waiting customer chat" + Play button |
| **Loading** | 3-dot spinner cards in session list |

#### Interaction Patterns
- **Claim next (Play):** POST `/api/crm/chats/conversations/claim` → assigns oldest waiting → opens conversation
- **Select session:** Click session card → loads messages → marks read
- **Send reply:** Ctrl+Enter or Send button → POST `/api/crm/chats/conversations/{id}/messages`
- **Filter change:** Dropdown change → reloads session list with filters
- **Close conversation:** Click Close → updates status → returns to queue view
- **Auto-refresh:** Polls sessions every 5s when queue view active

#### Visual States
| State | Description |
|-------|-------------|
| **No conversation** | Empty state with large Play button |
| **Loading sessions** | Skeleton cards (3-dot pulse) |
| **Sending** | Send button disabled, "Sending..." text |
| **Unread indicator** | Red badge on session card with count |

---

### 15.9 Chat Projects (`/v3/chat-projects`)

---

## Production UX Delivery Notes: Collaboration and AI

Keep the collaboration, Process Assistant, live-chat, and chat-project behaviour above. Real-time delivery uses a managed WebSocket/SSE gateway or carefully isolated TypeScript connection service only after a signed, short-lived, tenant- and room-scoped authorization check. Presence and typing indicators are Redis-backed ephemeral data with TTL; a Redis outage degrades those indicators without losing messages. Messages, room membership, and unread state remain in PostgreSQL.

AI requests are authorized against the selected prompt profile and tenant, rate-limited by user/tenant, logged without prompt secrets or sensitive content, and subject to per-tenant budget/usage controls. Stream output through a Next.js Route Handler with cancellation, upstream timeout, size limits, and content safety handling. Store only approved conversation data under retention policy. Prompt profile edits, role mappings, and model changes are audit events. The current product does not imply autonomous AI actions; the assistant must not perform CRM mutations without a separately authorized, explicit command flow.

Widget/live-chat origins are allowlisted per tenant/project. Incoming Meta/widget events are verified webhooks and queued. Agents can view or reply only to conversations permitted by queue/project membership. Display third-party message content as text/sanitized rich text, never trusted markup.

**File:** `frontend/src/app/components/chat-projects/chat-projects.ts` (component not fully read, inferred from routes)

#### Visual Layout Structure
- **Project list view:** Card grid of chat projects
- **Project detail:** Tabs for Configuration, Workflows, Queues, API Credentials, Analytics
- **Widget Config:** Visual builder for chat widget (colors, position, welcome message, branding)

#### Key Features (from API)
- Multi-project management
- OAuth for Meta (Instagram/WhatsApp)
- Widget configuration with live preview
- Queue management per project
- API credentials per project
