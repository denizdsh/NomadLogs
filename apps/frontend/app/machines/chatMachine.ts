import { setup, assign } from "xstate";

export interface MessageSender {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string | Date;
  senderId: string;
  sender: MessageSender;
}

export interface ChatMachineContext {
  selectedChatId: string | null;
  messageInput: string;
  liveMessages: ChatMessage[];
  error: string | null;
}

export type ChatMachineEvent =
  | { type: "SELECT_CHAT"; chatId: string | null }
  | { type: "LOAD_MESSAGES"; messages: ChatMessage[] }
  | { type: "SET_MESSAGE_INPUT"; value: string }
  | { type: "RECEIVE_MESSAGE"; message: ChatMessage }
  | { type: "SEND_MESSAGE"; tempId: string; body: string; sender: MessageSender }
  | { type: "SEND_SUCCESS"; tempId: string; message: ChatMessage }
  | { type: "SEND_FAILURE"; tempId: string; error: string };

export const chatMachine = setup({
  types: {
    context: {} as ChatMachineContext,
    events: {} as ChatMachineEvent,
  },
}).createMachine({
  id: "chat",
  initial: "idle",
  context: {
    selectedChatId: null,
    messageInput: "",
    liveMessages: [],
    error: null,
  },
  states: {
    idle: {
      on: {
        SELECT_CHAT: {
          actions: assign(({ event }) => ({
            selectedChatId: event.chatId,
            liveMessages: [],
            messageInput: "",
            error: null,
          })),
        },
        LOAD_MESSAGES: {
          actions: assign({
            liveMessages: ({ event }) => event.messages,
          }),
        },
        SET_MESSAGE_INPUT: {
          actions: assign({
            messageInput: ({ event }) => event.value,
          }),
        },
        RECEIVE_MESSAGE: {
          actions: assign(({ context, event }) => {
            if (context.liveMessages.some((m) => m.id === event.message.id)) {
              return {};
            }
            return {
              liveMessages: [...context.liveMessages, event.message],
            };
          }),
        },
        SEND_MESSAGE: {
          target: "sending",
          actions: assign(({ context, event }) => {
            const optimisticMsg: ChatMessage = {
              id: event.tempId,
              body: event.body,
              createdAt: new Date(),
              senderId: event.sender.id,
              sender: event.sender,
            };
            return {
              liveMessages: [...context.liveMessages, optimisticMsg],
              messageInput: "",
            };
          }),
        },
      },
    },
    sending: {
      on: {
        RECEIVE_MESSAGE: {
          actions: assign(({ context, event }) => {
            if (context.liveMessages.some((m) => m.id === event.message.id)) {
              return {};
            }
            return {
              liveMessages: [...context.liveMessages, event.message],
            };
          }),
        },
        SEND_SUCCESS: {
          target: "idle",
          actions: assign(({ context, event }) => {
            const messagesWithoutTemp = context.liveMessages.filter((m) => m.id !== event.tempId);
            if (messagesWithoutTemp.some((m) => m.id === event.message.id)) {
              return {
                liveMessages: messagesWithoutTemp,
                error: null,
              };
            }
            return {
              liveMessages: [...messagesWithoutTemp, event.message],
              error: null,
            };
          }),
        },
        SEND_FAILURE: {
          target: "idle",
          actions: assign(({ context, event }) => {
            return {
              liveMessages: context.liveMessages.filter((m) => m.id !== event.tempId),
              error: event.error,
            };
          }),
        },
        SELECT_CHAT: {
          target: "idle",
          actions: assign(({ event }) => ({
            selectedChatId: event.chatId,
            liveMessages: [],
            messageInput: "",
            error: null,
          })),
        },
      },
    },
  },
});
