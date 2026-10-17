import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { CheckedClaim, RuleFinding } from "./types.ts";

const severity = z.enum(["violation", "warning"]);

const Rule = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("require"),
    pattern: z.string(),
    message: z.string(),
    severity: severity.default("violation"),
  }),
  z.object({
    id: z.string(),
    type: z.literal("forbid"),
    words: z.array(z.string()).min(1),
    message: z.string(),
    severity: severity.default("warning"),
    "unless-supported": z.boolean().default(false),
  }),
  z.object({
    id: z.string(),
    type: z.literal("max-length"),
    max: z.number().int().positive(),
    severity: severity.default("violation"),
  }),
]);

const Pack = z.object({
  pack: z.string(),
  extends: z.literal("fda-core").optional(),
  rules: z.array(Rule),
});

export type Rule = z.infer<typeof Rule>;
export type RulePack = z.infer<typeof Pack>;

const SAFETY_INFORMATION = "important safety information|safety information";

export function carriesSafetyInformation(piece: string): boolean {
  return new RegExp(SAFETY_INFORMATION, "i").test(piece);
}

export const FDA_CORE: RulePack = Pack.parse({
  pack: "fda-core",
  rules: [
    {
      id: "isi.present",
      type: "require",
      pattern: SAFETY_INFORMATION,
      message: "No Important Safety Information on the piece.",
    },
    {
      id: "claims.superlatives",
      type: "forbid",
      words: ["best", "safest", "fastest", "only", "cure", "cures", "guaranteed", "miracle", "breakthrough"],
      message: "Superlative language needs a head-to-head result in the label.",
      "unless-supported": true,
    },
  ],
});

export function loadPack(yamlText: string): RulePack {
  const pack = Pack.parse(parseYaml(yamlText));
  return pack.extends ? { ...pack, rules: [...FDA_CORE.rules, ...pack.rules] } : pack;
}

function wordPattern(words: readonly string[]): RegExp {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

export function runRules(pack: RulePack, piece: string, claims: readonly CheckedClaim[]): RuleFinding[] {
  const findings: RuleFinding[] = [];
  for (const rule of pack.rules) {
    if (rule.type === "require") {
      if (!new RegExp(rule.pattern, "i").test(piece)) {
        findings.push({ rule: rule.id, severity: rule.severity, message: rule.message });
      }
    } else if (rule.type === "max-length") {
      if (piece.trim().length > rule.max) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          message: `${piece.trim().length} characters, over the ${rule.max} limit.`,
        });
      }
    } else {
      const pattern = wordPattern(rule.words);
      for (const match of piece.matchAll(pattern)) {
        const at = match.index ?? 0;
        const covering = claims.find((c) => c.start <= at && at < c.end);
        if (rule["unless-supported"] && covering?.verdict === "supported") continue;
        findings.push({ rule: rule.id, severity: rule.severity, message: `"${match[0]}": ${rule.message}` });
      }
    }
  }
  return findings;
}
