import { create } from 'zustand'
import type {
  ConnectionStatus,
  Session,
  AgentRun,
  PipelineStage,
  ChainStep,
  TerminalLine,
  AnyAgentEvent,
} from '@/types'

interface AgentState {
  // Connection
  connectionStatus: ConnectionStatus

  // Session data
  session: Session | null
  run: AgentRun | null

  // Pipeline state
  currentStage: PipelineStage | null
  stageMessage: string | null

  // Chain steps
  exploitChain: ChainStep[]
  remediationChain: ChainStep[]

  // Terminal output
  terminalLines: TerminalLine[]

  // Results
  prUrl: string | null

  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void
  setSession: (session: Session | null) => void
  setRun: (run: AgentRun | null) => void
  handleEvent: (event: AnyAgentEvent) => void
  addTerminalLine: (line: TerminalLine) => void
  reset: () => void
}

const initialState = {
  connectionStatus: 'disconnected' as ConnectionStatus,
  session: null,
  run: null,
  currentStage: null,
  stageMessage: null,
  exploitChain: [],
  remediationChain: [],
  terminalLines: [],
  prUrl: null,
}

export const useAgentStore = create<AgentState>((set, get) => ({
  ...initialState,

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setSession: (session) => {
    set({ session })
    if (session) {
      localStorage.setItem('session', JSON.stringify(session))
    } else {
      localStorage.removeItem('session')
    }
  },

  setRun: (run) => set({ run }),

  handleEvent: (event) => {
    const { addTerminalLine } = get()

    switch (event.event_type) {
      case 'reasoning': {
        const step: ChainStep = {
          id: `step-${event.step_number}-${Date.now()}`,
          step_number: event.step_number,
          reasoning: event.reasoning,
          status: 'running',
          timestamp: event.timestamp,
        }
        set((state) => ({
          exploitChain: [...state.exploitChain, step],
        }))
        break
      }

      case 'command': {
        const terminalLine: TerminalLine = {
          id: `cmd-${Date.now()}`,
          type: 'command',
          content: event.command,
          timestamp: event.timestamp,
        }
        addTerminalLine(terminalLine)

        // Update chain step with command
        set((state) => ({
          exploitChain: state.exploitChain.map((step) =>
            step.step_number === event.step_number
              ? { ...step, command: event.command }
              : step
          ),
        }))
        break
      }

      case 'output': {
        const terminalLine: TerminalLine = {
          id: `out-${Date.now()}`,
          type: event.stream === 'stderr' ? 'error' : 'output',
          content: event.chunk,
          timestamp: event.timestamp,
        }
        addTerminalLine(terminalLine)
        break
      }

      case 'stage_change': {
        set({
          currentStage: event.stage,
          stageMessage: event.message ?? null,
        })

        const terminalLine: TerminalLine = {
          id: `stage-${Date.now()}`,
          type: 'status',
          content: `[Stage] ${event.stage}${event.message ? `: ${event.message}` : ''}`,
          timestamp: event.timestamp,
        }
        addTerminalLine(terminalLine)
        break
      }

      case 'exploit_result': {
        const terminalLine: TerminalLine = {
          id: `exploit-${Date.now()}`,
          type: 'status',
          content: event.success
            ? `[SUCCESS] Exploit: ${event.vulnerability_type} - ${event.details}`
            : `[FAILED] Exploit: ${event.vulnerability_type} - ${event.details}`,
          timestamp: event.timestamp,
        }
        addTerminalLine(terminalLine)
        break
      }

      case 'remediation_result': {
        const terminalLine: TerminalLine = {
          id: `remediation-${Date.now()}`,
          type: 'status',
          content: event.success
            ? `[SUCCESS] Fix: ${event.fix_type} - ${event.details}`
            : `[FAILED] Fix: ${event.fix_type} - ${event.details}`,
          timestamp: event.timestamp,
        }
        addTerminalLine(terminalLine)
        break
      }

      case 'error': {
        const terminalLine: TerminalLine = {
          id: `error-${Date.now()}`,
          type: 'error',
          content: `[ERROR] ${event.error_code}: ${event.message}`,
          timestamp: event.timestamp,
        }
        addTerminalLine(terminalLine)
        break
      }

      case 'ping':
        // Handle ping silently
        break
    }
  },

  addTerminalLine: (line) => {
    set((state) => ({
      terminalLines: [...state.terminalLines, line],
    }))
  },

  reset: () => set(initialState),
}))

// Load session from localStorage on startup
const savedSession = localStorage.getItem('session')
if (savedSession) {
  try {
    const session = JSON.parse(savedSession)
    useAgentStore.getState().setSession(session)
  } catch {
    localStorage.removeItem('session')
  }
}
