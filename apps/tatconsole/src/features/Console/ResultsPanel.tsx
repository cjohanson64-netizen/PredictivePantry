import React, { useMemo, useState } from "react"
import styles from "./styles/TatConsole.module.css"

type PanelTab = "graph" | "value" | "artifacts" | "error"

function safeStringify(v: any) {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

function isTrellisGraph(v: any) {
  if (!v || typeof v !== "object") return false
  const hasNodes = Array.isArray(v.nodes)
  const hasEdges = Array.isArray(v.edges)
  const hasRoot = typeof v.root === "string" || v.root == null
  const hasState = v.state == null || typeof v.state === "object"
  const hasMeta = v.meta == null || typeof v.meta === "object"
  return hasNodes && hasEdges && hasRoot && hasState && hasMeta
}

function normalizeEdges(edges: any[]): Array<[string, string, string]> {
  // Support triple edges, or tolerate pairs by padding relation.
  const out: Array<[string, string, string]> = []
  for (const e of edges ?? []) {
    if (Array.isArray(e) && e.length === 3) {
      out.push([String(e[0]), String(e[1]), String(e[2])])
      continue
    }
    if (Array.isArray(e) && e.length === 2) {
      out.push([String(e[0]), "entwinesWith", String(e[1])])
      continue
    }
    // object form {subject, relation, object}
    if (e && typeof e === "object") {
      const s = e.subject ?? e.from ?? e.a
      const r = e.relation ?? e.rel ?? e.type
      const o = e.object ?? e.to ?? e.b
      if (s != null && o != null) out.push([String(s), String(r ?? "entwinesWith"), String(o)])
    }
  }
  return out
}

function GraphViewer({ graph }: { graph: any }) {
  const [nodeQuery, setNodeQuery] = useState("")
  const [edgeQuery, setEdgeQuery] = useState("")

  const nodes: string[] = useMemo(() => {
    const raw = Array.isArray(graph?.nodes) ? graph.nodes : []
    return raw.map((n: any) => String(n))
  }, [graph])

  const edges = useMemo(() => normalizeEdges(graph?.edges ?? []), [graph])

  const filteredNodes = useMemo(() => {
    const q = nodeQuery.trim().toLowerCase()
    if (!q) return nodes
    return nodes.filter((n) => n.toLowerCase().includes(q))
  }, [nodes, nodeQuery])

  const filteredEdges = useMemo(() => {
    const q = edgeQuery.trim().toLowerCase()
    if (!q) return edges
    return edges.filter(([s, r, o]) => {
      const hay = `${s} ${r} ${o}`.toLowerCase()
      return hay.includes(q)
    })
  }, [edges, edgeQuery])

  const root = graph?.root ?? null
  const state = graph?.state ?? {}
  const meta = graph?.meta ?? {}

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className={styles.smallLabel}>
        root: <b style={{ color: "rgba(255,255,255,0.92)" }}>{String(root)}</b> · nodes:{" "}
        <b style={{ color: "rgba(255,255,255,0.92)" }}>{nodes.length}</b> · edges:{" "}
        <b style={{ color: "rgba(255,255,255,0.92)" }}>{edges.length}</b>
      </div>

      {/* Nodes */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Nodes</div>
          <input
            value={nodeQuery}
            onChange={(e) => setNodeQuery(e.target.value)}
            placeholder="search nodes…"
            style={{ flex: 1, padding: 8, borderRadius: 10 }}
          />
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div style={{ maxHeight: 140, overflow: "auto" }}>
            {filteredNodes.length === 0 ? (
              <div className={styles.smallLabel} style={{ padding: 10 }}>
                No matching nodes.
              </div>
            ) : (
              filteredNodes.map((n) => (
                <div
                  key={n}
                  style={{
                    padding: "8px 10px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                  }}
                >
                  {n}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edges */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Edges</div>
          <input
            value={edgeQuery}
            onChange={(e) => setEdgeQuery(e.target.value)}
            placeholder="filter edges…"
            style={{ flex: 1, padding: 8, borderRadius: 10 }}
          />
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
            {["subject", "relation", "object"].map((h) => (
              <div
                key={h}
                className={styles.smallLabel}
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {h}
              </div>
            ))}
          </div>

          <div style={{ maxHeight: 180, overflow: "auto" }}>
            {filteredEdges.length === 0 ? (
              <div className={styles.smallLabel} style={{ padding: 10 }}>
                No matching edges.
              </div>
            ) : (
              filteredEdges.map(([s, r, o], idx) => (
                <div
                  key={`${s}|${r}|${o}|${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {[s, r, o].map((cell, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "8px 10px",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={cell}
                    >
                      {cell}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* State + Meta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>State</div>
          <pre className={styles.pre} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 10 }}>
            {safeStringify(state)}
          </pre>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Meta</div>
          <pre className={styles.pre} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 10 }}>
            {safeStringify(meta)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function ResultsPanel({
  last,
}: {
  last: null | {
    ok: boolean
    value?: any
    artifacts?: any
    error?: { message: string; stack?: string }
    ms: number
  }
}) {
  const [tab, setTab] = useState<PanelTab>("graph")

  const value = last?.value
  const artifacts = last?.artifacts
  const hasGraph = isTrellisGraph(value)

  const tabs: Array<{ id: PanelTab; label: string; enabled: boolean }> = [
    { id: "graph", label: "Graph", enabled: !!last && last.ok && hasGraph },
    { id: "value", label: "Raw value", enabled: !!last && last.ok },
    { id: "artifacts", label: "Artifacts", enabled: !!last && last.ok },
    { id: "error", label: "Error", enabled: !!last && !last.ok },
  ]

  // Auto-pick a sensible tab when results change
  React.useEffect(() => {
    if (!last) return
    if (!last.ok) setTab("error")
    else if (isTrellisGraph(last.value)) setTab("graph")
    else setTab("value")
  }, [last])

  return (
  <div style={{ display: "grid", gridTemplateRows: "44px 1fr", height: "100%" }}>
    <div className={styles.outputHeader}>
      {tabs.map((t) => (
        <button
          key={t.id}
          disabled={!t.enabled}
          className={`${styles.button} ${tab === t.id ? styles.buttonActive : ""}`}
          onClick={() => t.enabled && setTab(t.id)}
          style={{
            opacity: t.enabled ? 1 : 0.4,
            cursor: t.enabled ? "pointer" : "not-allowed",
          }}
        >
          {t.label}
        </button>
      ))}

      {/* Status pill (top-right) */}
      <div
        className={`${styles.statusPill} ${
          !last ? styles.statusNeutral : last.ok ? styles.statusOk : styles.statusErr
        }`}
        title={last ? (last.ok ? "Last run succeeded" : "Last run failed") : "No runs yet"}
      >
        {last ? (last.ok ? `OK · ${last.ms}ms` : `ERROR · ${last.ms}ms`) : "—"}
      </div>
    </div>

    <div className={styles.outputBody}>
      {!last ? (
        <div className={styles.smallLabel}>Run a program to see results.</div>
      ) : last.ok ? (
        tab === "graph" && hasGraph ? (
          <GraphViewer graph={value} />
        ) : tab === "artifacts" ? (
          <pre className={styles.pre}>{safeStringify(artifacts)}</pre>
        ) : (
          <pre className={styles.pre}>{safeStringify(value)}</pre>
        )
      ) : (
        <pre className={styles.pre}>
          {last.error?.message}
          {"\n\n"}
          {last.error?.stack ?? ""}
        </pre>
      )}
    </div>
  </div>
)}