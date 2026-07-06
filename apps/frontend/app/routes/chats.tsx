import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useMachine } from "@xstate/react";
import { chatMachine } from "~/machines/chatMachine";
import { Send, MessageSquare } from "lucide-react";
import { SearchBar } from "~/components/ui/SearchBar";
import { Avatar } from "~/components/ui/Avatar";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { trpc, type RouterOutputs } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";
import { useToast } from "~/providers/ToastProvider";
import { API_URL } from "~/config";
import { STORAGE_KEYS } from "~/constants/storage";
import { MACHINE_STATES } from "~/constants/machine";

type ChatItem = RouterOutputs["chat"]["list"]["chats"][number];
type MessageItem = RouterOutputs["chat"]["getById"]["messages"][number];

export function meta() {
  return [
    { title: "Pending Content Chats — NomadLogs" },
    {
      name: "description",
      content: "Manage pending content chats with editors.",
    },
  ];
}

export default function Chats() {
  const { user } = useAuth();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [searchParams] = useSearchParams();
  const initialChatId = searchParams.get("chatId");

  const [state, send] = useMachine(chatMachine);
  const { selectedChatId, messageInput, liveMessages } = state.context;

  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialChatId) {
      send({ type: "SELECT_CHAT", chatId: initialChatId });
    }
  }, [initialChatId, send]);

  // List chats
  const { data: listData } = trpc.chat.list.useQuery(
    { search: searchQuery },
    { enabled: !!user },
  );
  const chatsList = listData?.chats ?? [];

  // Active chat details
  const { data: chatDetails } = trpc.chat.getById.useQuery(
    { chatId: selectedChatId! },
    { enabled: !!selectedChatId },
  );

  // Sync historical messages when active chat loads
  useEffect(() => {
    if (chatDetails?.messages) {
      send({
        type: "LOAD_MESSAGES",
        messages: chatDetails.messages,
      });
    } else {
      send({ type: "LOAD_MESSAGES", messages: [] });
    }
  }, [chatDetails, send]);

  // Connect to SSE stream for real-time messages
  useEffect(() => {
    if (!selectedChatId) return;

    const token = !!window
      ? (localStorage.getItem(STORAGE_KEYS.TOKEN) ?? "")
      : "";
    const eventSource = new EventSource(
      `${API_URL}/sse/chat/${selectedChatId}?token=${encodeURIComponent(token)}`,
    );

    eventSource.addEventListener("message", (event) => {
      try {
        const newMsg = JSON.parse(event.data) as MessageItem;
        send({
          type: "RECEIVE_MESSAGE",
          message: newMsg,
        });
      } catch (err) {
        console.error("Failed to parse SSE event data:", err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [selectedChatId, send]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages]);

  // Mutations
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatId || !messageInput.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const text = messageInput;
    const sender = {
      id: user!.id,
      name: user!.name,
      avatarUrl: user!.avatarUrl,
    };

    send({ type: "SEND_MESSAGE", tempId, body: text, sender });
    try {
      const newMsg = await sendMessageMutation.mutateAsync({
        chatId: selectedChatId,
        body: text,
      });

      send({
        type: "SEND_SUCCESS",
        tempId,
        message: {
          id: newMsg.id,
          body: newMsg.body,
          createdAt: newMsg.createdAt,
          senderId: newMsg.senderId,
          sender,
        },
      });

      utils.chat.list.invalidate();
    } catch (err) {
      send({ type: "SEND_FAILURE", tempId, error: "Failed to send message." });
      toast("Failed to send message.", "error");
    }
  };

  const getChatPartnerName = (chat: ChatItem) => {
    return user?.id === chat.authorId ? chat.editor.name : chat.author.name;
  };

  const getChatContentTitle = (chat: ChatItem) => {
    return (
      chat.blog?.title ||
      chat.journal?.title ||
      chat.travelPlan?.title ||
      "Untitled Content"
    );
  };

  const selectedChat = chatsList.find((c) => c.id === selectedChatId);

  return (
    <article className="h-[calc(100vh-64px)] flex animate-fade-in">
      {/* Chat list side pane */}
      <aside
        className={`border-r border-border-custom bg-surface flex flex-col transition-all duration-300 ${
          selectedChatId ? "w-[30%] min-w-72 hidden md:flex" : "w-full"
        }`}
      >
        <header className="p-4 border-b border-border-custom space-y-3">
          <section className="flex items-center justify-between">
            <h1 className="text-headline-md text-on-surface">Pending Chats</h1>
            <Badge label={`${chatsList.length} chats`} variant="info" />
          </section>
          <SearchBar
            placeholder="Search chats..."
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={() => {}}
            size="sm"
          />
        </header>

        {chatsList.length > 0 ? (
          <ul className="flex-1 overflow-y-auto divide-y divide-border-custom">
            {chatsList.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => send({ type: "SELECT_CHAT", chatId: chat.id })}
                  className={`w-full text-left p-4 transition-colors hover:bg-border-custom/30 ${
                    selectedChatId === chat.id
                      ? "bg-primary/5 border-l-3 border-l-primary"
                      : ""
                  }`}
                >
                  <header className="flex items-center justify-between mb-1">
                    <span className="text-label-lg text-on-surface">
                      {getChatPartnerName(chat)}
                    </span>
                  </header>
                  <p className="text-label-md text-on-surface-muted truncate">
                    {getChatContentTitle(chat)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-on-surface-muted text-sm italic">
            No chats found.
          </div>
        )}
      </aside>

      {/* Chat conversation panel */}
      {selectedChatId && selectedChat ? (
        <section className="flex-1 flex flex-col">
          {/* Active Header */}
          <header className="px-6 py-4 border-b border-border-custom flex items-center justify-between gap-3 bg-surface">
            <section className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden mr-1"
                onClick={() => send({ type: "SELECT_CHAT", chatId: null })}
              >
                ← Back
              </Button>
              <Avatar
                src={null}
                alt={getChatPartnerName(selectedChat)}
                size="md"
              />
              <section>
                <h2 className="text-label-lg text-on-surface">
                  {getChatPartnerName(selectedChat)}
                </h2>
                <p className="text-label-md text-on-surface-muted">
                  {getChatContentTitle(selectedChat)}
                </p>
              </section>
            </section>
          </header>

          {/* Messages area */}
          <section className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral/30">
            {liveMessages.map((msg) => {
              const isOwn = msg.senderId === user?.id;
              return (
                <article
                  key={msg.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <section
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      isOwn
                        ? "bg-primary text-neutral rounded-br-sm"
                        : "bg-surface border border-border-custom text-on-surface rounded-bl-sm"
                    }`}
                  >
                    <p className="text-body-sm whitespace-pre-wrap">
                      {msg.body}
                    </p>
                    <time
                      className={`text-label-sm mt-1 block ${isOwn ? "text-neutral/70" : "text-on-surface-muted"}`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </time>
                  </section>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </section>

          {/* Send Input */}
          <footer className="border-t border-border-custom p-4 bg-surface">
            <form className="flex items-end gap-3" onSubmit={handleSendMessage}>
              <textarea
                value={messageInput}
                onChange={(e) =>
                  send({ type: "SET_MESSAGE_INPUT", value: e.target.value })
                }
                placeholder="Type a message..."
                rows={2}
                className="flex-1 rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-sm resize-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!messageInput.trim() || state.matches(MACHINE_STATES.SENDING)}
              >
                <Send size={14} />
              </Button>
            </form>
          </footer>
        </section>
      ) : (
        <section className="flex-1 hidden md:flex items-center justify-center bg-neutral/10">
          <EmptyState
            icon={<MessageSquare size={64} strokeWidth={1} />}
            title="Select a conversation"
            description="Choose a pending content chat from the list to view and respond."
          />
        </section>
      )}
    </article>
  );
}
