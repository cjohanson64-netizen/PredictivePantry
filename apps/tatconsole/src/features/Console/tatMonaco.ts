import type * as monaco from "monaco-editor";

type TatOpSpec = {
  name: string;
  signature: string;
  summary: string;
  insert?: string;
  aliases?: string[];
};

const TAT_OP_SPECS: TatOpSpec[] = [
  {
    name: "seedgraph",
    signature: "@seedgraph(graphLike)",
    summary:
      "Normalize input into graph shape { nodes, edges, state, meta, trail, root, weights? } while preserving extra fields.",
  },
  {
    name: "graft",
    signature: "@graft(subtree)",
    summary: "Merge a subtree into an existing graph without duplicating existing members.",
  },
  {
    name: "prune",
    signature: "@prune(range)",
    summary: "Remove a range of nodes and connected edges from the graph.",
  },
  {
    name: "reroot",
    signature: "@reroot(node)",
    summary: "Change the designated root node without changing graph content.",
    insert: 'reroot("${1:nodeId}")',
  },
  {
    name: "retip",
    signature: "@retip(node, with)",
    summary: "Rename one node everywhere it appears: nodes, edges, and root.",
  },
  {
    name: "swap",
    signature: "@swap(nodeA, nodeB)",
    summary: "Swap two node identities throughout nodes, edges, and root.",
  },
  {
    name: "select",
    signature: "@select(nodes, root?)",
    summary: "Return a subgraph containing only selected nodes and connecting edges.",
  },
  {
    name: "path",
    signature: "@path(from, to, mode?)",
    summary: "Find shortest path between two nodes (BFS/DFS).",
    insert: 'path(from: "${1:A}", to: "${2:B}", mode: "${3:bfs}")',
  },
  {
    name: "wander",
    signature: "@wander(steps, strategy?, weights?, seed?)",
    summary: "Perform random or weighted walk from root and return the walked path.",
  },
  {
    name: "match",
    signature: "@match(glob, in?)",
    summary: "Match nodes or edge endpoints using a glob pattern.",
  },
  {
    name: "canopy",
    signature: '@canopy(mode: "surface")',
    summary: "Run BFS from root and return reachable nodes and adjacency metadata.",
  },
  {
    name: "trellis",
    signature: "@trellis(mode, perRow?)",
    summary: "Produce layout descriptor with node coordinates (linear/page).",
  },
  {
    name: "entwine",
    signature: "@entwine(segments, namespace?)",
    summary: "Join graph segments end-to-end and bridge segment endpoints.",
  },
  {
    name: "graft.branch",
    signature: "@graft.branch(subject, relation, object)",
    summary: "Add typed edge to trellis if missing.",
    aliases: ["graftbranch"],
    insert: 'graft.branch("${1:subject}", "${2:relation}", "${3:object}")',
  },
  {
    name: "graft.bud",
    signature: "@graft.bud(entity, dimension, value)",
    summary: "Set a state dimension value on an entity.",
    aliases: ["graftbud"],
  },
  {
    name: "graft.leaf",
    signature: "@graft.leaf(entity, key, value)",
    summary: "Set a metadata key on an entity.",
    aliases: ["graftleaf"],
  },
  {
    name: "graft.vine",
    signature: "@graft.vine(entity, dimension, from, to, trail?)",
    summary: "Apply guarded state transition and optionally append trail info.",
    aliases: ["graftvine"],
  },
  {
    name: "prune.branch",
    signature: "@prune.branch(subject, relation, object)",
    summary: "Remove a specific typed edge from trellis.",
    aliases: ["prunebranch"],
    insert: 'prune.branch("${1:subject}", "${2:relation}", "${3:object}")',
  },
  {
    name: "prune.bud",
    signature: "@prune.bud(entity, dimension)",
    summary: "Delete a state property from an entity.",
    aliases: ["prunebud"],
  },
  {
    name: "prune.leaf",
    signature: "@prune.leaf(entity, key)",
    summary: "Delete a metadata property from an entity.",
    aliases: ["pruneleaf"],
  },
  {
    name: "prune.vine",
    signature: "@prune.vine(entity, dimension)",
    summary: "Soft-clear a state property by setting it to null.",
    aliases: ["prunevine"],
  },
  {
    name: "assay",
    signature: "@assay(entity, metric, value, meta?)",
    summary: "Record a measurement/metric in entity state with optional metadata.",
  },
  {
    name: "utterance",
    signature: "@utterance(septoken?, endtoken?, groups?)",
    summary: "Convert path/graph tokens into a string output.",
  },
  {
    name: "sprout",
    signature: "@sprout(plan)",
    summary: "Realize selector plan into concrete flat value sequence.",
  },
  {
    name: "realize",
    signature: "@realize(plan)",
    summary: "Alias of @sprout.",
  },
  {
    name: "action",
    signature: "@action(params, handlers) { ... }",
    summary: "Define callable action scaffold with params, handlers, and body ops.",
  },
  {
    name: "guard",
    signature: "@guard(nodeRef, callable)",
    summary: "Invoke callable only if noderef is valid in current graph.",
  },
  {
    name: "ctx",
    signature: "@ctx",
    summary: "Return current runtime context object.",
  },
  {
    name: "inspect",
    signature: "@inspect",
    summary: "Return both raw graph and normalized trellis view side-by-side.",
  },
];

const TAT_OPS = Array.from(
  new Set(
    TAT_OP_SPECS.flatMap((spec) => [spec.name, ...(spec.aliases ?? [])]).concat(
      "seed",
    ),
  ),
);

const TAT_ALIAS_TO_CANONICAL = new Map<string, string>();
for (const spec of TAT_OP_SPECS) {
  for (const alias of spec.aliases ?? []) TAT_ALIAS_TO_CANONICAL.set(alias, spec.name);
}

function levenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

function suggestOps(op: string, limit = 3) {
  const needle = op.toLowerCase();
  const maxDistance = Math.max(2, Math.floor(needle.length * 0.4));
  return TAT_OPS.map((candidate) => ({
    candidate,
    distance: levenshtein(needle, candidate.toLowerCase()),
  }))
    .filter((x) => x.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))
    .slice(0, limit)
    .map((x) => x.candidate);
}

// ─── Register TAT language ───────────────────────────────────────────────────
export function registerTatLanguage(monaco: any) {
  // Avoid double-registering
  const existing = monaco.languages
    .getLanguages()
    .find((l: any) => l.id === "tat");
  if (!existing) {
    monaco.languages.register({
      id: "tat",
      extensions: [".tat"],
      aliases: ["TAT"],
    });
  }

  // ── Tokenizer (syntax highlighting) ────────────────────────────────────────
  monaco.languages.setMonarchTokensProvider("tat", {
    defaultToken: "",
    tokenPostfix: ".tat",

    keywords: ["true", "false", "null"],

    ops: TAT_OPS,

    tokenizer: {
      root: [
        // Comments
        [/\/\/.*$/, "comment"],
        [/#.*$/, "comment"],

        // Target block declarations: @seed:
        [/@([A-Za-z_][A-Za-z0-9_]*)(?=\s*:)/, "entity.name.function"],

        // Inline invocations: @prune.branch, @path, etc.
        [
          /@([A-Za-z_][A-Za-z0-9_.]+)/,
          {
            cases: {
              "@ops": "support.function",
              "@default": "variable.other",
            },
          },
        ],

        // Pipe / tap / bind operators
        [/->/, "keyword.operator"],
        [/<>/, "keyword.operator"],
        [/::/, "keyword.operator"],
        [/:=/, "keyword.operator.assignment"],

        // Markers
        [/!!!|:::|[?]{3}|[/]{3}/, "invalid.illegal"],

        // Named args (key:) inside calls
        [/([A-Za-z_][A-Za-z0-9_]*)\s*(?=:)/, "variable.parameter"],

        // Keys in seed/target blocks
        [/^\s*(nodes|edges|state|meta|trail|root|weights)\s*(?=:)/, "support.type"],

        // Strings
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],

        // Numbers
        [/-?\d+(\.\d+)?/, "number"],

        // Booleans / null
        [/\b(true|false|null)\b/, "constant.language"],

        // Identifiers / refs
        [/[A-Za-z_][A-Za-z0-9_]*/, "identifier"],

        // Brackets
        [/[[\]{}()]/, "@brackets"],

        // Punctuation
        [/[,]/, "delimiter"],
      ],
    },
  } as monaco.languages.IMonarchLanguage);

  // ── Theme ───────────────────────────────────────────────────────────────────
  monaco.editor.defineTheme("tat-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5c6773", fontStyle: "italic" },
      {
        token: "entity.name.function",
        foreground: "c594c5",
        fontStyle: "bold",
      }, // @seed:
      { token: "support.function", foreground: "5ccfe6" }, // @path, @sprout
      { token: "variable.other", foreground: "73d0ff" }, // unknown @ops
      { token: "keyword.operator", foreground: "f29e74", fontStyle: "bold" }, // ->
      { token: "keyword.operator.assignment", foreground: "f29e74" }, // :=
      { token: "support.type", foreground: "bae67e" }, // nodes: edges:
      { token: "variable.parameter", foreground: "ffd580" }, // named args
      { token: "string", foreground: "d5ff80" },
      { token: "number", foreground: "f28779" },
      { token: "constant.language", foreground: "ffcc66" },
      { token: "identifier", foreground: "cdd9e5" },
      { token: "delimiter", foreground: "cdd9e5" },
      { token: "invalid.illegal", foreground: "ff3333", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#0c121b",
      "editor.foreground": "#cdd9e5",
      "editorLineNumber.foreground": "#3d4d5c",
      "editorLineNumber.activeForeground": "#7d8fa8",
      "editor.lineHighlightBackground": "#111827",
      "editorCursor.foreground": "#5ccfe6",
      "editor.selectionBackground": "#1a3a5c",
      "editorGutter.background": "#0c121b",
      "editorWidget.background": "#0f1621",
      "editorWidget.border": "#1e2d3d",
    },
  });

  // ── Autocomplete ────────────────────────────────────────────────────────────
  monaco.languages.registerCompletionItemProvider("tat", {
    triggerCharacters: ["@", "."],
    provideCompletionItems(model: any, position: any) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const linePrefix = model
        .getLineContent(position.lineNumber)
        .slice(0, position.column - 1);
      const atMatch = linePrefix.match(/@([A-Za-z0-9_.]*)?$/);

      if (atMatch) {
        const suggestions: monaco.languages.CompletionItem[] = [];
        for (const spec of TAT_OP_SPECS) {
          suggestions.push({
            label: `@${spec.name}`,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: spec.insert ?? spec.name,
            insertTextRules: spec.insert
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            range,
            detail: spec.signature,
            documentation: spec.summary,
            sortText: `0_${spec.name}`,
          });
          for (const alias of spec.aliases ?? []) {
            suggestions.push({
              label: `@${alias}`,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: alias,
              range,
              detail: `${spec.signature} (alias)`,
              documentation: `Alias of @${spec.name}. ${spec.summary}`,
              sortText: `1_${alias}`,
            });
          }
        }
        suggestions.push({
          label: "@seed",
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: "seed",
          range,
          detail: "@seed target reference",
          documentation: "Reference the graph declared by a @seed: target block.",
          sortText: "2_seed",
        });
        return { suggestions };
      }

      // Keyword / snippet suggestions
      const snippets: monaco.languages.CompletionItem[] = [
        {
          label: "@seed block",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "@seed:",
            '  nodes: ["A", "B"]',
            '  edges: [["A","B"]]',
            "  state: {}",
            "  meta: {}",
            "  trail: []",
            '  root: "A"',
            "  weights: { default: 0.5 }",
            "",
            "g := @seed",
          ].join("\n"),
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Scaffold a @seed target block",
          range,
        },
        {
          label: "@sprout plan",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "plan := {",
            "  valueSets: {",
            '    ${1:A}: ["${2:x}", "${3:y}", "${4:z}"]',
            "  },",
            "  track: track,",
            "  selectors: [1,2,3]",
            "}",
            "out := @sprout(plan, stride: ${5:3}, selectorMap: { _1: 0, _2: 1, _3: 2 })",
          ].join("\n"),
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Scaffold a @sprout plan",
          range,
        },
        {
          label: "@path",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText:
            'g -> @path(from: "${1:A}", to: "${2:B}", mode: "${3:dfs}")',
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Derive a path through the graph",
          range,
        },
        {
          label: "@reroot",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'g -> @reroot("${1:NewRoot}")',
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Reroot the graph to a new node",
          range,
        },
      ];

      return { suggestions: snippets };
    },
  });

  // ── Lint / validation ───────────────────────────────────────────────────────
  function validateTat(model: any) {
    const text = model.getValue();
    const lines = text.split("\n");
    const markers: any[] = [];

    // Track bind names for undefined-ref checking
    const defined = new Set<string>(["seed", "g", "track", "plan", "out"]);
    const bindRe = /^([A-Za-z_][A-Za-z0-9_]*)\s*:=/;
    const targetRe = /^\s*@([A-Za-z_][A-Za-z0-9_]*)\s*:/;

    // First pass — collect bindings
    for (const line of lines) {
      const m = line.match(bindRe);
      if (m) defined.add(m[1]);
      const t = line.match(targetRe);
      if (t) defined.add(t[1]);
    }

    // Second pass — lint rules
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Rule: @prune.branch must have exactly 3 positional args
      const pruneBranchM = line.match(/@prune\.branch\(([^)]*)\)/);
      if (pruneBranchM) {
        const args = pruneBranchM[1]
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);

        if (args.length !== 3) {
          const col = line.indexOf("@prune.branch") + 1;
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: `@prune.branch requires 3 args (subject, relation, object) — got ${args.length}`,
            startLineNumber: lineNum,
            startColumn: col,
            endLineNumber: lineNum,
            endColumn: col + "@prune.branch".length,
          });
        }
      }

      // Rule: @graft.branch must have exactly 3 positional args
      const graftBranchM = line.match(/@graft\.branch\(([^)]*)\)/);
      if (graftBranchM) {
        const args = graftBranchM[1]
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);

        if (args.length !== 3) {
          const col = line.indexOf("@graft.branch") + 1;
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: `@graft.branch requires 3 args (subject, relation, object) — got ${args.length}`,
            startLineNumber: lineNum,
            startColumn: col,
            endLineNumber: lineNum,
            endColumn: col + "@graft.branch".length,
          });
        }
      }

      // Rule: @path from and to must be different
      const pathSameM = line.match(
        /@path\([^)]*from:\s*["']([^"']+)["'][^)]*to:\s*["']([^"']+)["']/,
      );
      if (pathSameM && pathSameM[1] === pathSameM[2]) {
        const col = line.indexOf("@path") + 1;
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: `@path from and to are the same node ("${pathSameM[1]}") — will return a single-element array, not a traversal`,
          startLineNumber: lineNum,
          startColumn: col,
          endLineNumber: lineNum,
          endColumn: col + "@path".length,
        });
      }

      // Rule: unknown @op
      const opMatches = [...line.matchAll(/@([A-Za-z_][A-Za-z0-9_.]*)/g)];
      for (const match of opMatches) {
        const opName = match[1];
        // Skip target block declarations (followed by :)
        const afterMatch = line
          .slice((match.index ?? 0) + match[0].length)
          .trimStart();
        if (afterMatch.startsWith(":")) continue;
        if (!TAT_OPS.includes(opName) && !defined.has(opName)) {
          const col = (match.index ?? 0) + 1;
          const candidates = suggestOps(opName);
          const suggestion = candidates.length
            ? ` Did you mean ${candidates.map((x) => `@${x}`).join(", ")}?`
            : "";
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            message: `Unknown TAT op: @${opName}.${suggestion}`,
            code: "tat-unknown-op",
            startLineNumber: lineNum,
            startColumn: col,
            endLineNumber: lineNum,
            endColumn: col + opName.length + 1,
          });
        }
        const canonical = TAT_ALIAS_TO_CANONICAL.get(opName);
        if (canonical) {
          const col = (match.index ?? 0) + 1;
          markers.push({
            severity: monaco.MarkerSeverity.Hint,
            message: `Alias @${opName} is valid; prefer @${canonical} for canonical style.`,
            code: "tat-op-alias",
            startLineNumber: lineNum,
            startColumn: col,
            endLineNumber: lineNum,
            endColumn: col + opName.length + 1,
          });
        }
      }

      // Rule: unbalanced brackets on the line
      let parens = 0,
        brackets = 0,
        braces = 0;
      let inStr: string | null = null;
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (inStr) {
          if (ch === "\\") {
            ci++;
            continue;
          }
          if (ch === inStr) inStr = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          inStr = ch;
          continue;
        }
        if (ch === "(") parens++;
        else if (ch === ")") parens--;
        else if (ch === "[") brackets++;
        else if (ch === "]") brackets--;
        else if (ch === "{") braces++;
        else if (ch === "}") braces--;
      }
      if (parens !== 0 || brackets !== 0 || braces !== 0) {
        // Only flag if it's not a continuation line
        const nextLine = lines[i + 1]?.trim() ?? "";
        const isContinuation =
          nextLine.startsWith("->") ||
          nextLine.startsWith("<>") ||
          nextLine.startsWith("::");
        if (!isContinuation && parens < 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: "Unmatched closing parenthesis",
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: line.length + 1,
          });
        }
      }
    }

    monaco.editor.setModelMarkers(model, "tat-lint", markers);
  }

  // Run lint on model changes (debounced)
  let lintTimer: ReturnType<typeof setTimeout> | null = null;
  monaco.editor.onDidCreateModel((model: any) => {
    if (model.getLanguageId() !== "tat") return;
    validateTat(model);
    model.onDidChangeContent(() => {
      if (lintTimer) clearTimeout(lintTimer);
      lintTimer = setTimeout(() => validateTat(model), 400);
    });
  });
}
