import { createAdminClient } from "@/utils/supabase/admin";
import { syncFromWebhook } from "@/actions/pluggy-sync";
import { NextResponse } from "next/server";
import crypto from "crypto";

// ==========================================
// PLUGGY WEBHOOK HANDLER
// ==========================================
// Receives notifications from Pluggy when there are new transactions,
// item updates, or connection changes.
// Docs: https://docs.pluggy.ai/docs/webhooks
//
// SECURITY: Pluggy does NOT send a native signature header.
// We validate via a secret query parameter appended to the webhook URL.
// In the Pluggy Dashboard, configure the URL as:
//   https://your-domain.com/api/webhooks/pluggy?secret=YOUR_SECRET
//
// Set PLUGGY_WEBHOOK_SECRET in your environment variables (Vercel).
//
// IMPORTANT: Must respond 200 within 5 seconds.

const WEBHOOK_SECRET = process.env.PLUGGY_WEBHOOK_SECRET;

// ---- Reject non-POST methods ----
export function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

/**
 * Validates the ?secret= query parameter against PLUGGY_WEBHOOK_SECRET.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifySecret(url: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn(
      "[Pluggy Webhook] PLUGGY_WEBHOOK_SECRET not set — skipping auth. " +
        "Set this in production!"
    );
    return true;
  }

  const { searchParams } = new URL(url);
  const secret = searchParams.get("secret");
  if (!secret) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(secret),
      Buffer.from(WEBHOOK_SECRET)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // ---- Step 0: Validate secret before any DB access ----
  if (!verifySecret(request.url)) {
    console.error("[Pluggy Webhook] Unauthorized: invalid or missing secret");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  try {
    const payload = await request.json();
    const event = payload.event;

    console.log("[Pluggy Webhook] Event:", event, "ItemId:", payload.itemId);

    // 1. Log the event for auditing (non-blocking)
    supabase
      .from("webhook_logs")
      .insert([
        {
          provider: "pluggy",
          event_type: event,
          payload,
          status: "received",
        },
      ])
      .then(({ error }) => {
        if (error) console.error("[Pluggy Webhook] Log insert error:", error);
      });

    // 2. Process based on event type
    switch (event) {
      // ---- ITEM EVENTS ----
      case "item/created":
      case "item/updated": {
        // Item connected or synced — transactions will come via transactions/created
        console.log(`[Pluggy Webhook] Item ${event}:`, payload.itemId);
        break;
      }

      case "item/error": {
        console.error("[Pluggy Webhook] Item error:", payload.error);
        // Update connection status
        await supabase
          .from("pluggy_connections")
          .update({ status: "error" })
          .eq("pluggy_item_id", payload.itemId);
        break;
      }

      // ---- TRANSACTION EVENTS ----
      case "transactions/created": {
        const { itemId, accountId } = payload;
        console.log(
          `[Pluggy Webhook] New transactions for item ${itemId}, account ${accountId}`
        );

        // Sync transactions from Pluggy to our DB
        // This uses the admin client internally and maps Pluggy → FWM format
        const result = await syncFromWebhook(
          itemId,
          accountId,
          payload.createdTransactionsLink
        );

        if ('error' in result) {
          console.error("[Pluggy Webhook] Sync failed:", result.error);
        } else if ('inserted' in result) {
          console.log(
            `[Pluggy Webhook] Synced: ${result.inserted} new, ${result.skipped} dupes`
          );
        }

        // Update webhook log status
        await supabase
          .from("webhook_logs")
          .update({ status: "processed" })
          .eq("payload->>eventId", payload.eventId);
        break;
      }

      case "transactions/updated": {
        const { itemId, accountId, transactionIds } = payload;
        console.log(
          `[Pluggy Webhook] Updated transactions:`,
          transactionIds?.length
        );

        // Re-sync to pick up updated data
        await syncFromWebhook(itemId, accountId);
        break;
      }

      case "transactions/deleted": {
        const { transactionIds } = payload;
        if (transactionIds?.length > 0) {
          // Delete from our DB matching pluggy_transaction_id
          const { error: delError } = await supabase
            .from("transacoes")
            .delete()
            .in("pluggy_transaction_id", transactionIds);

          if (delError) {
            console.error("[Pluggy Webhook] Delete error:", delError);
          } else {
            console.log(
              `[Pluggy Webhook] Deleted ${transactionIds.length} transactions`
            );
          }
        }
        break;
      }

      default:
        console.log("[Pluggy Webhook] Unhandled event:", event);
    }

    // Respond 200 immediately (Pluggy requires < 5 seconds)
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Pluggy Webhook] Error:", error);
    // Still return 200 to avoid retries for parsing errors
    return NextResponse.json({ received: true, error: error.message });
  }
}

