import React, { useMemo, useState, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { PROGRAMS, ProgramEntry } from "./programLibrary";
import { runTatSafe } from "./runTatAdapter";
import { registerTatLanguage } from "./tatMonaco";
import ResultsPanel from "./ResultsPanel";
import styles from "./styles/TatConsole.module.css";

export default function TatConsole() {
  const [selectedId, setSelectedId] = useState(PROGRAMS[0].id);

  const selected: ProgramEntry = useMemo(
    () => PROGRAMS.find((p) => p.id === selectedId) ?? PROGRAMS[0],
    [selectedId],
  );

  const [source, setSource] = useState(selected.source.trimStart());
  const [trace, setTrace] = useState(false);
  const [last, setLast] = useState<ReturnType<typeof runTatSafe> | null>(null);

  // Keep a ref to the editor instance so we can read the latest value on Run
  const editorRef = useRef<any>(null);

  const loadExample = (p: ProgramEntry) => {
    setSelectedId(p.id);
    const src = p.source.trimStart();
    setSource(src);
    setLast(null);
    if (editorRef.current) {
      editorRef.current.setValue(src);
    }
  };

  const run = () => {
    const src = editorRef.current ? editorRef.current.getValue() : source;
    const result = runTatSafe(src, { trace });
    setLast(result);
  };

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;

    // Register TAT language + theme
    registerTatLanguage(monaco);

    // Apply language and theme to this model
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, "tat");
    }
    monaco.editor.setTheme("tat-dark");

    // Ctrl/Cmd+Enter → Run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const src = editor.getValue();
      const result = runTatSafe(src, { trace });
      setLast(result);
    });
  }, [trace]);

  return (
    <div className={styles.root}>
      {/* Run Panel */}
      <aside className={styles.runPanel}>
        <h2>Run</h2>

        <button className={styles.primaryButton} onClick={run}>
          ▶ Run Program
        </button>

        <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          or Ctrl+Enter
        </div>

        <div style={{ marginTop: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={trace}
              onChange={(e) => setTrace(e.target.checked)}
            />{" "}
            trace
          </label>
        </div>

        <h3 style={{ marginTop: 24 }}>Program Library</h3>

        <div className={styles.programList}>
          {PROGRAMS.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => loadExample(p)}
                className={`${styles.programButton} ${
                  active ? styles.programButtonActive : ""
                }`}
              >
                {p.title}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Source Panel — Monaco */}
      <section className={styles.sourcePanel}>
        <h2>Source</h2>
        <div style={{ height: "calc(100% - 40px)", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Editor
            defaultLanguage="tat"
            defaultValue={source}
            theme="tat-dark"
            onChange={(val: string | undefined) => setSource(val ?? "")}
            onMount={handleEditorMount}
            options={{
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderLineHighlight: "line",
              tabSize: 2,
              insertSpaces: true,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
              },
              glyphMargin: true,
              lineNumbers: "on",
              folding: false,
              suggest: {
                showSnippets: true,
              },
            }}
          />
        </div>
      </section>

      {/* Results Panel */}
      <section className={styles.resultsPanel}>
        <ResultsPanel last={last} />
      </section>
    </div>
  );
}