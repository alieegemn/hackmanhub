(function (window) {
  'use strict';

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  const RESERVED = new Set([
    // Lua keywords
    'and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while',
    // common globals to avoid renaming accidentally
    '_G','_ENV','coroutine','debug','io','math','os','package','string','table','utf8','pairs','ipairs','print','pcall','xpcall','type','next','select','tonumber','tostring','error','assert','getmetatable','setmetatable','rawget','rawset','rawequal'
  ]);

  function tokenize(src) {
    const tokens = [];
    let i = 0, n = src.length;
    let state = 'code'; // 'code' | 'string' | 'comment'
    let sb = '';
    let quote = null; // '"' or '\'' or '[[' (long bracket)
    let longLevel = 0; // for [=[ ]=] nesting level

    function push(type) { if (sb.length) { tokens.push({ type, text: sb }); sb = ''; } }

    function startsLongBracket(idx) {
      if (src[idx] !== '[') return 0;
      let k = idx + 1; let level = 0;
      while (src[k] === '=') { level++; k++; }
      if (src[k] === '[') return level + 1; // at least [[
      return 0;
    }

    function endsLongBracket(idx, level) {
      if (src[idx] !== ']') return 0;
      let k = idx + 1; let cnt = 0;
      while (src[k] === '=') { cnt++; k++; }
      if (src[k] === ']' && cnt === level - 1) return cnt + 2; // ]=]= for level 2, etc
      return 0;
    }

    while (i < n) {
      const ch = src[i];

      if (state === 'code') {
        // check for comment start
        if (ch === '-' && src[i + 1] === '-') {
          // long or short comment
          const level = startsLongBracket(i + 2);
          push('code');
          if (level) {
            state = 'comment'; quote = 'long'; longLevel = level; sb += '--' + src.slice(i + 2, i + 2 + (level)) + '['; i += 2 + level + 1; // store original delimiter
          } else {
            state = 'comment'; quote = '--'; sb += '--'; i += 2; continue;
          }
        }
        // check for string start
        if (ch === '"' || ch === '\'') { push('code'); state = 'string'; quote = ch; sb += ch; i++; continue; }
        const llevel = startsLongBracket(i);
        if (llevel) { push('code'); state = 'string'; quote = 'long'; longLevel = llevel; sb += src.slice(i, i + llevel + 1); i += llevel + 1; continue; }
        sb += ch; i++;
      } else if (state === 'string') {
        if (quote === 'long') {
          const endSpan = endsLongBracket(i, longLevel);
          if (endSpan) { sb += src.slice(i, i + endSpan); i += endSpan; push('string'); state = 'code'; quote = null; continue; }
          sb += ch; i++;
        } else {
          if (ch === '\\') { sb += ch; sb += src[i + 1] || ''; i += 2; continue; }
          sb += ch; i++;
          if (ch === quote) { push('string'); state = 'code'; quote = null; }
        }
      } else if (state === 'comment') {
        if (quote === '--') {
          if (ch === '\n' || ch === '\r') { push('comment'); state = 'code'; sb += ch; i++; } else { sb += ch; i++; }
        } else { // long comment
          const endSpan = endsLongBracket(i, longLevel);
          if (endSpan) { sb += src.slice(i, i + endSpan); i += endSpan; push('comment'); state = 'code'; quote = null; }
          else { sb += ch; i++; }
        }
      }
    }
    push(state === 'code' ? 'code' : state);
    return tokens;
  }

  function stripComments(tokens) {
    const out = [];
    for (const t of tokens) {
      if (t.type === 'comment') continue;
      out.push(t);
    }
    return out;
  }

  function luaStringToCodepoints(strToken) {
    // strToken includes quotes or long bracket delimiters
    // Return array of byte values
    // Handle short strings with basic escapes; long strings are raw
    if (!strToken.length) return [];
    let content = '';
    if (strToken[0] === '"' || strToken[0] === '\'') {
      // short string
      let i = 1;
      while (i < strToken.length - 1) {
        const ch = strToken[i];
        if (ch === '\\') {
          const nx = strToken[i + 1];
          switch (nx) {
            case 'n': content += '\n'; break;
            case 'r': content += '\r'; break;
            case 't': content += '\t'; break;
            case '\\': content += '\\'; break;
            case '\"': content += '"'; break;
            case '\'': content += '\''; break;
            default:
              if (nx >= '0' && nx <= '9') {
                // up to 3-digit decimal escape
                let j = i + 1; let num = '';
                for (let k = 0; k < 3 && j < strToken.length - 1 && /[0-9]/.test(strToken[j]); k++, j++) num += strToken[j];
                if (num) { content += String.fromCharCode(Math.max(0, Math.min(255, parseInt(num, 10)))); i = j - 1; }
                else { content += nx; }
              } else { content += nx; }
          }
          i += 2; continue;
        } else { content += ch; i++; }
      }
    } else {
      // long bracket [[...]] or [=[...]=]
      // find opening like [==[
      const m = strToken.match(/^\[(=*)\[/);
      if (!m) return [];
      const eqs = m[1];
      const end = `]${eqs}]`;
      // strip opening and closing
      const inner = strToken.slice(m[0].length, strToken.length - end.length);
      content = inner;
    }
    const bytes = [];
    for (let i = 0; i < content.length; i++) bytes.push(content.charCodeAt(i) & 0xff);
    return bytes;
  }

  function encodeStringToken(strToken) {
    const bytes = luaStringToCodepoints(strToken);
    const args = bytes.join(',');
    return `__c(${args})`;
  }

  function encodeNumbersInCode(code) {
    // Replace integer and simple float literals outside identifiers
    // Keep hex or scientific as-is for simplicity
    return code.replace(/\b(\d+)(?![\w\.])/g, (m, d) => {
      // encode integer as ((N + A) - A)
      const N = parseInt(d, 10);
      const A = randInt(100000, 999999);
      return `((${N + A} - ${A}) + 0)`;
    });
  }

  function minifyWhitespace(code) {
    // remove redundant whitespace but keep line breaks around keywords to reduce risk
    // Also collapse multiple spaces
    // Do not touch within strings/comments because we work on code-only text
    code = code.replace(/[\t ]+/g, ' ');
    code = code.replace(/[\r\n]+/g, '\n');
    // trim spaces around punctuation
    code = code.replace(/\s*([=+\-*/%%#<>~:;,{}()\[\]])\s*/g, '$1');
    code = code.replace(/\s*\b(end|then|do|until|else|elseif|function|local|return)\b\s*/g, ' $1 ');
    return code.trim();
  }

  function collectLocalDecls(code) {
    const locals = new Set();
    // local x = ..., local x,y = ...
    const re1 = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)/g;
    let m;
    while ((m = re1.exec(code))) {
      const names = m[1].split(/\s*,\s*/);
      for (const nm of names) if (!RESERVED.has(nm)) locals.add(nm);
    }
    // local function fname
    const re2 = /\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    while ((m = re2.exec(code))) {
      const nm = m[1]; if (!RESERVED.has(nm)) locals.add(nm);
    }
    return Array.from(locals);
  }

  function genName(i) {
    const alphabet = '_oO0Il1';
    let s = '_';
    for (let j = 0; j < 6; j++) s += alphabet[randInt(0, alphabet.length - 1)];
    return s + i.toString(36);
  }

  function renameLocalsBasic(code) {
    const locals = collectLocalDecls(code);
    if (!locals.length) return code;
    const shuffled = shuffle(locals.slice());
    const map = new Map();
    shuffled.forEach((nm, i) => { map.set(nm, genName(i)); });

    // Replace occurrences that look like identifiers not part of field access
    for (const [from, to] of map.entries()) {
      const re = new RegExp(`(?<![\\.])\\b${from}\\b`, 'g');
      code = code.replace(re, to);
    }
    return code;
  }

  function insertJunkPrelude(code) {
    const a = randInt(200000, 999999);
    const b = randInt(200000, 999999);
    const c = randInt(200000, 999999);
    const junkIndexA = a - b + c;
    const junkIndexB = a + b - c;
    const junkIndexC = a ^ b;
    const prelude = [
      'do',
      '  local _J={}',
      `  _J[${junkIndexA}]=true`,
      `  _J[${junkIndexB}]=string`,`  _J[${junkIndexC}]=math`,
      '  if _J[' + junkIndexA + '] and type(_J[' + junkIndexB + '])=="table" then',
      '    _J[' + (junkIndexA + 1) + '] = (_J[' + junkIndexC + '].floor or function(x) return x end)(1)',
      '  end',
      'end'
    ].join('\n');
    return prelude + '\n' + code;
  }

  function buildHeader(options) {
    const lines = [];
    if (options.encodeStrings) {
      lines.push('local function __c(...) return string.char(...) end');
    }
    return lines.length ? lines.join('\n') + '\n' : '';
  }

  function obfuscate(src, options = {}) {
    const opts = Object.assign({
      removeComments: true,
      minifyWhitespace: true,
      encodeStrings: true,
      encodeNumbers: true,
      renameLocals: false,
      insertJunk: false,
    }, options);

    // Tokenize so we can preserve strings comments
    let tokens = tokenize(src);

    if (opts.removeComments) tokens = stripComments(tokens);

    // Encode strings: turn string tokens into code tokens calling __c
    if (opts.encodeStrings) {
      tokens = tokens.map(t => {
        if (t.type === 'string') return { type: 'code', text: encodeStringToken(t.text) };
        return t;
      });
    }

    // Re-join to a code string for further passes
    let code = tokens.map(t => t.text).join('');

    if (opts.renameLocals) code = renameLocalsBasic(code);
    if (opts.encodeNumbers) code = encodeNumbersInCode(code);
    if (opts.minifyWhitespace) code = minifyWhitespace(code);

    let header = buildHeader(opts);
    if (opts.insertJunk) code = insertJunkPrelude(code);

    const finalCode = header + code;
    return { code: finalCode };
  }

  window.LuaObfuscator = { obfuscate };
})(typeof window !== 'undefined' ? window : (this || {}));

