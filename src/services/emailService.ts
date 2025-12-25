import { ImapFlow, ImapFlowOptions } from 'imapflow';
import { parseCalendarInvite } from './calendarInviteProcessor';
import { googleCalendarRepository } from '../repositories/googleCalendarRepository';
import { messagingService } from './messagingService';

export class EmailService {
    private client: ImapFlow;
    private isMonitoring: boolean = false;
    private reconnecting: boolean = false;
    private pollingInterval: NodeJS.Timeout | null = null;
    private readonly POLLING_INTERVAL_MS = 30000; // Check every 30 seconds (reduced for testing)

    constructor(private config: ImapFlowOptions) {
        this.client = new ImapFlow({
            ...config,
            logger: false,
        });
    }

    /* -----------------------------------------------------------
     * CONNECT
     * -----------------------------------------------------------*/
    async connect(): Promise<void> {
        try {
            await this.client.connect();
            console.log("Connected to email server");

            this.attachConnectionHandlers();
        } catch (error) {
            console.error("Failed to connect to email server:", error);
            throw error;
        }
    }

    /* -----------------------------------------------------------
     * START MONITORING
     * -----------------------------------------------------------*/
    async startMonitoring(): Promise<void> {
        if (this.isMonitoring) return;

        try {
            // Open mailbox with IDLE support
            const mailboxInfo = await this.client.mailboxOpen("INBOX");
            console.log(`📬 Mailbox opened. Total messages: ${mailboxInfo.exists}`);

            this.isMonitoring = true;

            console.log("Processing unread messages on startup...");
            await this.processNewMessages();

            // Set up multiple event listeners for better detection
            this.client.on("exists", async (data) => {
                console.log("📩 EXISTS event fired - New message count:", data.count);
                await this.processNewMessages();
            });

            // Listen for flag changes (useful for debugging)
            this.client.on("flags", (data) => {
                console.log("🚩 FLAGS event:", data);
            });

            // Listen for expunge events
            this.client.on("expunge", (data) => {
                console.log("🗑️ EXPUNGE event:", data);
            });

            // Fallback: Poll periodically in case IDLE fails
            this.startPolling();

            console.log("📡 Email monitoring started (IDLE + polling)");
        } catch (error) {
            console.error("Error starting email monitoring:", error);
            this.isMonitoring = false;
            throw error;
        }
    }

    /* -----------------------------------------------------------
     * START IDLE MODE
     * -----------------------------------------------------------*/
    private async startIdleMode(): Promise<void> {
        try {
            if (!this.client.usable || !this.isMonitoring) return;

            // ImapFlow automatically handles IDLE internally
            // But we can force it to stay in IDLE by calling idle()
            console.log("📬 Starting IDLE mode...");

            // Note: ImapFlow handles IDLE automatically, but you can also call:
            // await this.client.idle();
            // However, this is not needed as ImapFlow auto-idles when not busy
        } catch (error) {
            console.error("Error starting IDLE mode:", error);
        }
    }

    /* -----------------------------------------------------------
     * START POLLING (FALLBACK)
     * -----------------------------------------------------------*/
    private startPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(async () => {
            if (this.isMonitoring && this.client.usable) {
                console.log("🔍 Polling for new messages...");
                await this.processNewMessages();
            }
        }, this.POLLING_INTERVAL_MS);

        console.log(`⏰ Polling enabled (every ${this.POLLING_INTERVAL_MS / 1000}s)`);
    }

    /* -----------------------------------------------------------
     * STOP MONITORING
     * -----------------------------------------------------------*/
    async stopMonitoring(): Promise<void> {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        this.client.removeAllListeners("exists");
        this.client.removeAllListeners("flags");
        this.client.removeAllListeners("expunge");

        // Stop polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        console.log("Stopped monitoring email");
    }

    /* -----------------------------------------------------------
     * PROCESS MESSAGES
     * -----------------------------------------------------------*/
    async processNewMessages(): Promise<void> {
        if (!this.client || !this.client.usable) {
            console.warn("Skipping message processing: IMAP not connected");
            return;
        }

        const startTime = Date.now();
        console.log("🔎 processNewMessages - searching for unseen messages...");

        try {
            // First, search for UNSEEN messages
            const unseenUids: any = await this.client.search({ seen: false }, { uid: true });

            console.log(`Found ${unseenUids.length} unseen message(s) in ${Date.now() - startTime}ms`);

            if (!unseenUids || unseenUids.length === 0) {
                return;
            }

            console.log(`Fetching UIDs: ${unseenUids.join(', ')}`);

            // Collect all messages first
            const messageList: any[] = [];
            const messages = this.client.fetch(unseenUids, {
                envelope: true,
                source: true,
                flags: true
            }, { uid: true });

            for await (const msg of messages) {
                messageList.push(msg);
            }

            console.log(`Fetched ${messageList.length} messages, processing...`);

            let processed = 0;
            let skipped = 0;

            // Process each message sequentially
            for (const msg of messageList) {
                try {
                    console.log(`Processing UID ${msg.uid}, Subject: ${msg.envelope?.subject || 'N/A'}`);

                    if (!msg.source) {
                        console.log(`  ⚠️ No source content for UID ${msg.uid}`);
                        skipped++;
                        continue;
                    }

                    const raw = msg.source.toString("utf-8");

                    // Attempt to parse calendar invite (supports ICS and fallback cases)
                    let calendarEvent = await parseCalendarInvite(raw);
                    console.log("calendarEvent", calendarEvent);
                    if (calendarEvent) {
                        console.log(`  📅 Found calendar event: ${calendarEvent.summary}`);
                        const savedCalendarEvent: any = await googleCalendarRepository.upsertFromParsedInvite(calendarEvent);
                        if (savedCalendarEvent.previousStart) {
                            calendarEvent = {
                                ...calendarEvent,
                                previousStart: savedCalendarEvent.previousStart,
                                previousEnd: savedCalendarEvent.previousEnd
                            };
                        }
                        await messagingService.sendCalendarEventsMessage([calendarEvent]);
                        await googleCalendarRepository.markMessagesSentByEventIds([calendarEvent.eventId]);
                        // Mark as seen after successful processing
                        await this.client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
                        console.log(`  ✓ Marked UID ${msg.uid} as seen`);

                        processed++;
                    } else {
                        console.log(`  ⚠️ Failed to parse calendar invite from UID ${msg.uid}`);
                        skipped++;
                    }
                } catch (msgError) {
                    console.error(`  ❌ Error processing UID ${msg.uid}:`, msgError);
                    skipped++;
                }
            }

            console.log(`✅ Processed ${processed} calendar invites, skipped ${skipped} messages (${Date.now() - startTime}ms)`);
        } catch (error) {
            console.error("Error processing new messages:", error);
        }
    }


    /* -----------------------------------------------------------
     * MANUAL TRIGGER (for testing/debugging)
     * -----------------------------------------------------------*/
    async manualCheck(): Promise<{ processed: number; unseenCount: number }> {
        console.log("🔧 Manual check triggered");
        const unseenUids: any = await this.client.search({ seen: false }, { uid: true });
        await this.processNewMessages();
        return { processed: 0, unseenCount: unseenUids.length };
    }

    /* -----------------------------------------------------------
     * DISCONNECT
     * -----------------------------------------------------------*/
    async disconnect(): Promise<void> {
        await this.stopMonitoring();
        try {
            await this.client.logout();
        } catch { }
        console.log("Disconnected from IMAP");
    }

    /* -----------------------------------------------------------
     * ATTACH ERROR + RECONNECT HANDLERS
     * -----------------------------------------------------------*/
    private attachConnectionHandlers() {
        this.client.on("error", (err) => {
            console.error("IMAP Error:", err);
        });

        this.client.on("close", () => {
            console.warn("⚠️ IMAP connection closed");
            this.reconnect();
        });
    }

    /* -----------------------------------------------------------
     * RECONNECT HANDLER
     * -----------------------------------------------------------*/
    private async reconnect(): Promise<void> {
        if (this.reconnecting) return;
        this.reconnecting = true;

        console.log("🔄 Reconnecting IMAP in 3 seconds...");
        await new Promise(res => setTimeout(res, 3000));

        try {
            await this.disconnect();

            // Create a new IMAPFlow client
            this.client = new ImapFlow({
                ...this.config,
                logger: false
            });

            await this.connect();
            await this.startMonitoring();

            console.log("✅ Reconnected to IMAP");
        } catch (err) {
            console.error("❌ Reconnect failed. Retrying in 5 sec...", err);
            setTimeout(() => this.reconnect(), 5000);
        } finally {
            this.reconnecting = false;
        }
    }
}