/**
 * CodeMirror 6 Editor Setup
 * 
 * Initializes CodeMirror 6 editor for code editing using ESM imports
 * Imports are resolved via Import Map in the HTML
 */

import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor } from '@codemirror/view';
import { EditorState, StateEffect } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from '@codemirror/language';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';

export async function initCodeEditor(containerElement) {
    if (!containerElement) {
        console.warn('CodeMirror editor container element not provided');
        return null;
    }
    
    // Clean up any existing CodeMirror instance in this container
    const existingEditor = containerElement.querySelector('.cm-editor');
    if (existingEditor) {
        existingEditor.remove();
    }
    
    // Clear container content
    containerElement.innerHTML = '';
    
    try {
        // Create editor state with JavaScript language support
        const startState = EditorState.create({
            doc: '',
            extensions: [
                highlightSpecialChars(),
                history(),
                foldGutter(),
                drawSelection(),
                dropCursor(),
                EditorState.allowMultipleSelections.of(true),
                indentOnInput(),
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                highlightSelectionMatches(),
                keymap.of([
                    ...searchKeymap,
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...historyKeymap,
                    ...foldKeymap,
                    ...completionKeymap,
                    ...lintKeymap
                ]),
                javascript(),
                oneDark,
                EditorView.lineWrapping,
                EditorView.theme({
                    '&': {
                        height: '100%'
                    },
                    '.cm-content': {
                        minHeight: '500px',
                        padding: '10px'
                    },
                    '.cm-scroller': {
                        overflow: 'auto !important',
                        scrollbarGutter: 'stable both-edges'
                    },
                    '.cm-editor': {
                        overflow: 'hidden'
                    },
                    '.cm-gutters': {
                        position: 'sticky',
                        left: '0',
                        zIndex: '1'
                    }
                })
            ]
        });
        
        // Create editor view
        const editorView = new EditorView({
            state: startState,
            parent: containerElement
        });
        
        // Create editor instance wrapper
        const editorInstance = {
            view: editorView,
            getValue: () => editorView.state.doc.toString(),
            setValue: (value) => {
                const transaction = editorView.state.update({
                    changes: { from: 0, to: editorView.state.doc.length, insert: value }
                });
                editorView.dispatch(transaction);
            },
            onChange: null,
            destroy: () => {
                if (editorView) {
                    editorView.destroy();
                }
            }
        };
        
        // Set up change listener
        const changeListenerExtension = EditorView.updateListener.of((update) => {
            if (update.docChanged && editorInstance.onChange) {
                editorInstance.onChange(update.state.doc.toString());
            }
        });
        
        // Update the editor state to include the change listener
        editorView.dispatch({
            effects: StateEffect.appendConfig.of([changeListenerExtension])
        });
        
        return editorInstance;
    } catch (error) {
        console.error('Failed to initialize CodeMirror 6:', error);
        // Fallback to textarea
        const textarea = document.createElement('textarea');
        textarea.id = 'cm-editor-fallback';
        textarea.style.width = '100%';
        textarea.style.height = '400px';
        textarea.style.fontFamily = 'monospace';
        textarea.style.fontSize = '14px';
        textarea.style.padding = '10px';
        textarea.style.border = '1px solid #ccc';
        textarea.style.borderRadius = '4px';
        containerElement.appendChild(textarea);
        
        const editorInstance = {
            getValue: () => textarea.value || '',
            setValue: (value) => { textarea.value = value; },
            onChange: null,
            destroy: () => {
                if (textarea.parentNode) {
                    textarea.parentNode.removeChild(textarea);
                }
            }
        };
        
        // Add change listener for fallback
        textarea.addEventListener('input', () => {
            if (editorInstance.onChange) {
                editorInstance.onChange(textarea.value);
            }
        });
        
        return editorInstance;
    }
}

// Make initCodeEditor available globally for Alpine.js component
window.initCodeEditor = initCodeEditor;
