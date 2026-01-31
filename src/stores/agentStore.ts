/**
 * Main agent state store using Zustand.
 *
 * This store manages the global state for the agent session including:
 * - Current session and run information
 * - Pipeline stage progress
 * - Exploit and remediation chain steps
 * - Terminal output
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AgentRun,
  AnyAgentEvent,
  ChainStep,
  ConnectionStatus,
  PipelineStage,
  Session,
  TerminalLine,
} from '../types';

interface AgentState {
  // Connection state
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Session and run
  session: Session | null;
  run: AgentRun | null;
  setSession: (session: Session | null) => void;
  setRun: (run: AgentRun | null) => void;

  // Pipeline stage
  currentStage: PipelineStage | null;
  stageMessage: string;
  setStage: (stage: PipelineStage, message: string) => void;

  // Exploit chain
  exploitChain: ChainStep[];
  addExploitStep: (step: ChainStep) => void;
  updateExploitStep: (stepNumber: number, updates: Partial<ChainStep>) => void;
  clearExploitChain: () => void;

  // Remediation chain
  remediationChain: ChainStep[];
  addRemediationStep: (step: ChainStep) => void;
  updateRemediationStep: (stepNumber: number, updates: Partial<ChainStep>) => void;
  clearRemediationChain: () => void;

  // Terminal output
  terminalLines: TerminalLine[];
  addTerminalLine: (line: Omit<TerminalLine, 'id' | 'timestamp'>) => void;
  updateTerminalLine: (id: string, updates: Partial<TerminalLine>) => void;
  clearTerminal: () => void;

  // Results
  exploitsSuccessful: number;
  fixesApplied: number;
  prUrl: string | null;
  setPrUrl: (url: string) => void;

  // Event handling
  handleEvent: (event: AnyAgentEvent) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  connectionStatus: 'disconnected' as ConnectionStatus,
  session: null,
  run: null,
  currentStage: null,
  stageMessage: '',
  exploitChain: [],
  remediationChain: [],
  terminalLines: [],
  exploitsSuccessful: 0,
  fixesApplied: 0,
  prUrl: null,
};

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setConnectionStatus: (status) => set({ connectionStatus: status }),

      setSession: (session) => set({ session }),

      setRun: (run) => set({ run }),

      setStage: (stage, message) =>
        set({ currentStage: stage, stageMessage: message }),

      addExploitStep: (step) =>
        set((state) => ({
          exploitChain: [...state.exploitChain, step],
        })),

      updateExploitStep: (stepNumber, updates) =>
        set((state) => ({
          exploitChain: state.exploitChain.map((step) =>
            step.stepNumber === stepNumber ? { ...step, ...updates } : step
          ),
        })),

      clearExploitChain: () => set({ exploitChain: [] }),

      addRemediationStep: (step) =>
        set((state) => ({
          remediationChain: [...state.remediationChain, step],
        })),

      updateRemediationStep: (stepNumber, updates) =>
        set((state) => ({
          remediationChain: state.remediationChain.map((step) =>
            step.stepNumber === stepNumber ? { ...step, ...updates } : step
          ),
        })),

      clearRemediationChain: () => set({ remediationChain: [] }),

      addTerminalLine: (line) =>
        set((state) => ({
          terminalLines: [
            ...state.terminalLines,
            {
              ...line,
              id: crypto.randomUUID(),
              timestamp: new Date(),
            },
          ],
        })),

      updateTerminalLine: (id, updates) =>
        set((state) => ({
          terminalLines: state.terminalLines.map((line) =>
            line.id === id ? { ...line, ...updates } : line
          ),
        })),

      clearTerminal: () => set({ terminalLines: [] }),

      setPrUrl: (url) => set({ prUrl: url }),

      handleEvent: (event) => {
        const state = get();

        switch (event.event_type) {
          case 'stage_change':
            state.setStage(event.stage, event.message);
            break;

          case 'reasoning':
            // Add or update chain step with reasoning
            if (event.chain_type === 'exploit') {
              const existingStep = state.exploitChain.find(
                (s) => s.stepNumber === event.step_number
              );
              if (existingStep) {
                state.updateExploitStep(event.step_number, {
                  reasoning: event.reasoning_text,
                });
              } else {
                state.addExploitStep({
                  stepNumber: event.step_number,
                  chainType: 'exploit',
                  reasoning: event.reasoning_text,
                  command: '',
                  status: 'pending',
                });
              }
            } else {
              const existingStep = state.remediationChain.find(
                (s) => s.stepNumber === event.step_number
              );
              if (existingStep) {
                state.updateRemediationStep(event.step_number, {
                  reasoning: event.reasoning_text,
                });
              } else {
                state.addRemediationStep({
                  stepNumber: event.step_number,
                  chainType: 'remediation',
                  reasoning: event.reasoning_text,
                  command: '',
                  status: 'pending',
                });
              }
            }
            break;

          case 'command': {
            // Update chain step with command
            state.addTerminalLine({
              type: 'command',
              content: event.command,
              stepNumber: event.step_number,
              status: event.status,
            });

            // Update the chain step
            const updateFn =
              state.exploitChain.length > 0
                ? state.updateExploitStep
                : state.updateRemediationStep;
            updateFn(event.step_number, {
              command: event.command,
              status: event.status,
            });
            break;
          }

          case 'output':
            state.addTerminalLine({
              type: event.stream === 'stderr' ? 'error' : 'output',
              content: event.output,
              stepNumber: event.step_number,
            });
            break;

          case 'exploit_result':
            if (event.success) {
              set((s) => ({ exploitsSuccessful: s.exploitsSuccessful + 1 }));
            }
            state.addTerminalLine({
              type: 'status',
              content: event.success
                ? `[SUCCESS] ${event.summary}`
                : `[FAILED] ${event.summary}`,
            });
            break;

          case 'remediation_result':
            if (event.success) {
              set((s) => ({
                fixesApplied: s.fixesApplied + event.files_changed.length,
              }));
            }
            if (event.pr_url) {
              state.setPrUrl(event.pr_url);
            }
            state.addTerminalLine({
              type: 'status',
              content: event.success
                ? `[SUCCESS] ${event.fix_summary}`
                : `[FAILED] Remediation failed`,
            });
            break;

          case 'error':
            state.addTerminalLine({
              type: 'error',
              content: `[ERROR] ${event.error_message}`,
              stepNumber: event.step_number ?? undefined,
            });
            break;
        }
      },

      reset: () => set(initialState),
    }),
    {
      name: 'redteam-agent-store',
      partialize: (state) => ({
        session: state.session,
      }),
    }
  )
);
