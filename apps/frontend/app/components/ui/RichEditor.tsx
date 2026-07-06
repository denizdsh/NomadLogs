import { useEffect, useRef, useState } from "react";
import { uploadImage } from "~/utils/upload";

interface RichEditorProps {
  id: string;
  placeholder?: string;
  data?: any;
  onInitialize?: (editorInstance: any) => void;
  onDestroy?: () => void;
  className?: string;
}

export function RichEditor({
  id,
  placeholder = "Start writing...",
  data,
  onInitialize,
  onDestroy,
  className = "",
}: RichEditorProps) {
  const editorRef = useRef<any>(null);
  const isInitialized = useRef<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let editorInstance: any = null;

    async function initEditor() {
      try {
        // Dynamically load EditorJS and all tools to avoid SSR issues
        const [
          { default: EditorJS },
          { default: Header },
          { default: List },
          { default: ImageTool },
          { default: Underline },
        ] = await Promise.all([
          import("@editorjs/editorjs"),
          import("@editorjs/header"),
          import("@editorjs/list"),
          import("@editorjs/image"),
          import("@editorjs/underline"),
        ]);

        if (!isMounted) return;

        // Prevent duplicate initialization on the same holder
        if (isInitialized.current) return;

        editorInstance = new EditorJS({
          holder: id,
          placeholder,
          data: data || { blocks: [] },
          tools: {
            header: {
              class: Header,
              inlineToolbar: true,
              config: {
                placeholder: "Header text...",
                levels: [2, 3, 4],
                defaultLevel: 2,
              },
            },
            list: {
              class: List,
              inlineToolbar: true,
              config: {
                defaultStyle: "unordered",
              },
            },
            image: {
              class: ImageTool,
              config: {
                uploader: {
                  async uploadByFile(file: File) {
                    try {
                      const url = await uploadImage(file);
                      return {
                        success: 1,
                        file: { url },
                      };
                    } catch (err: any) {
                      console.error("EditorJS image upload failed:", err);
                      return {
                        success: 0,
                        message: err.message || "Failed to upload image.",
                      };
                    }
                  },
                  uploadByUrl(url: string) {
                    return Promise.resolve({
                      success: 1,
                      file: { url },
                    });
                  },
                },
              },
            },
            underline: Underline,
          },
        });

        editorRef.current = editorInstance;
        isInitialized.current = true;

        if (onInitialize) {
          onInitialize(editorInstance);
        }
      } catch (err: any) {
        console.error("Failed to initialize EditorJS:", err);
        if (isMounted) {
          setError("Failed to load the editor. Please refresh the page.");
        }
      }
    }

    initEditor();

    return () => {
      isMounted = false;
      if (editorInstance && typeof editorInstance.destroy === "function") {
        try {
          editorInstance.destroy();
        } catch (e) {
          console.error("Error destroying EditorJS instance:", e);
        }
        editorRef.current = null;
        isInitialized.current = false;
        if (onDestroy) {
          onDestroy();
        }
      }
    };
  }, [id, placeholder, onInitialize, onDestroy]);

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-error bg-error/5 text-error text-body-sm text-center">
        {error}
      </div>
    );
  }

  return (
    <div
      id={id}
      className={`prose prose-lg dark:prose-invert max-w-none text-on-surface [&_.codex-editor]:w-full [&_.ce-paragraph]:text-body-md [&_.ce-paragraph]:text-on-surface/90 [&_.ce-header]:text-on-surface [&_.ce-header]:font-serif [&_.ce-header]:font-semibold [&_.cdx-list]:list-disc [&_.cdx-list--ordered]:list-decimal [&_.cdx-list]:pl-6 [&_.cdx-list-item]:py-0.5 ${className}`}
    />
  );
}
