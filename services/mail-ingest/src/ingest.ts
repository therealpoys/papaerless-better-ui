import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PaperlessClient } from "@papaerless/paperless-client";
import { env } from "./env.js";
import { processedStore } from "./processed-store.js";

const paperless = new PaperlessClient({
  baseUrl: env.paperlessUrl,
  apiToken: env.paperlessApiToken,
});

const ATTACHMENT_ALLOWLIST = [/^application\/pdf$/, /^image\//];

function isUploadable(contentType: string): boolean {
  return ATTACHMENT_ALLOWLIST.some((pattern) => pattern.test(contentType));
}

export async function runIngestCycle(): Promise<{ uploaded: number; skipped: number }> {
  const client = new ImapFlow({
    host: env.imapHost!,
    port: env.imapPort,
    secure: true,
    auth: { user: env.imapUser!, pass: env.imapPassword! },
    logger: false,
  });

  let uploaded = 0;
  let skipped = 0;

  await client.connect();
  const lock = await client.getMailboxLock(env.imapFolder);

  try {
    const uids = await client.search({ seen: false });
    if (!uids) return { uploaded, skipped };

    for (const uid of uids) {
      const message = await client.fetchOne(uid, { source: true, envelope: true });
      if (!message || !message.source) continue;

      const messageId = message.envelope?.messageId ?? `uid-${uid}`;
      if (await processedStore.has(messageId)) {
        await client.messageFlagsAdd(uid, ["\\Seen"]);
        continue;
      }

      const parsed = await simpleParser(message.source);
      const attachments = parsed.attachments.filter((a) => isUploadable(a.contentType));

      for (const attachment of attachments) {
        const fileName = attachment.filename ?? `${messageId}-${attachment.checksum}.pdf`;
        await paperless.uploadDocument(
          new Blob([attachment.content], { type: attachment.contentType }),
          fileName,
        );
        uploaded += 1;
      }

      if (attachments.length === 0) skipped += 1;

      await processedStore.add(messageId);
      await client.messageFlagsAdd(uid, ["\\Seen"]);
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return { uploaded, skipped };
}
