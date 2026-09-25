# vendor/

`codemirror.bundle.js` — a szerkesztőhöz szükséges külső könyvtárak egyetlen, előre összecsomagolt fájlban, hogy a szerkesztőnek ne kelljen build lépés. A `window.CM` objektumon keresztül érhetők el.

Tartalma: CodeMirror 6 (`@codemirror/view`, `state`, `commands`, `search`, `autocomplete`, `language`, `lang-markdown`, `@lezer/highlight`) és JSZip. A licencek a fájl végén vannak.

Újragenerálás (csak frissítéshez kell):

```bash
npm i codemirror @codemirror/lang-markdown @codemirror/autocomplete @codemirror/view \
      @codemirror/state @codemirror/language @codemirror/commands @codemirror/search jszip esbuild
cat > entry.js <<'JS'
export { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, Decoration, ViewPlugin, WidgetType, MatchDecorator, placeholder } from '@codemirror/view';
export { EditorState, EditorSelection, Compartment, StateEffect, Annotation } from '@codemirror/state';
export { history, defaultKeymap, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
export { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
export { autocompletion, completionKeymap, closeBrackets, startCompletion, closeCompletion, acceptCompletion } from '@codemirror/autocomplete';
export { syntaxHighlighting, HighlightStyle, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from '@codemirror/language';
export { markdown, markdownLanguage } from '@codemirror/lang-markdown';
export { tags } from '@lezer/highlight';
import JSZip from 'jszip';
export { JSZip };
JS
npx esbuild entry.js --bundle --minify --format=iife --global-name=CM --outfile=codemirror.bundle.js --legal-comments=eof
```
