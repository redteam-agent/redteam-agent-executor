// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

// Pipeline stages
export type PipelineStage =
  | 'processing_documents'
  | 'crawling_vulnerabilities'
  | 'scanning'
  | 'exploiting'
  | 'remediating'
  | 'creating_pr'
  | 'completed'

// Session
export interface Session {
  id: string
  user_email: string
  github_org: string
  github_repo: string
  gcp_project_id: string
  gcp_region: string
  gcp_service_name: string
  status: 'active' | 'completed' | 'failed'
  created_at: string
}

// Agent Run
export interface AgentRun {
  id: string
  session_id: string
  status: string
  current_stage: PipelineStage | null
  vulnerabilities_found: number
  exploits_successful: number
  fixes_applied: number
  pr_url: string | null
  started_at: string | null
  completed_at: string | null
}

// Chain step for exploit/remediation chain
export interface ChainStep {
  id: string
  step_number: number
  reasoning: string
  command?: string
  output?: string
  status: 'pending' | 'running' | 'success' | 'failed'
  timestamp: string
}

// Terminal line
export interface TerminalLine {
  id: string
  type: 'command' | 'output' | 'error' | 'status'
  content: string
  timestamp: string
}

// Chat message
export interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  reasoning?: string
  timestamp: string
}

// Agent events from WebSocket
export type AgentEventType =
  | 'reasoning'
  | 'command'
  | 'output'
  | 'stage_change'
  | 'exploit_result'
  | 'remediation_result'
  | 'error'
  | 'ping'

export interface BaseAgentEvent {
  event_type: AgentEventType
  run_id: string
  timestamp: string
}

export interface ReasoningEvent extends BaseAgentEvent {
  event_type: 'reasoning'
  step_number: number
  reasoning: string
}

export interface CommandEvent extends BaseAgentEvent {
  event_type: 'command'
  step_number: number
  command: string
}

export interface OutputEvent extends BaseAgentEvent {
  event_type: 'output'
  step_number: number
  stream: 'stdout' | 'stderr'
  chunk: string
}

export interface StageChangeEvent extends BaseAgentEvent {
  event_type: 'stage_change'
  stage: PipelineStage
  message?: string
}

export interface ExploitResultEvent extends BaseAgentEvent {
  event_type: 'exploit_result'
  vulnerability_type: string
  success: boolean
  details: string
}

export interface RemediationResultEvent extends BaseAgentEvent {
  event_type: 'remediation_result'
  fix_type: string
  success: boolean
  details: string
}

export interface ErrorEvent extends BaseAgentEvent {
  event_type: 'error'
  error_code: string
  message: string
}

export interface PingEvent extends BaseAgentEvent {
  event_type: 'ping'
}

export type AnyAgentEvent =
  | ReasoningEvent
  | CommandEvent
  | OutputEvent
  | StageChangeEvent
  | ExploitResultEvent
  | RemediationResultEvent
  | ErrorEvent
  | PingEvent

// API types
export interface SessionCreate {
  github_org: string
  github_repo: string
  gcp_project_id: string
  gcp_region: string
  gcp_service_name: string
}

export interface RunCreate {
  target_url: string
  documents?: string[]
}
