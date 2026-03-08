import { createRuntimeError } from "../runtime/createRuntimeError.js"

const SECTION_ORDER = [
  "program",
  "feature",
  "purpose",
  "inputs",
  "state-read",
  "actions",
  "decisions",
  "transitions",
  "outputs",
  "events",
  "notes",
]

const REQUIRED_SECTIONS = [
  "program",
  "feature",
  "purpose",
  "inputs",
  "actions",
  "decisions",
  "transitions",
  "events",
]

const SCALAR_SECTIONS = new Set(["program", "feature", "purpose"])
const LIST_SECTIONS = new Set(["inputs", "state-read", "actions", "decisions", "events", "notes"])
const STRUCTURED_SECTIONS = new Set(["transitions", "outputs"])

function toCamelCase(value) {
  return String(value).replace(/-([a-zA-Z0-9])/g, (_, part) => part.toUpperCase())
}

function createParseError({ type, message, fileName, featureName, line, section }) {
  return createRuntimeError({
    type,
    layer: "parser",
    featureName: featureName ?? null,
    programName: null,
    actionName: null,
    message,
    details: {
      fileName,
      line,
      section,
    },
  })
}

export function parseTat(rawText, options = {}) {
  const fileName = options.fileName ?? "unknown.tat"
  const featureName = options.featureName ?? "unknown"

  const errors = []
  const raw = String(rawText ?? "")

  const lines = raw.split(/\r?\n/)
  const dividerIndex = lines.findIndex((line) => line.trim() === "---")
  if (dividerIndex === -1) {
    errors.push(
      createParseError({
        type: "MalformedTat",
        message: 'Missing required metadata/body divider "---"',
        fileName,
        featureName,
        line: 1,
        section: null,
      }),
    )
    return { ok: false, errors }
  }

  const metadataLines = lines.slice(0, dividerIndex)
  const sourceLines = lines.slice(dividerIndex + 1)

  for (let i = 0; i < metadataLines.length; i += 1) {
    const line = metadataLines[i]
    if (line.includes("\t")) {
      errors.push(
        createParseError({
          type: "MalformedIndentation",
          message: "Tabs are not allowed",
          fileName,
          featureName,
          line: i + 1,
          section: null,
        }),
      )
    }
    if (line.trim().startsWith("#")) {
      errors.push(
        createParseError({
          type: "CommentNotAllowed",
          message: "Comments are not allowed in v1 TAT metadata",
          fileName,
          featureName,
          line: i + 1,
          section: null,
        }),
      )
    }
  }

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i]
    if (line.includes("\t")) {
      errors.push(
        createParseError({
          type: "MalformedIndentation",
          message: "Tabs are not allowed",
          fileName,
          featureName,
          line: dividerIndex + i + 2,
          section: "source",
        }),
      )
    }
    if (line.trim().startsWith("#")) {
      errors.push(
        createParseError({
          type: "CommentNotAllowed",
          message: "Comments are not allowed in v1 TAT source",
          fileName,
          featureName,
          line: dividerIndex + i + 2,
          section: "source",
        }),
      )
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const sectionData = {}
  const seenSections = new Set()
  let currentIndex = -1

  let i = 0
  while (i < metadataLines.length) {
    const rawLine = metadataLines[i]
    const line = rawLine.trimEnd()

    if (!line.trim()) {
      i += 1
      continue
    }

    const topLevelMatch = /^([a-z-]+):(?:\s*(.*))?$/.exec(line)
    if (!topLevelMatch || rawLine.startsWith(" ")) {
      errors.push(
        createParseError({
          type: "MalformedSection",
          message: "Expected top-level section declaration",
          fileName,
          featureName,
          line: i + 1,
          section: null,
        }),
      )
      i += 1
      continue
    }

    const section = topLevelMatch[1]
    const inlineValue = topLevelMatch[2] ?? ""

    if (!SECTION_ORDER.includes(section)) {
      errors.push(
        createParseError({
          type: "UnknownSection",
          message: `Unknown section: ${section}`,
          fileName,
          featureName,
          line: i + 1,
          section,
        }),
      )
      i += 1
      continue
    }

    if (seenSections.has(section)) {
      errors.push(
        createParseError({
          type: "DuplicateSection",
          message: `Duplicate section: ${section}`,
          fileName,
          featureName,
          line: i + 1,
          section,
        }),
      )
      i += 1
      continue
    }

    const thisIndex = SECTION_ORDER.indexOf(section)
    if (thisIndex < currentIndex) {
      errors.push(
        createParseError({
          type: "SectionOrderError",
          message: `Section ${section} appears out of required order`,
          fileName,
          featureName,
          line: i + 1,
          section,
        }),
      )
    }
    currentIndex = thisIndex
    seenSections.add(section)

    if (SCALAR_SECTIONS.has(section)) {
      if (!inlineValue.trim()) {
        errors.push(
          createParseError({
            type: "MalformedScalarSection",
            message: `Section ${section} requires an inline scalar value`,
            fileName,
            featureName,
            line: i + 1,
            section,
          }),
        )
      } else {
        sectionData[section] = inlineValue.trim()
      }
      i += 1
      continue
    }

    if (inlineValue.trim()) {
      errors.push(
        createParseError({
          type: "MalformedSection",
          message: `Section ${section} must not include an inline value`,
          fileName,
          featureName,
          line: i + 1,
          section,
        }),
      )
      i += 1
      continue
    }

    const startLine = i + 1
    i += 1

    if (LIST_SECTIONS.has(section)) {
      const items = []
      while (i < metadataLines.length) {
        const currentLine = metadataLines[i]
        if (!currentLine.trim()) {
          i += 1
          continue
        }
        if (!currentLine.startsWith("  ")) break

        if (!/^  -\s+.+$/.test(currentLine)) {
          errors.push(
            createParseError({
              type: "MalformedListItem",
              message: `Malformed list item in ${section}`,
              fileName,
              featureName,
              line: i + 1,
              section,
            }),
          )
          i += 1
          continue
        }

        items.push(currentLine.replace(/^  -\s+/, "").trim())
        i += 1
      }

      if (items.length === 0) {
        errors.push(
          createParseError({
            type: "MalformedListSection",
            message: `Section ${section} requires at least one list item`,
            fileName,
            featureName,
            line: startLine,
            section,
          }),
        )
      }
      sectionData[section] = items
      continue
    }

    if (STRUCTURED_SECTIONS.has(section)) {
      const blocks = []
      let activeBlock = null

      while (i < metadataLines.length) {
        const currentLine = metadataLines[i]
        if (!currentLine.trim()) {
          i += 1
          continue
        }
        if (!currentLine.startsWith("  ")) break

        if (currentLine.startsWith("  - ")) {
          const first = currentLine.replace(/^  -\s+/, "")
          const firstMatch = /^([a-z-]+):\s*(.+)$/.exec(first)
          if (!firstMatch) {
            errors.push(
              createParseError({
                type: "MalformedNestedBlock",
                message: `Malformed nested block item in ${section}`,
                fileName,
                featureName,
                line: i + 1,
                section,
              }),
            )
            i += 1
            continue
          }

          activeBlock = {
            [toCamelCase(firstMatch[1])]: firstMatch[2].trim(),
          }
          blocks.push(activeBlock)
          i += 1
          continue
        }

        if (!currentLine.startsWith("    ")) {
          errors.push(
            createParseError({
              type: "MalformedIndentation",
              message: `Nested properties in ${section} must use 4-space indentation`,
              fileName,
              featureName,
              line: i + 1,
              section,
            }),
          )
          i += 1
          continue
        }

        if (!activeBlock) {
          errors.push(
            createParseError({
              type: "MalformedNestedBlock",
              message: `Nested property appears before list item in ${section}`,
              fileName,
              featureName,
              line: i + 1,
              section,
            }),
          )
          i += 1
          continue
        }

        const nested = currentLine.trim()
        const nestedMatch = /^([a-z-]+):\s*(.+)$/.exec(nested)
        if (!nestedMatch) {
          errors.push(
            createParseError({
              type: "MalformedNestedBlock",
              message: `Malformed nested property in ${section}`,
              fileName,
              featureName,
              line: i + 1,
              section,
            }),
          )
          i += 1
          continue
        }

        activeBlock[toCamelCase(nestedMatch[1])] = nestedMatch[2].trim()
        i += 1
      }

      if (blocks.length === 0) {
        errors.push(
          createParseError({
            type: "MalformedNestedSection",
            message: `Section ${section} requires at least one nested block`,
            fileName,
            featureName,
            line: startLine,
            section,
          }),
        )
      }
      sectionData[section] = blocks
      continue
    }
  }

  for (const required of REQUIRED_SECTIONS) {
    if (!seenSections.has(required)) {
      errors.push(
        createParseError({
          type: "MissingSection",
          message: `Missing required section: ${required}`,
          fileName,
          featureName,
          line: 1,
          section: required,
        }),
      )
    }
  }

  const source = sourceLines.join("\n").trim()
  if (!source) {
    errors.push(
      createParseError({
        type: "MissingSource",
        message: "TAT source body cannot be empty",
        fileName,
        featureName,
        line: dividerIndex + 2,
        section: "source",
      }),
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      kind: "TatProgram",
      program: sectionData.program,
      feature: sectionData.feature,
      purpose: sectionData.purpose,
      inputs: sectionData.inputs ?? [],
      stateRead: sectionData["state-read"] ?? [],
      actions: sectionData.actions ?? [],
      decisions: sectionData.decisions ?? [],
      transitions: sectionData.transitions ?? [],
      outputs: sectionData.outputs ?? [],
      events: sectionData.events ?? [],
      notes: sectionData.notes ?? [],
      source,
    },
  }
}
