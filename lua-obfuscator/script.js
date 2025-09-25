// Lua/Luau obfuscator (client-only)
// Features: remove comments, optional local renaming, string obfuscation with decoder, minification.
// Use for legitimate purposes only.

(function(){
  // Config (edit in file)
  const BANNER = '----- HackManHub Obfuscator Beta Join DC! https://hackmanhub.pages.dev/discord -----';
  const ROBLOX_MODE = true;
  const LOOTLABS_URL = 'https://loot-link.com/s?qNPSHwBI'; // Replace with your real key page

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
  const optFieldsEl = $("optFields");
  const optGlobalsEl = $("optGlobals");
  const btnObfuscate = $("btnObfuscate");
  const btnCopy = $("btnCopy");
  const btnDownload = $("btnDownload");
  const btnExample = $("btnExample");
  const btnClear = $("btnClear");
  // Token UI
  const tokenCountEl = $("tokenCount");
  const btnGetTokens = $("btnGetTokens");
  const btnRedeem = $("btnRedeem");
  const redeemModal = $("redeemModal");
  const keyInput = $("keyInput");
  const btnSubmitKey = $("btnSubmitKey");
  const btnCancelKey = $("btnCancelKey");
  const deviceIdLabel = $("deviceIdLabel");

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

  // Tokens per device (localStorage)
  const LS_KEYS = { id: 'HMH_DEVICE_ID', tokens: 'HMH_TOKENS', redeemed: 'HMH_KEYS' };
  function getDeviceId(){
    let id = localStorage.getItem(LS_KEYS.id);
    if (!id){ id = ([...crypto.getRandomValues(new Uint8Array(8))].map(b=>b.toString(16).padStart(2,'0')).join('')); localStorage.setItem(LS_KEYS.id, id); }
    return id;
  }
  function getTokens(){ const v = Number(localStorage.getItem(LS_KEYS.tokens)); return Number.isFinite(v) ? v : 0; }
  function setTokens(n){ localStorage.setItem(LS_KEYS.tokens, String(Math.max(0, Math.floor(n)))); updateTokenUI(); }
  function addTokens(n){ setTokens(getTokens() + Math.max(0, Math.floor(n))); }
  function useOneToken(){ const v = getTokens(); if (v<=0) return false; setTokens(v-1); return true; }
  function updateTokenUI(){ if (tokenCountEl) tokenCountEl.textContent = String(getTokens()); if (deviceIdLabel) deviceIdLabel.textContent = getDeviceId(); }

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

  function obfStringExpr(rawStr, useDecoder, rng, decName) {
    // Build an expression that evaluates to rawStr in Lua
    const bytes = Array.from(new TextEncoder().encode(rawStr));
    if (useDecoder) {
      const key = Math.max(1, rngInt(rng,1,255));
      const enc = bytes.map(b => (b + key) & 255);
      const lit = toLuaDecimalEscaped(enc);
      return { expr: `${decName}(${lit},${key})`, needsDecoder: true };
    } else {
      return { expr: `string.char(${bytes.join(',')})`, needsDecoder: false };
    }
  }

  function decoderSrc(decName) {
    return [
      'local function ' + decName + '(s,k)',
      '  local t={}',
      '  if type(s)=="table" then',
      '    for i=1,#s do',
      '      local x=s[i]-k; if x<0 then x=x+256 end',
      '      t[i]=string.char(x)',
      '    end',
      '    return table.concat(t)',
      '  end',
      '  for i=1,#s do',
      '    local x=string.byte(s,i)-k; if x<0 then x=x+256 end',
      '    t[i]=string.char(x)',
      '  end',
      '  return table.concat(t)',
      'end'
    ].join(' ');
  }

  function obfuscateStrings(tokens, seed, decName) {
    const rng = mulberry32(((seed ^ 0xA5A51337) >>> 0) || 1);
    const out = []; let injected = false;
    const decoder = decoderSrc(decName);
    for (const [tt, tv] of tokens) {
      if (tt === "str") {
        const inner = tv.slice(1, -1);
        const raw = decodeEscapeSequences(inner);
        const key = Math.max(1, rngInt(rng,1,255));
        const enc = raw.map(b => (b + key) & 255);
        const lit = toLuaDecimalEscaped(enc);
        out.push(["code", `${decName}(${lit},${key})`]);
        injected = true;
      } else {
        out.push([tt, tv]);
      }
    }
    return { tokens: out, header: injected ? decoder : "" };
  }

  function hideDotFields(tokens, opts, decName) {
    if (!opts.hideFields) return { tokens, needDecoder: false };
    const rng = mulberry32(((opts.seed ^ 0xF00DFEED) >>> 0) || 1);
    const out = [];
    let needDecoder = false;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t[0] === 'sym' && t[1] === '.' && i + 1 < tokens.length && tokens[i+1][0] === 'ident') {
        const name = tokens[i+1][1];
        const { expr, needsDecoder } = obfStringExpr(name, !!opts.stringObf, rng, decName);
        if (needsDecoder) needDecoder = true;
        out.push(['sym','[']);
        out.push(['code', expr]);
        out.push(['sym',']']);
        i++; // skip original ident
        continue;
      }
      out.push(t);
    }
    return { tokens: out, needDecoder };
  }

  const COMMON_GLOBALS = new Set([
    'print','warn','error','assert','pcall','xpcall','require','type','typeof','select','tonumber','tostring','pairs','ipairs','next','getfenv','setfenv',
    'math','string','table','coroutine','os','utf8','task','spawn','delay','wait','tick',
    // Roblox common
    'game','workspace','script','Instance','Enum','CFrame','Vector3','Vector2','UDim2','Color3','Ray','TweenService','HttpService','RunService','Players','ReplicatedStorage','ServerScriptService'
  ]);

  function hideGlobals(tokens, opts, decName, envName) {
    if (!opts.hideGlobals) return { tokens, header: '', needDecoder: false };
    const rng = mulberry32(((opts.seed ^ 0xBADC0DE) >>> 0) || 1);
    const out = [];
    let usedEnv = false; let needDecoder = false;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const prev = out.length ? out[out.length-1] : null;
      if (t[0] === 'ident' && !isFieldAccess(prev) && COMMON_GLOBALS.has(t[1])) {
        const { expr, needsDecoder } = obfStringExpr(t[1], !!opts.stringObf, rng, decName);
        if (needsDecoder) needDecoder = true;
        out.push(['code', `${envName}[${expr}]`]);
        usedEnv = true; continue;
      }
      out.push(t);
    }
    const header = usedEnv ? ('local ' + envName + '=(getfenv and getfenv()) or _ENV or _G') : '';
    return { tokens: out, header, needDecoder };
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
    const decName = '__d' + ((opts.seed>>>0).toString(16)) + 'x';
    const envName = '__E' + ((opts.seed>>>0).toString(16)) + 'x';
    let header = "";
    if (opts.stringObf) { const res = obfuscateStrings(tokens, opts.seed, decName); tokens = res.tokens; header = res.header; }

    // Hide .fields -> ["field"] (encoded)
    const hf = hideDotFields(tokens, opts, decName); tokens = hf.tokens;
    // Hide common globals via envName["..."]
    const hg = hideGlobals(tokens, opts, decName, envName); tokens = hg.tokens;

    let out = opts.minify ? minify(tokens) : tokens.map(t=> t[0]==="code"? t[1]: t[1]).join("");
    // Build final header
    const headers = [];
    if (header) headers.push(header);
    if (hg.header) headers.push(hg.header);
    // Inject decoder if needed by field/global transforms and not already present
    const needDec = (hf.needDecoder || hg.needDecoder) && !header;
    if (needDec) headers.push(decoderSrc(decName));
    const headerJoined = headers.join(' ');
    // Ensure separator between header and body to avoid token gluing like "endprint" or "endlocal"
    if (headerJoined && headerJoined.length && out && out.length) {
      out = headerJoined + ' ' + out;
    } else if (headerJoined && headerJoined.length) {
      out = headerJoined;
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

  // Initialize token UI
  updateTokenUI();
  const MIN_LOOTLABS_TIME_MS = 5000; // basic bypass check: must spend at least this long off-site
  function baseUrl() {
    const u = new URL(window.location.href);
    u.search = '';
    u.hash = '';
    return u.toString();
  }
  function startLootlabsFlow() {
    const id = getDeviceId();
    const nonceBytes = new Uint8Array(8); crypto.getRandomValues(nonceBytes);
    const nonce = Array.from(nonceBytes).map(b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem('HMH_PENDING', JSON.stringify({ nonce, ts: Date.now() }));
    const callback = baseUrl() + `?ll_ok=1&nonce=${nonce}`;
    // redirect current tab
    window.location.assign(`${LOOTLABS_URL}?device=${encodeURIComponent(id)}&nonce=${encodeURIComponent(nonce)}&callback=${encodeURIComponent(callback)}`);
  }
  function handleLootlabsReturn() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('ll_ok')) return;
    const ok = params.get('ll_ok') === '1' || params.get('ll_ok') === 'true';
    const nonce = params.get('nonce') || '';
    const pendingRaw = localStorage.getItem('HMH_PENDING');
    let passed = false;
    if (ok && pendingRaw) {
      try {
        const p = JSON.parse(pendingRaw);
        const elapsed = Date.now() - (p.ts || 0);
        if (p.nonce === nonce && elapsed >= MIN_LOOTLABS_TIME_MS) {
          passed = true;
        }
      } catch {}
    }
    // clean URL
    window.history.replaceState(null, document.title, baseUrl());
    localStorage.removeItem('HMH_PENDING');
    if (passed) {
      addTokens(1);
      alert('Token added. Thank you!');
    } else {
      alert('Verification failed or too fast (possible bypass). Try again.');
    }
  }
  handleLootlabsReturn();

  if (btnGetTokens) {
    btnGetTokens.addEventListener('click', () => {
      startLootlabsFlow();
    });
  }
  if (btnRedeem) {
    btnRedeem.addEventListener('click', () => { if (redeemModal) { redeemModal.classList.remove('hidden'); keyInput && (keyInput.value=''); keyInput && keyInput.focus(); updateTokenUI(); } });
  }
  if (btnCancelKey) { btnCancelKey.addEventListener('click', () => { redeemModal && redeemModal.classList.add('hidden'); }); }
  function validateKeyAndValue(key){
    // Simple offline validation: HMH-<last6 of device>-<checksum base36 of suffix>
    const id = getDeviceId();
    const suffix = id.slice(-6);
    const m = String(key||'').trim().match(/^HMH-([0-9a-fA-F]{6})-([0-9a-zA-Z]{1,8})$/);
    if (!m) return 0;
    if (m[1].toLowerCase() !== suffix.toLowerCase()) return 0;
    const sum = Array.from(suffix).reduce((a,ch)=>a+ch.charCodeAt(0),0);
    const want = (sum % 97).toString(36);
    if (m[2].toLowerCase() !== want) return 0;
    return 1; // award 1 token
  }
  if (btnSubmitKey) {
    btnSubmitKey.addEventListener('click', () => {
      const key = keyInput ? keyInput.value : '';
      const award = validateKeyAndValue(key);
      if (award>0){ addTokens(award); alert(`Redeemed ${award} token${award>1?'s':''}.`); redeemModal && redeemModal.classList.add('hidden'); }
      else { alert('Invalid key for this device.'); }
    });
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
      hideFields: optFieldsEl ? optFieldsEl.checked : true,
      hideGlobals: optGlobalsEl ? optGlobalsEl.checked : true,
    };
    if (getTokens() <= 0) { alert('No tokens left. Click "Get free tokens" or "Redeem key".'); return; }
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
    useOneToken();
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
      'local function greet(name)',
      '  local msg = "Hello, \\"..name.."!"',
      '  print(msg)',
      'end',
      'greet("world")',
      ''
    ].join('\n');
    inputEl.value = example;
  });
})();

