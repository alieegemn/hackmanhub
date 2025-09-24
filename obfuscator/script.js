// Lua/Luau obfuscator (client-only)
// Features: remove comments, optional local renaming, string obfuscation with decoder, minification.
// Use for legitimate purposes only.

(function(){
  // Config (edit in file)
  const BANNER = '----- HackManHub Obfuscator Beta -----';
  const ROBLOX_MODE = true;

  // UI hooks
  const $ = (id)=>document.getElementById(id);
  const inputEl = $("input");
  const outputEl = $("output");
  const seedEl = $("seed");
  const optRenameEl = $("optRename");
  const optStrEl = $("optStr");
  const optMinEl = $("optMin");
  const optDoubleEl = $("optDouble");
  const optADEl = $("optAD");
  const btnObfuscate = $("btnObfuscate");
  const btnCopy = $("btnCopy");
  const btnDownload = $("btnDownload");
  const btnExample = $("btnExample");
  const btnClear = $("btnClear");

  // Seeded RNG (mulberry32)
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngInt(rng, lo, hi) { // inclusive
    const x = rng();
    return Math.floor(x * (hi - lo + 1)) + lo;
  }

  // Tokenizer
  function tokenize(lua) {
    const tokens = [];
    let i = 0; const n = lua.length;
    const startswith = (s)=> lua.startsWith(s, i);

    while (i < n) {
      const c = lua[i];
      // whitespace
      if (/\s/.test(c)) {
        let j = i+1; while (j < n && /\s/.test(lua[j])) j++;
        tokens.push(["ws", lua.slice(i,j)]); i = j; continue;
      }
      // comments
      if (startswith("--")) {
        // long comment? --[[ ... ]] or --[=*[ ... ]=*]
        if (startswith("--[[")) {
          let k = i + 4; while (k < n && !lua.startsWith("]]", k)) k++;
          k = Math.min(k + 2, n);
          tokens.push(["comment", lua.slice(i,k)]); i = k; continue;
        }
        const m = lua.slice(i).match(/^--(=*)\[/);
        if (m) {
          const eqs = m[1];
          const openPat = "--[" + eqs + "[";
          const closePat = "]" + eqs + "]";
          let j = i + openPat.length;
          let k = j; while (k < n && !lua.startsWith(closePat, k)) k++;
          k = Math.min(k + closePat.length, n);
          tokens.push(["comment", lua.slice(i,k)]); i = k; continue;
        }
        // single-line
        let j = i + 2; while (j < n && lua[j] !== '\n') j++;
        tokens.push(["comment", lua.slice(i,j)]); i = j; continue;
      }
      // long bracket string [=*[ ... ]=*]
      if (c === "[") {
        const m = lua.slice(i).match(/^\[(=*)\[/);
        if (m) {
          const eqs = m[1];
          const openPat = "[" + eqs + "[";
          const closePat = "]" + eqs + "]";
          let j = i + openPat.length;
          let k = j; while (k < n && !lua.startsWith(closePat, k)) k++;
          k = Math.min(k + closePat.length, n);
          tokens.push(["longstr", lua.slice(i,k)]); i = k; continue;
        }
      }
      // short strings
      if (c === '"' || c === "'") {
        const quote = c; let j = i + 1; let escaped = false;
        while (j < n) {
          const cj = lua[j];
          if (escaped) { escaped = false; j++; continue; }
          if (cj === '\\') { escaped = true; j++; continue; }
          if (cj === quote) { j++; break; }
          j++;
        }
        tokens.push(["str", lua.slice(i,j)]); i = j; continue;
      }
      // number
      if (/[0-9]/.test(c) || (c === "." && (i+1) < n && /[0-9]/.test(lua[i+1]))) {
        let j = i + 1;
        while (j < n && /[0-9A-Za-zxX\.\+\-\_]/.test(lua[j])) j++;
        tokens.push(["num", lua.slice(i,j)]); i = j; continue;
      }
      // identifier/keyword
      if (/[A-Za-z_]/.test(c)) {
        let j = i + 1; while (j < n && /[A-Za-z0-9_]/.test(lua[j])) j++;
        const val = lua.slice(i,j);
        if (LUA_KEYWORDS.has(val)) tokens.push(["kw", val]); else tokens.push(["ident", val]);
        i = j; continue;
      }
      // symbols
      tokens.push(["sym", c]); i++; continue;
    }
    return tokens;
  }

  const LUA_KEYWORDS = new Set([
    "and","break","do","else","elseif","end","false","for","function","if","in",
    "local","nil","not","or","repeat","return","then","true","until","while",
    "continue","type","typeof","export"
  ]);

  function removeComments(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t[0] === "comment") {
        // Preserve a separator to avoid token gluing like "endlocal"
        const prev = out.length ? out[out.length - 1] : null;
        const next = tokens[i + 1] || null;
        if (prev && prev[0] !== "ws" && next && next[0] !== "ws") out.push(["ws", " "]);
        continue;
      }
      out.push(t);
    }
    return out;
  }

  function isFieldAccess(prevTok) {
    return prevTok && prevTok[0] === "sym" && (prevTok[1] === "." || prevTok[1] === ":");
  }

  function renameLocals(tokens, seed) {
    const rng = mulberry32((seed >>> 0) || 1337);
    const out = [];
    const scopeStack = [ Object.create(null) ];
    let nameCounter = 0;
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    function newName() {
      let s = ""; let n = nameCounter++;
      do { s = alphabet[n % 26] + s; n = Math.floor(n / 26); } while (n > 0);
      return "_" + s;
    }
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      const prevTok = out.length ? out[out.length - 1] : null;
      // Enter scopes
      if ((tok[0]==="kw" && (tok[1]==="function" || tok[1]==="do" || tok[1]==="then" || tok[1]==="repeat"))) {
        out.push(tok); scopeStack.push(Object.create(null)); i++; continue;
      }
      // Exit scopes
      if ((tok[0]==="kw" && (tok[1]==="end" || tok[1]==="until"))) {
        out.push(tok); if (scopeStack.length>1) scopeStack.pop(); i++; continue;
      }
      // local declarations
      if (tok[0]==="kw" && tok[1]==="local") {
        out.push(tok); i++;
        if (i < tokens.length && tokens[i][0]==="kw" && tokens[i][1]==="function") {
          out.push(tokens[i]); i++;
          if (i < tokens.length && tokens[i][0]==="ident") {
            const name = tokens[i][1]; const nn = newName(); scopeStack[scopeStack.length-1][name] = nn; out.push(["ident", nn]); i++;
          }
          continue;
        }
        // local x, y, z = ...
        while (i < tokens.length) {
          const t = tokens[i];
          if (t[0] === "ident") { const nn = newName(); scopeStack[scopeStack.length-1][t[1]] = nn; out.push(["ident", nn]); i++; continue; }
          if (t[0] === "ws" || (t[0] === "sym" && t[1] === ",")) { out.push(t); i++; continue; }
          out.push(t); i++; break;
        }
        continue;
      }
      if (tok[0] === "ident") {
        if (isFieldAccess(prevTok)) { out.push(tok); i++; continue; }
        let replacement = null;
        for (let s = scopeStack.length - 1; s >= 0; s--) {
          const map = scopeStack[s];
          if (Object.prototype.hasOwnProperty.call(map, tok[1])) { replacement = map[tok[1]]; break; }
        }
        out.push(replacement ? ["ident", replacement] : tok); i++; continue;
      }
      out.push(tok); i++;
    }
    return out;
  }

  function decodeEscapeSequences(s) {
    const out = [];
    for (let i=0;i<s.length;i++){
      const c = s[i];
      if (c !== '\\') { out.push(c.charCodeAt(0)); continue; }
      i++; if (i>=s.length) break; const e = s[i];
      if (e === '\\' || e === '"' || e === "'") out.push(e.charCodeAt(0));
      else if (e === 'n') out.push(10);
      else if (e === 'r') out.push(13);
      else if (e === 't') out.push(9);
      else if (/[0-9]/.test(e)) {
        let digits = e; for (let k=0;k<2 && i+1<s.length && /[0-9]/.test(s[i+1]); k++){ i++; digits += s[i]; }
        out.push((parseInt(digits,10) || 0) & 255);
      } else { out.push(e.charCodeAt(0)); }
    }
    return out; // array of byte ints
  }

  function toLuaDecimalEscaped(bytes) {
    return '"' + bytes.map(b => '\\' + String(b).padStart(3,'0')).join('') + '"';
  }

  function obfuscateStrings(tokens, seed) {
    const rng = mulberry32(((seed ^ 0xA5A51337) >>> 0) || 1);
    const out = []; let injected = false;
    const decoder = (
      'local function _d(b,k) ' +
      '  local t={} ' +
      '  for i=1,#b do ' +
      '    local x=string.byte(b,i)-k; if x<0 then x=x+256 end ' +
      '    t[i]=string.char(x) ' +
      '  end ' +
      '  return table.concat(t) ' +
      'end'
    );
    for (const [tt, tv] of tokens) {
      if (tt === "str") {
        const inner = tv.slice(1, -1);
        const raw = decodeEscapeSequences(inner);
        const key = Math.max(1, rngInt(rng,1,255));
        const enc = raw.map(b => (b + key) & 255);
        const lit = toLuaDecimalEscaped(enc);
        out.push(["code", `_d(${lit},${key})`]);
        injected = true;
      } else {
        out.push([tt, tv]);
      }
    }
    return { tokens: out, header: injected ? decoder : "" };
  }

  function minify(tokens) {
    const parts = [];
    for (const [tt, tv] of tokens) {
      if (tt === "ws") { parts.push(" "); continue; }
      if (tt === "code") { parts.push(tv); continue; }
      parts.push(tv);
    }
    let s = parts.join("");
    s = s.replace(/[ \t\r\f\v]+/g, " ");
    s = s.replace(/\s*([=,\+\-\*\/%\(\)\{\}\[\];:\.<>\u003e#])\s*/g, "$1");
    s = s.replace(/\s*\n\s*/g, "\n");
    return s;
  }

  function obfuscate(lua, opts) {
    let tokens = tokenize(lua);
    tokens = removeComments(tokens);
    if (opts.renameLocals) tokens = renameLocals(tokens, opts.seed);
    let header = "";
    if (opts.stringObf) { const res = obfuscateStrings(tokens, opts.seed); tokens = res.tokens; header = res.header; }
    let out = opts.minify ? minify(tokens) : tokens.map(t=> t[0]==="code"? t[1]: t[1]).join("");
    // Ensure separator between header and body to avoid token gluing like "endprint" or "endlocal"
    if (header && header.length && out && out.length) {
      out = header + ' ' + out;
    } else if (header && header.length) {
      out = header;
    }
    return out;
  }

  // Build anti-dump loader that decrypts and executes payload at runtime.
  function buildAntiDump(payload, seed) {
    // Encode payload bytes using a simple rolling-add stream (mod 256)
    const enc = new TextEncoder();
    const bytes = Array.from(enc.encode(payload));
    let r = (seed >>> 0) & 255;
    const out = new Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      r = (r * 73 + 41) % 256; // small LCG in byte space
      out[i] = (bytes[i] + r) & 255;
    }
    const arr = `{${out.join(',')}}`;
    const k = (seed >>> 0) & 255;
    const loader = [
      'local function _ad(b,k)',
      '  local t={}',
      '  local r = k % 256',
      '  for i=1,#b do',
      '    r = (r*73 + 41) % 256',
      '    local x = b[i]-r; if x < 0 then x = x + 256 end',
      '    t[i]=string.char(x)',
      '  end',
      '  local s = table.concat(t)',
      '  local l = (loadstring or load)',
      '  local f,err = l(s)',
      "  if not f then error(err or 'load failed') end",
      '  s=nil; t=nil; b=nil; k=nil',
      '  local ok,res = pcall(f)',
      "  if not ok then error(res) end",
      'end',
      `_ad(${arr}, ${k}); _ad=nil`
    ].join(' ');
    return loader;
  }

  // One-line wrapper in ProHub style (inline payload for Roblox Luau compatibility)
  function luaQuote(s){
    return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r')+'"';
  }
  function buildProHubWrapperInline(payload) {
    // Roblox-friendly one liner; begin with banner print; isolate payload; avoid top-level return
    const bannerStmt = BANNER ? `print(${luaQuote(BANNER)}); ` : '';
    // Fallback for table.unpack/unpack differences in Luau
    const prelude = 'local N,s,M,Z,q=math,table,tonumber,setmetatable,string; local U=table.unpack or unpack; local j,r,G,x,i,F=N.floor,N.max,U,s.concat,string.char,string.sub; ';
    // Start with banner at the very front, then invoke the wrapper function
    return `${bannerStmt}(function() ${prelude}do ${payload} end; end)()`;
  }

  // UI actions
  btnObfuscate.addEventListener('click', () => {
    const src = inputEl.value || '';
    const seed = Number(seedEl.value); const seedSafe = Number.isFinite(seed) ? seed : 1337;
    const baseOpts = {
      seed: seedSafe,
      renameLocals: optRenameEl.checked,
      stringObf: optStrEl.checked,
      minify: optMinEl.checked,
    };
    let result = obfuscate(src, baseOpts);
    if (optDoubleEl && optDoubleEl.checked) {
      const seed2 = (seedSafe ^ 0x9E3779B9) >>> 0; // golden ratio derived
      result = obfuscate(result, { ...baseOpts, seed: seed2 });
    }
    if (!ROBLOX_MODE && optADEl && optADEl.checked) {
      const adSeed = (seedSafe ^ 0xC0FFEE ^ 0xA5A5A5A5) >>> 0;
      result = buildAntiDump(result, adSeed);
    }
    result = buildProHubWrapperInline(result);
    outputEl.value = result;
  });

  btnCopy.addEventListener('click', async () => {
    if (!outputEl.value) return;
    try { await navigator.clipboard.writeText(outputEl.value); btnCopy.textContent = 'Copied!'; setTimeout(()=> btnCopy.textContent='Copy', 1200); } catch {}
  });

  btnDownload.addEventListener('click', () => {
    const blob = new Blob([outputEl.value || ''], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'obfuscated.lua';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
  });

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      inputEl.value = '';
      outputEl.value = '';
    });
  }

  btnExample.addEventListener('click', () => {
    const example = [
      '-- Example Lua script',
      'print("example")',
      '  print("https://hackmanhub.pages.dev")',
      '  print("https://payhubtr.store")',
      'print("https://hackmanhub.pages.dev/discord")',
      'print("end yay")',
      ''
    ].join('\n');
    inputEl.value = example;
  });
})();


