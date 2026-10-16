import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseSpl } from "./spl.ts";
import { asSetId, type Label, type SetId } from "./types.ts";

const BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";

export type Fetch = (url: string) => Promise<Response>;

export type LabelSummary = { setId: SetId; title: string; version: number; published: string };

export type DailyMed = {
  search(drugName: string): Promise<LabelSummary[]>;
  versions(setId: SetId): Promise<{ version: number; published: string }[]>;
  label(setId: SetId): Promise<Label>;
  resolve(query: string): Promise<Label>;
};

export function defaultCacheDir(): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "openlabel", "labels");
}

async function getJson(fetchFn: Fetch, url: string): Promise<unknown> {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`DailyMed returned ${response.status} for ${url}`);
  return response.json();
}

export function dailyMed(options: { fetch?: Fetch; cacheDir?: string } = {}): DailyMed {
  const fetchFn = options.fetch ?? ((url) => fetch(url));
  const cacheDir = options.cacheDir ?? defaultCacheDir();

  async function search(drugName: string): Promise<LabelSummary[]> {
    const url = `${BASE}/spls.json?drug_name=${encodeURIComponent(drugName)}&pagesize=20`;
    const body = (await getJson(fetchFn, url)) as {
      data: { setid: string; title: string; spl_version: number; published_date: string }[];
    };
    return body.data.map((d) => ({
      setId: asSetId(d.setid),
      title: d.title,
      version: d.spl_version,
      published: d.published_date,
    }));
  }

  async function versions(setId: SetId) {
    const body = (await getJson(fetchFn, `${BASE}/spls/${setId}/history.json`)) as {
      data: { history: { spl_version: number; published_date: string }[] };
    };
    return body.data.history.map((h) => ({ version: h.spl_version, published: h.published_date }));
  }

  async function label(setId: SetId): Promise<Label> {
    const [latest] = await versions(setId);
    const path = latest ? join(cacheDir, setId, `${latest.version}.xml`) : undefined;
    if (path) {
      const cached = await readFile(path, "utf8").catch(() => undefined);
      if (cached) return parseSpl(cached);
    }
    const response = await fetchFn(`${BASE}/spls/${setId}.xml`);
    if (!response.ok) throw new Error(`DailyMed returned ${response.status} for label ${setId}`);
    const xml = await response.text();
    const parsed = parseSpl(xml);
    await mkdir(join(cacheDir, setId), { recursive: true });
    await writeFile(join(cacheDir, setId, `${parsed.version}.xml`), xml);
    return parsed;
  }

  async function resolve(query: string): Promise<Label> {
    if (/^[0-9a-f-]{36}$/i.test(query)) return label(asSetId(query));
    const wanted = query.toLowerCase();
    // "KEYTRUDA (" beats "KEYTRUDA QLEX (", and the manufacturer's own label carries far
    // more versions than a repackager's copy of it.
    const score = (r: LabelSummary) => {
      const title = r.title.toLowerCase();
      return (title.startsWith(`${wanted} (`) ? 2 : title.startsWith(wanted) ? 1 : 0) * 1e6 + r.version;
    };
    const [match] = (await search(query)).sort((a, b) => score(b) - score(a));
    if (!match) throw new Error(`no DailyMed label matches "${query}"`);
    return label(match.setId);
  }

  return { search, versions, label, resolve };
}
