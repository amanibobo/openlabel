---
name: hcp-sms
description: Write short text messages to physicians from approved long-form copy, each under 160 characters, on-label, and carrying a safety information link. Use when someone asks for SMS, text message, or short-form variants of an email or piece for HCPs.
---

# HCP SMS

Text messages to physicians are promotion. Every word still has to be on-label, and each message needs a link to current safety information because 160 characters cannot carry it.

## Steps

1. Read the approved source the user gives you. Every claim in a message must come from that source, in its words or shorter. Do not add claims the source does not make.
2. Get the safety link from the user. If they did not give one, write `[ISI link]` in its place and say so in your reply.
3. Write three variants unless asked for a different number. Each one:
   - is at most 160 characters, link included;
   - makes one claim, not three;
   - names the drug;
   - ends with the safety link;
   - has no superlatives ("best", "only", "fastest") and no promise the label does not make, such as getting patients back to normal life.
4. Save each variant to its own file and run `openlabel check <file> --label <drug> --rules <sms pack>` on it. The openlabel repo ships an SMS pack at `examples/pulse-sms.yaml`; use the user's own pack if they name one.
5. Fix any variant that comes back overstated, off-label or unsupported, or that breaks a rule, and check it again. Drop it if it cannot be fixed without losing its point.

## Reply

List the variants that passed, each with its character count and the claim's citation. Below them, note any variant you dropped and why. Never present a variant you have not checked.
