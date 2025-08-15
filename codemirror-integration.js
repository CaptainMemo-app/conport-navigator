import { EditorState } from "https://cdn.skypack.dev/@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from "https://cdn.skypack.dev/@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "https://cdn.skypack.dev/@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from "https://cdn.skypack.dev/@codemirror/language";
import { json } from "https://cdn.skypack.dev/@codemirror/lang-json";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "https://cdn.skypack.dev/@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "https://cdn.skypack.dev/@codemirror/search";
import { linter, lintKeymap } from "https://cdn.skypack.dev/@codemirror/lint";


let editorView = null;

const basicSetup = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap
    ])
];

function createCodeMirrorEditor(container, content = '', language = 'json') {
  container.innerHTML = '';

  const state = EditorState.create({
    doc: content,
    extensions: [
      basicSetup,
      json(),
    ]
  });

  editorView = new EditorView({
    state,
    parent: container
  });

  return editorView;
}

// Enhanced JSON formatting with syntax highlighting and nested JSON support
function createEnhancedJSONEditor(container, jsonContent) {
    try {
        container.innerHTML = '';

        // Parse and format JSON with nested JSON handling
        let parsed;
        try {
            parsed = JSON.parse(jsonContent);

            // Handle ConPort data with stringified JSON in value fields
            if (parsed && typeof parsed === 'object') {
                parsed = expandNestedJSON(parsed);
            }

            jsonContent = JSON.stringify(parsed, null, 2);
        } catch (e) {
            // Not valid JSON, show as-is
        }

        return createCodeMirrorEditor(container, jsonContent, 'json');

    } catch (error) {
        console.error('Failed to create enhanced JSON editor:', error);
        container.innerHTML = `<pre style="padding: 20px; font-family: monospace;">${escapeHtml(jsonContent)}</pre>`;
        return null;
    }
}

// Recursively expand nested JSON strings in ConPort data
function expandNestedJSON(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => expandNestedJSON(item));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Check if this looks like stringified JSON
      if ((key === 'value' || key === 'content') &&
          (value.startsWith('{') || value.startsWith('['))) {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(value);
          result[key] = expandNestedJSON(parsed);
          continue;
        } catch (e) {
          // If parsing fails, try to handle escaped newlines
          if (value.includes('\\n')) {
            try {
              // Unescape newlines and try again
              const unescaped = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
              const parsed = JSON.parse(unescaped);
              result[key] = expandNestedJSON(parsed);
              continue;
            } catch (e2) {
              // Still failed, keep as string but format newlines
              result[key] = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
              continue;
            }
          }
        }
      }
      result[key] = value;
    } else {
      result[key] = expandNestedJSON(value);
    }
  }

  return result;
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export functions
window.createCodeMirrorEditor = createCodeMirrorEditor;
window.createEnhancedJSONEditor = createEnhancedJSONEditor;
window.expandNestedJSON = expandNestedJSON;
window.escapeHtml = escapeHtml;
window.getEditorView = () => editorView;