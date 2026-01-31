import { create } from 'zustand'
import type { ChatMessage } from '@/types'

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean

  // Actions
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  sendMessage: (content: string) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialState = {
  messages: [] as ChatMessage[],
  isLoading: false,
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }))
  },

  sendMessage: (content) => {
    const { addMessage, setLoading } = get()

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMessage)
    setLoading(true)

    // TODO: Send via WebSocket or API
  },

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => set(initialState),
}))
