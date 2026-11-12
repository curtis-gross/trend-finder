import { ActivityAction, ActivityEvent } from '../types';
import { brandConfig } from '../config';

export type { ActivityEvent, ActivityAction };

/** Payload a studio supplies; id + timestamp are stamped server-side. */
export type ActivityEventInput = Omit<ActivityEvent, 'id' | 'timestamp'>;

const DEFAULT_COMPANY = brandConfig?.companyName || 'test-company';

/**
 * Appends an activity event to the canonical GCS ledger.
 *
 * Fire-and-forget contract: this NEVER throws into the calling studio and never
 * blocks the primary workflow's success path. On failure it logs the REAL
 * error — no silent swallow, no fabricated success.
 *
 * Only call this after a genuine success (the real Gemini/GCS call resolved).
 */
export async function logActivity(
  event: ActivityEventInput,
  companyName?: string
): Promise<void> {
  try {
    const payload = {
      companyName: companyName || DEFAULT_COMPANY,
      event: {
        ...event,
        label: event.label || event.mode,
        meta: event.meta || {}
      }
    };

    const res = await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body?.error || body?.message || detail;
      } catch {
        try {
          detail = (await res.text()) || detail;
        } catch {
          /* response body unreadable; keep HTTP status detail */
        }
      }
      console.error(
        `[activityService] Failed to log activity (${event.mode}/${event.action}): ${detail}`
      );
    }
  } catch (err: any) {
    console.error(
      `[activityService] Network error logging activity (${event?.mode}/${event?.action}):`,
      err
    );
  }
}
