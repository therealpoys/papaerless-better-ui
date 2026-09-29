import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  upload: vi.fn(),
  has: vi.fn(),
  add: vi.fn(),
  imap: {
    connect: vi.fn(),
    getMailboxLock: vi.fn(),
    search: vi.fn(),
    fetchOne: vi.fn(),
    messageFlagsAdd: vi.fn(),
    logout: vi.fn(),
  },
  parse: vi.fn(),
  release: vi.fn(),
}));

vi.mock("imapflow", () => ({ ImapFlow: vi.fn(() => m.imap) }));
vi.mock("mailparser", () => ({ simpleParser: m.parse }));
vi.mock("@papaerless/paperless-client", () => ({
  PaperlessClient: vi.fn(() => ({ uploadDocument: m.upload })),
}));
vi.mock("../src/processed-store.js", () => ({ processedStore: { has: m.has, add: m.add } }));
vi.mock("../src/env.js", () => ({
  env: {
    paperlessUrl: "http://paperless.test",
    paperlessApiToken: "t",
    imapHost: "imap.test",
    imapPort: 993,
    imapUser: "u",
    imapPassword: "p",
    imapFolder: "INBOX",
  },
}));

import { runIngestCycle } from "../src/ingest.js";

const msg = (messageId: string) => ({ source: Buffer.from("x"), envelope: { messageId } });
const att = (contentType: string, filename?: string) => ({
  contentType,
  filename,
  checksum: "abc",
  content: Buffer.from("data"),
});

beforeEach(() => {
  vi.resetAllMocks();
  m.imap.getMailboxLock.mockResolvedValue({ release: m.release });
  m.has.mockResolvedValue(false);
});

describe("runIngestCycle", () => {
  it("lädt nur PDF/Bild-Anhänge hoch und markiert die Mail als verarbeitet", async () => {
    m.imap.search.mockResolvedValue([1]);
    m.imap.fetchOne.mockResolvedValue(msg("<1@x>"));
    m.parse.mockResolvedValue({
      attachments: [att("application/pdf", "a.pdf"), att("image/png", "b.png"), att("text/plain", "c.txt")],
    });

    const result = await runIngestCycle();

    expect(result).toEqual({ uploaded: 2, skipped: 0 });
    expect(m.upload).toHaveBeenCalledTimes(2);
    expect(m.upload.mock.calls.map((c) => c[1])).toEqual(["a.pdf", "b.png"]);
    expect(m.add).toHaveBeenCalledWith("<1@x>");
    expect(m.imap.messageFlagsAdd).toHaveBeenCalledWith(1, ["\\Seen"]);
    expect(m.release).toHaveBeenCalled();
    expect(m.imap.logout).toHaveBeenCalled();
  });

  it("zählt Mails ohne passende Anhänge als übersprungen", async () => {
    m.imap.search.mockResolvedValue([1]);
    m.imap.fetchOne.mockResolvedValue(msg("<2@x>"));
    m.parse.mockResolvedValue({ attachments: [att("text/html")] });

    expect(await runIngestCycle()).toEqual({ uploaded: 0, skipped: 1 });
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.add).toHaveBeenCalledWith("<2@x>");
  });

  it("überspringt bereits verarbeitete Mails ohne Upload", async () => {
    m.has.mockResolvedValue(true);
    m.imap.search.mockResolvedValue([3]);
    m.imap.fetchOne.mockResolvedValue(msg("<3@x>"));

    expect(await runIngestCycle()).toEqual({ uploaded: 0, skipped: 0 });
    expect(m.parse).not.toHaveBeenCalled();
    expect(m.imap.messageFlagsAdd).toHaveBeenCalledWith(3, ["\\Seen"]);
  });

  it("gibt Lock und Verbindung auch bei Fehlern frei", async () => {
    m.imap.search.mockResolvedValue([1]);
    m.imap.fetchOne.mockResolvedValue(msg("<4@x>"));
    m.parse.mockResolvedValue({ attachments: [att("application/pdf", "a.pdf")] });
    m.upload.mockRejectedValue(new Error("boom"));

    await expect(runIngestCycle()).rejects.toThrow("boom");
    expect(m.release).toHaveBeenCalled();
    expect(m.imap.logout).toHaveBeenCalled();
    expect(m.add).not.toHaveBeenCalled();
  });
});
