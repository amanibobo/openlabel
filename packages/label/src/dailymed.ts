import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { parseSpl } from "./spl.ts";
import { asSetId, type Label, type SetId } from "./types.ts";

const BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";
const FILES = "https://dailymed.nlm.nih.gov/dailymed/getFile.cfm";

export type Fetch = (url: string) => Promise<Response>;

export type LabelSummary = { setId: SetId; title: string; version: number; published: string };

export type DailyMed = {
  search(drugName: string): Promise<LabelSummary[]>;
  versions(setId: SetId): Promise<{ version: number; published: string }[]>;
  label(setId: SetId, version?: number): Promise<Label>;
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

  async function download(setId: SetId, version: number | undefined): Promise<string> {
    if (version === undefined) {
      const response = await fetchFn(`${BASE}/spls/${setId}.xml`);
      if (!response.ok) throw new Error(`DailyMed returned ${response.status} for label ${setId}`);
      return response.text();
    }
    // The XML endpoint only serves the current version; past versions come zipped.
    const response = await fetchFn(`${FILES}?setid=${setId}&type=zip&version=${version}`);
    if (!response.ok) throw new Error(`DailyMed returned ${response.status} for ${setId} version ${version}`);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()), { filter: (f) => f.name.endsWith(".xml") });
    const [xml] = Object.values(files);
    if (!xml) throw new Error(`DailyMed's archive for ${setId} version ${version} has no SPL file`);
    return strFromU8(xml);
  }

  async function label(setId: SetId, version?: number): Promise<Label> {
    const wanted = version ?? (await versions(setId))[0]?.version;
    const path = wanted === undefined ? undefined : join(cacheDir, setId, `${wanted}.xml`);
    if (path) {
      const cached = await readFile(path, "utf8").catch(() => undefined);
      if (cached) return parseSpl(cached);
    }
    const xml = await download(setId, version);
    const parsed = parseSpl(xml);
    if (version !== undefined && parsed.version !== version) {
      throw new Error(`asked DailyMed for version ${version} of ${setId} and got ${parsed.version}`);
    }
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
