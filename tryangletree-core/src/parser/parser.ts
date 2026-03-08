import { err } from "../runtime/errors.js";

function countBalance(text) {
  let p = 0;
  let b = 0;
  let c = 0;
  let inStr = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "(") p++;
    else if (ch === ")") p--;
    else if (ch === "[") b++;
    else if (ch === "]") b--;
    else if (ch === "{") c++;
    else if (ch === "}") c--;
  }
  return { p, b, c };
}

function splitTopLevel(text, delimiter) {
  const parts = [];
  let cur = "";
  let inStr = null;
  let { p, b, c } = { p: 0, b: 0, c: 0 };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inStr) {
      cur += ch;
      if (ch === "\\") {
        if (i + 1 < text.length) cur += text[++i];
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }

    if (ch === "(") p++;
    else if (ch === ")") p--;
    else if (ch === "[") b++;
    else if (ch === "]") b--;
    else if (ch === "{") c++;
    else if (ch === "}") c--;

    if (p === 0 && b === 0 && c === 0 && text.startsWith(delimiter, i)) {
      parts.push(cur.trim());
      cur = "";
      i += delimiter.length - 1;
      continue;
    }

    cur += ch;
  }

  parts.push(cur.trim());
  return parts;
}

function splitTopLevelByOperators(text, operators) {
  const parts = [];
  const ops = [];
  let cur = "";
  let inStr = null;
  let p = 0;
  let b = 0;
  let c = 0;

  const sortedOps = operators.slice().sort((a, b2) => b2.length - a.length);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inStr) {
      cur += ch;
      if (ch === "\\") {
        if (i + 1 < text.length) cur += text[++i];
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }

    if (ch === "(") p++;
    else if (ch === ")") p--;
    else if (ch === "[") b++;
    else if (ch === "]") b--;
    else if (ch === "{") c++;
    else if (ch === "}") c--;

    if (p === 0 && b === 0 && c === 0) {
      let matched = null;
      for (const op of sortedOps) {
        if (!text.startsWith(op, i)) continue;

        if (op === "::") {
          // Keep ':::' marker token reserved for invoke markers, not tap operator.
          const prev = text[i - 1];
          const next2 = text[i + 2];
          if (prev === ":" || next2 === ":") continue;
        }

        matched = op;
        break;
      }

      if (matched) {
        parts.push(cur.trim());
        ops.push(matched);
        cur = "";
        i += matched.length - 1;
        continue;
      }
    }

    cur += ch;
  }

  parts.push(cur.trim());
  return { parts, ops };
}

function parseValue(src) {
  const s = src.trim();
  let i = 0;

  const isWS = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";
  const isDigit = (c) => c >= "0" && c <= "9";
  const isIdStart = (c) =>
    (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
  const isId = (c) => isIdStart(c) || isDigit(c);

  function skipWS() {
    while (i < s.length && isWS(s[i])) i++;
  }

  function peek() {
    return s[i];
  }

  function consume(ch) {
    if (s[i] !== ch)
      err(`Expected '${ch}' but found '${s[i] ?? "EOF"}' in: ${s}`);
    i++;
  }

  function parseString() {
    const quote = s[i];
    consume(quote);
    let out = "";
    while (i < s.length) {
      const c = s[i];
      if (c === "\\") {
        out += c;
        i++;
        if (i < s.length) out += s[i++];
        continue;
      }
      if (c === quote) break;
      out += c;
      i++;
    }
    consume(quote);
    return out
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
  }

  function parseNumber() {
    const start = i;
    while (i < s.length && isDigit(s[i])) i++;
    if (s[i] === ".") {
      i++;
      while (i < s.length && isDigit(s[i])) i++;
    }
    const n = Number(s.slice(start, i));
    if (!Number.isFinite(n)) err("Bad number");
    return n;
  }

  function parseIdent() {
    const start = i;
    if (!isIdStart(s[i])) err(`Expected identifier near: ${s.slice(i)}`);
    i++;
    while (i < s.length && isId(s[i])) i++;
    return s.slice(start, i);
  }

  function parseInvokeName() {
    let name = parseIdent();
    while (peek() === "." && isIdStart(s[i + 1])) {
      consume(".");
      name += `.${parseIdent()}`;
    }
    return name;
  }

  function parseArray() {
    consume("[");
    skipWS();
    const out = [];
    if (peek() === "]") {
      consume("]");
      return out;
    }
    while (i < s.length) {
      out.push(parseAny());
      skipWS();
      if (peek() === ",") {
        consume(",");
        skipWS();
        continue;
      }
      if (peek() === "]") {
        consume("]");
        return out;
      }
      err(`Expected ',' or ']' near: ${s.slice(i)}`);
    }
    err("Unterminated array");
  }

  function parseObject() {
    consume("{");
    skipWS();
    const out = {};
    if (peek() === "}") {
      consume("}");
      return out;
    }
    while (i < s.length) {
      skipWS();
      // Support quoted keys: "vii°": {...} or 'I': {...}
      let key;
      if (peek() === '"' || peek() === "'") {
        key = parseString();
      } else {
        key = parseIdent(); // preserve casing — do NOT toLowerCase
      }
      skipWS();
      const sep = peek();
      if (sep !== ":" && sep !== "=")
        err(`Expected ':' or '=' after key '${key}'`);
      i++;
      skipWS();
      out[key] = parseAny();
      skipWS();
      if (peek() === ",") {
        consume(",");
        skipWS();
        continue;
      }
      if (peek() === "}") {
        consume("}");
        return out;
      }
      err(`Expected ',' or '}' near: ${s.slice(i)}`);
    }
    err("Unterminated object");
  }

  function parseEmbeddedExpr() {
    consume("$");
    consume("(");

    let inner = "";
    let p = 1;
    let b = 0;
    let c = 0;
    let inStr = null;

    while (i < s.length) {
      const ch = s[i];

      if (inStr) {
        inner += ch;
        if (ch === "\\") {
          i++;
          if (i < s.length) inner += s[i];
          i++;
          continue;
        }
        if (ch === inStr) inStr = null;
        i++;
        continue;
      }

      if (ch === '"' || ch === "'") {
        inStr = ch;
        inner += ch;
        i++;
        continue;
      }

      if (ch === "(") {
        p++;
        inner += ch;
        i++;
        continue;
      }
      if (ch === ")") {
        p--;
        if (p === 0) {
          i++;
          return { kind: "Expr", expr: parseExpr(inner) };
        }
        inner += ch;
        i++;
        continue;
      }

      if (ch === "[") b++;
      else if (ch === "]") b--;
      else if (ch === "{") c++;
      else if (ch === "}") c--;

      inner += ch;
      i++;
    }

    err(`Unclosed $(...) in: ${s}`);
  }

  function parseInlineInvoke() {
    consume("@");
    const name = parseInvokeName();
    skipWS();
    let args = {};
    if (peek() === "(") {
      consume("(");
      let inner = "";
      let p = 1;
      let b = 0;
      let c = 0;
      let inStr = null;
      while (i < s.length) {
        const ch = s[i];
        if (inStr) {
          inner += ch;
          if (ch === "\\") {
            i++;
            if (i < s.length) inner += s[i];
            i++;
            continue;
          }
          if (ch === inStr) inStr = null;
          i++;
          continue;
        }
        if (ch === '"' || ch === "'") {
          inStr = ch;
          inner += ch;
          i++;
          continue;
        }
        if (ch === "(") p++;
        else if (ch === ")") {
          p--;
          if (p === 0) {
            i++;
            args = parseCallArgs(inner);
            return {
              kind: "Expr",
              expr: { kind: "Invoke", name, args, markers: [] },
            };
          }
        } else if (ch === "[") b++;
        else if (ch === "]") b--;
        else if (ch === "{") c++;
        else if (ch === "}") c--;
        inner += ch;
        i++;
      }
      err(`Unclosed call args in value invoke: @${name}`);
    }
    return { kind: "Expr", expr: { kind: "Invoke", name, args, markers: [] } };
  }

  function parsePrimary() {
    skipWS();
    const c = peek();

    if (c === "$" && s[i + 1] === "(") return parseEmbeddedExpr();
    if (c === "@") return parseInlineInvoke();
    if (c === '"' || c === "'") return parseString();
    if (c === "[") return parseArray();
    if (c === "{") return parseObject();
    if (isDigit(c)) return parseNumber();
    if (c === "(") {
      consume("(");
      const inner = parseAny();
      skipWS();
      consume(")");
      return inner;
    }
    if (isIdStart(c)) {
      const id = parseIdent();
      if (id === "true") return true;
      if (id === "false") return false;
      if (id === "null") return null;
      return { kind: "Ref", name: id };
    }
    err(`Unexpected value token near: ${s.slice(i)}`);
  }

  function parsePostfix() {
    let base = parsePrimary();

    while (true) {
      skipWS();
      if (peek() === "." && isIdStart(s[i + 1])) {
        consume(".");
        const prop = parseIdent();
        base = { kind: "Dot", left: base, right: prop };
        continue;
      }
      if (peek() === "[") {
        consume("[");
        skipWS();
        if (peek() === "]")
          err(`Expected index expression near: ${s.slice(i)}`);
        const index = parseAny();
        skipWS();
        consume("]");
        base = { kind: "Index", target: base, index };
        continue;
      }
      if (peek() === "(") {
        consume("(");
        skipWS();
        const args = [];
        if (peek() !== ")") {
          while (i < s.length) {
            args.push(parseAny());
            skipWS();
            if (peek() === ",") {
              consume(",");
              skipWS();
              continue;
            }
            break;
          }
        }
        skipWS();
        consume(")");
        base = { kind: "Call", callee: base, args };
        continue;
      }
      break;
    }

    return base;
  }

  function parseMul() {
    let left = parsePostfix();
    while (true) {
      skipWS();
      const op = peek();
      if (op !== "*" && op !== "/" && op !== "%") break;
      consume(op);
      const right = parsePostfix();
      left = { kind: "Binary", op, left, right };
    }
    return left;
  }

  function parseAdd() {
    let left = parseMul();
    while (true) {
      skipWS();
      const op = peek();
      if (op !== "+" && op !== "-") break;
      consume(op);
      const right = parseMul();
      left = { kind: "Binary", op, left, right };
    }
    return left;
  }

  function parseAny() {
    return parseAdd();
  }

  const out = parseAny();
  skipWS();
  if (i !== s.length) err(`Trailing characters near: ${s.slice(i)}`);
  return out;
}

function parseCallArgs(argText) {
  const s = argText.trim();
  if (!s) return {};

  const parts = splitTopLevel(s, ",");
  if (parts.length === 1 && parts[0].startsWith("{"))
    return parseValue(parts[0]);

  const out: Record<string, any> = {};
  const positional = [];
  for (const part of parts) {
    const m = part.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*([=:])\s*(.+)\s*$/s);
    if (!m) {
      positional.push(parseValue(part));
      continue;
    }
    out[m[1].toLowerCase()] = parseValue(m[3]);
  }
  if (positional.length === 1) out._ = positional[0];
  if (positional.length > 0) out.__pos = positional;
  return out;
}

function parseInvoke(text) {
  let stepText = text.trim();
  const markers = [];
  const triple = /(!!!|:::|\?\?\?|\/\/\/)/;

  const prefixMatch = stepText.match(
    new RegExp(`^${triple.source}\\s*(.*)$`, "s"),
  );
  if (prefixMatch) {
    markers.push(prefixMatch[1]);
    stepText = prefixMatch[2].trim();
  }

  const suffixMatch = stepText.match(
    new RegExp(`^(.*?)(?:\\s*)${triple.source}$`, "s"),
  );
  if (suffixMatch) {
    markers.push(suffixMatch[2]);
    stepText = suffixMatch[1].trim();
  }

  const m = stepText.match(
    /^@([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*(.*)$/s,
  );
  if (!m) err(`Bad invoke: ${text}`);

  const name = m[1];
  const rest = (m[2] ?? "").trim();
  let args: Record<string, any> = {};

  if (rest.startsWith("(")) {
    let p = 0;
    let inStr = null;
    let end = -1;
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if (inStr) {
        if (ch === "\\") {
          i++;
          continue;
        }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inStr = ch;
        continue;
      }
      if (ch === "(") p++;
      else if (ch === ")") {
        p--;
        if (p === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) err(`Unclosed call args in invoke: ${text}`);
    args = parseCallArgs(rest.slice(1, end));
    const tail = rest.slice(end + 1).trim();
    if (tail) {
      if (!tail.startsWith("{")) err(`Unexpected trailing invoke content: ${tail}`);
      const bal = countBalance(tail);
      if (bal.p !== 0 || bal.b !== 0 || bal.c !== 0) {
        err(`Unclosed action block in invoke: ${text}`);
      }
      const close = tail.lastIndexOf("}");
      const body = tail.slice(1, close).trim();
      args.__block = body;
    }
  }

  return { kind: "Invoke", name, args, markers };
}

function parseAtom(text) {
  const t = text.trim();
  if (!t) return null;
  const invokeLike =
    t.startsWith("@") ||
    /^(?:!!!|:::|\?\?\?|\/\/\/)\s*@/.test(t) ||
    /@\w[\s\S]*(?:!!!|:::|\?\?\?|\/\/\/)\s*$/.test(t);
  if (invokeLike) return parseInvoke(t);
  return { kind: "Literal", value: parseValue(t) };
}

function parseExpr(text) {
  const t = text.trim();
  const split = splitTopLevelByOperators(t, ["->", "<>", "::"]);
  if (split.parts.length === 1) return parseAtom(t);

  let expr = parseAtom(split.parts[0]);
  for (let i = 1; i < split.parts.length; i++) {
    const op = split.ops[i - 1];
    const rhs = parseAtom(split.parts[i]);
    if (op === "<>" || op === "::") expr = { kind: "Tap", lhs: expr, rhs };
    else expr = { kind: "Pipe", lhs: expr, rhs };
  }
  return expr;
}

// Parse a key from a target body line — accepts bare identifiers or quoted strings.
// Quoted keys preserve exact casing (e.g. "I", "vii°", "IV").
function parseTargetKey(line) {
  const quotedM = line.match(/^\s*(["'])(.+?)\1\s*:\s*(.*)$/);
  if (quotedM) {
    return { key: quotedM[2], rest: quotedM[3] };
  }
  const bareM = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
  if (bareM) {
    return { key: bareM[1], rest: bareM[2] };
  }
  return null;
}

// Parse a nested sub-block (for state: and meta:) where each indented line
// is a key: value pair. Entity keys preserve casing; values are parsed normally.
function parseSubBlock(lines, startIdx, parentIndent) {
  const kv = {};
  let idx = startIdx;
  const blockDeclRe = /^\s*@([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/;

  while (idx < lines.length) {
    const line = lines[idx];
    const t = line.trim();

    if (!t || t.startsWith("//") || t.startsWith("#")) {
      idx++;
      continue;
    }
    if (blockDeclRe.test(line)) break;
    if (
      /^\s*(?:->|<>|::)/.test(line) ||
      /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:=/.test(line)
    )
      break;

    const lineIndent = line.match(/^(\s*)/)[1].length;
    if (lineIndent <= parentIndent) break;

    const parsed = parseTargetKey(line);
    if (!parsed) break;

    const { key, rest } = parsed;
    let acc = rest ?? "";
    let bal = countBalance(acc);
    while (
      (bal.p !== 0 || bal.b !== 0 || bal.c !== 0) &&
      idx + 1 < lines.length
    ) {
      idx++;
      acc += "\n" + lines[idx];
      bal = countBalance(acc);
    }

    kv[key] = acc.trim() ? parseValue(acc) : null;
    idx++;
  }

  return { body: kv, nextIdx: idx };
}

// Keys that hold nested sub-blocks (entity -> property object) rather than flat values.
const SUB_BLOCK_KEYS = new Set(["state", "meta"]);

function parseTargetBody(lines, startIdx) {
  const kv = {};
  let idx = startIdx;
  const blockDeclRe = /^\s*@([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/;

  // Determine the indentation of this body block by finding its first real line.
  let bodyIndent = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith("//") || t.startsWith("#")) continue;
    bodyIndent = lines[i].match(/^(\s*)/)[1].length;
    break;
  }

  while (idx < lines.length) {
    const line = lines[idx];
    const t = line.trim();
    if (!t) { idx++; continue; }
    if (t.startsWith("//") || t.startsWith("#")) { idx++; continue; }
    if (blockDeclRe.test(line)) break;
    if (
      /^\s*(?:->|<>|::)/.test(line) ||
      /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:=/.test(line)
    )
      break;

    // Stop if we've dedented back past the body level.
    const lineIndent = line.match(/^(\s*)/)[1].length;
    if (idx > startIdx && lineIndent < bodyIndent) break;

    const parsed = parseTargetKey(line);
    if (!parsed) break;

    const { key, rest } = parsed;
    const keyLower = key.toLowerCase();

    // trail: accepts an inline array literal, or defaults to [].
    if (keyLower === "trail") {
      const trailSrc = rest.trim();
      if (trailSrc) {
        kv["trail"] = parseValue(trailSrc);
      } else {
        kv["trail"] = [];
      }
      idx++;
      continue;
    }

    // state: and meta: with no inline value → parse indented sub-block.
    if (SUB_BLOCK_KEYS.has(keyLower) && !rest.trim()) {
      const sub = parseSubBlock(lines, idx + 1, lineIndent);
      kv[keyLower] = sub.body;
      idx = sub.nextIdx;
      continue;
    }

    // state: {...} or meta: {...} inline object.
    if (SUB_BLOCK_KEYS.has(keyLower) && rest.trim()) {
      let acc = rest;
      let bal = countBalance(acc);
      while (
        (bal.p !== 0 || bal.b !== 0 || bal.c !== 0) &&
        idx + 1 < lines.length
      ) {
        idx++;
        acc += "\n" + lines[idx];
        bal = countBalance(acc);
      }
      kv[keyLower] = parseValue(acc);
      idx++;
      continue;
    }

    // All other keys: parse value, preserve key casing.
    let acc = rest ?? "";
    let bal = countBalance(acc);
    while (
      (bal.p !== 0 || bal.b !== 0 || bal.c !== 0) &&
      idx + 1 < lines.length
    ) {
      idx++;
      acc += "\n" + lines[idx];
      bal = countBalance(acc);
    }

    kv[key] = parseValue(acc);
    idx++;
  }

  return { body: kv, nextIdx: idx };
}

function parseProgram(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const body = [];
  const blockDeclRe = /^\s*@([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/;

  let idx = 0;
  while (idx < lines.length) {
    const raw = lines[idx];
    const t = raw.trim();

    if (!t || t.startsWith("//") || t.startsWith("#")) {
      idx++;
      continue;
    }

    const decl = raw.match(blockDeclRe);
    if (decl) {
      const { body: targetBody, nextIdx } = parseTargetBody(lines, idx + 1);
      body.push({ kind: "TargetDecl", name: decl[1], body: targetBody });
      idx = nextIdx;
      continue;
    }

    let stmtText = t;
    idx++;

    // Assemble a full statement by handling both:
    // 1) chain continuation lines that begin with '->'
    // 2) multiline expressions where (), [], {} are not yet balanced.
    while (true) {
      while (idx < lines.length && /^(->|<>|::)/.test(lines[idx].trim())) {
        stmtText += " " + lines[idx].trim();
        idx++;
      }

      const bal = countBalance(stmtText);
      if (bal.p === 0 && bal.b === 0 && bal.c === 0) break;
      if (idx >= lines.length) break;

      stmtText += "\n" + lines[idx];
      idx++;
    }

    const bind = stmtText.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*(.+)$/s);
    if (bind) {
      body.push({ kind: "Bind", name: bind[1], expr: parseExpr(bind[2]) });
    } else {
      body.push(parseExpr(stmtText));
    }
  }

  return { kind: "Program", body };
}

export { parseProgram };