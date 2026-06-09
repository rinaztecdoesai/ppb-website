#!/usr/bin/env python3
"""
Regenerate widgets.css from the ONE source of truth (styles.css).

The chatbot + slide-up CTA bar live in styles.css (used by the landing
pages). The content pages can't load all of styles.css (it would clash with
pp-pages.css), so this script extracts JUST the chatbot/CTA-bar rules — AND
the @keyframes they reference — into lp/shared/widgets.css. Class names are
unique, so no scoping is needed.

Run after changing the chatbot/CTA-bar in styles.css:
    python3 lp/shared/extract-widgets.py
then bump the widgets.css ?v= on the content pages.
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "styles.css"), encoding="utf-8").read()
src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)  # strip comments

KEEP = re.compile(r"chatbot|cta-bar|launcher|tease|\.cb-|bot-typing|bot-msg|\.bot\b|chat-")
def want(sel):
    return bool(KEEP.search(sel)) and "mma-callout" not in sel and "cookie" not in sel

def parse(s):
    """Return (css_text, set_of_animation_names) for matching rules + nested @media."""
    out, anims, i, N = [], set(), 0, len(s)
    while i < N:
        j = s.find("{", i)
        if j == -1:
            break
        header = s[i:j].strip()
        depth, k = 1, j + 1
        while k < N and depth:
            if s[k] == "{": depth += 1
            elif s[k] == "}": depth -= 1
            k += 1
        body = s[j + 1:k - 1]
        if header.startswith("@media") or header.startswith("@supports"):
            inner, a = parse(body)
            if inner.strip():
                out.append(header + " {\n" + inner + "\n}")
                anims |= a
        elif header.startswith("@"):
            pass  # keyframes handled separately
        else:
            sels = [x.strip() for x in header.split(",")]
            kept = [x for x in sels if want(x)]
            if kept:
                out.append(", ".join(kept) + " {" + body.strip() + "}")
                for m in re.findall(r"animation(?:-name)?:\s*([^;]+)", body):
                    for tok in re.split(r"[,\s]+", m.strip()):
                        if tok and not re.match(r"^[\d.]+m?s$", tok) and tok not in (
                            "infinite","ease","ease-in","ease-out","ease-in-out","linear",
                            "both","forwards","backwards","alternate","none","!important","normal"):
                            anims.add(tok)
        i = k
    return "\n".join(out), anims

rules, anims = parse(src)

# pull the @keyframes the kept rules actually use
kf = []
for name in sorted(anims):
    m = re.search(r"(@keyframes\s+" + re.escape(name) + r"\s*\{)", src)
    if not m:
        continue
    st = m.start(); depth = 0; k = src.find("{", st)
    j = k
    while j < len(src):
        if src[j] == "{": depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    kf.append(src[st:j + 1].strip())

hdr = ("/* Prime Property Buyers — shared widgets: Sarah chatbot + slide-up CTA bar.\n"
       "   AUTO-GENERATED from styles.css by extract-widgets.py — DO NOT edit by hand;\n"
       "   edit the chatbot/CTA-bar in styles.css then re-run the script.\n"
       "   Loaded on content pages alongside pp-pages.css (unique class names, no scoping).\n"
       "   Includes the @keyframes the widgets use so animations match the landing pages. */\n")
FOOTER = ("\n\n/* ---- content-page layout: reserve bottom space so the fixed CTA bar\n"
          "   slots in BELOW the footer instead of overlapping it (~bar footprint).\n"
          "   Landing pages handle this themselves via .brand-bar padding. ---- */\n"
          "body { padding-bottom: 96px; }\n")
out = hdr + rules + "\n\n/* ---- keyframes used by the widgets ---- */\n" + "\n".join(kf) + FOOTER
open(os.path.join(HERE, "widgets.css"), "w", encoding="utf-8").write(out)
print(f"widgets.css regenerated: {rules.count('{')} rules + {len(kf)} keyframes ({', '.join(sorted(anims))})")
