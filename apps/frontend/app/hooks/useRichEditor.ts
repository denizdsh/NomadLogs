import { useRef, useCallback } from "react";

/**
 * A custom hook to manage references, initialization, destruction,
 * and saving of Editor.js instances.
 */
export function useRichEditor() {
  const editorRef = useRef<any>(null);

  const onInitialize = useCallback((editorInstance: any) => {
    editorRef.current = editorInstance;
  }, []);

  const onDestroy = useCallback(() => {
    editorRef.current = null;
  }, []);

  const save = useCallback(async () => {
    if (editorRef.current && typeof editorRef.current.save === "function") {
      try {
        return await editorRef.current.save();
      } catch (err) {
        console.error("Error saving editor content:", err);
        throw err;
      }
    }
    return { blocks: [] };
  }, []);

  return {
    editorRef,
    onInitialize,
    onDestroy,
    save,
  };
}
export type UseRichEditorReturn = ReturnType<typeof useRichEditor>;
