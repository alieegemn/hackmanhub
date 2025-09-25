# Lua Obfuscator (Offline)

A minimal, offline, browser-based Lua obfuscator. Open index.html in your browser and paste your Lua source. Configure options and click Obfuscate.

Features (basic):
- Remove comments
- Minify whitespace
- Encode strings using string.char(...) with a small runtime helper
- Encode numbers as arithmetic expressions
- Optional: rename local identifiers (heuristic)
- Optional: inject a small junk prelude

Notes and limitations:
- This does not parse Lua into a full AST; it uses a tokenizer to preserve strings and comments, plus regex-based transforms for identifiers and numbers. Complex code may require testing/adjustments.
- Local renaming is heuristic and may not be safe for all scoping patterns. Test obfuscated output before distributing.
- Long bracket strings and long comments are supported by the tokenizer.

How to use:
1) Open index.html in any modern browser (no internet required).
2) Paste your Lua code in the left panel.
3) Pick options and press Obfuscate.
4) Copy or download the obfuscated output from the right panel.

Legitimate use only:
- Use this tool to protect your own code or for benign experimentation. Do not use it to hide malware, cheats, or to violate terms of service. You are responsible for how you use the output.

Troubleshooting:
- If obfuscated code errors, try disabling “Rename locals” and/or “Minify whitespace”, then re-enable incrementally.
- If you need stronger protection (e.g., control-flow flattening, table indirection for globals, randomized math expressions), those can be added, but they are not included to keep this app lightweight.

