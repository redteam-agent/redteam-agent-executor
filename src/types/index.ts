/**
 * Type definitions for RedTeam Agent Web.
 *
 * These types match the event contracts from the API.
 */

// Pipeline stages
export type PipelineStage =
  | 'processing_documents'
  | 'crawling_vulnerabilities'
  | 'scanning'
  | 'exploiting'
  | 'remediating'
  | 'creating_pr'
  | 'sending_email'
  | 'completed'
  | 'failed';

// Command execution status
export type CommandStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout';

// Chain types
export type ChainType = 'exploit' | 'remediation';

// Base event structure
export interface AgentEvent {
  event_id: string;
  timestamp: string;
  event_type: string;
  session_id: string;
  run_id: string;
}

// Reasoning event - displayed in left panel
export interface ReasoningEvent extends AgentEvent {
  event_type: 'reasoning';
  step_number: number;
  chain_type: ChainType;
  reasoning_text: string;
}

// Command event - displayed in right panel
export interface CommandEvent extends AgentEvent {
  event_type: 'command';
  step_number: number;
  command: string;
  status: CommandStatus;
  executor_type: 'http' | 'shell' | 'cloudrun';
}

// Output event - displayed in right panel
export interface OutputEvent extends AgentEvent {
  event_type: 'output';
  step_number: number;
  output: string;
  stream: 'stdout' | 'stderr';
  is_truncated: boolean;
}

// Stage change event - updates progress indicator
export interface StageChangeEvent extends AgentEvent {
  event_type: 'stage_change';
  stage: PipelineStage;
  previous_stage: PipelineStage | null;
  message: string;
}

// Exploit result event
export interface ExploitResultEvent extends AgentEvent {
  event_type: 'exploit_result';
  success: boolean;
  vulnerability_id: string;
  vulnerability_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  summary: string;
  evidence: string | null;
}

// Remediation result event
export interface RemediationResultEvent extends AgentEvent {
  event_type: 'remediation_result';
  success: boolean;
  files_changed: string[];
  fix_summary: string;
  verification_passed: boolean;
  pr_url: string | null;
}

// Error event
export interface ErrorEvent extends AgentEvent {
  event_type: 'error';
  error_code: string;
  error_message: string;
  recoverable: boolean;
  step_number: number | null;
}

// Union type for all events
export type AnyAgentEvent =
  | ReasoningEvent
  | CommandEvent
  | OutputEvent
  | StageChangeEvent
  | ExploitResultEvent
  | RemediationResultEvent
  | ErrorEvent;

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  reasoning?: string; // Expandable reasoning section
}

// Terminal line
export interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'status';
  content: string;
  timestamp: Date;
  stepNumber?: number;
  status?: CommandStatus;
}

// Chain step
export interface ChainStep {
  stepNumber: number;
  chainType: ChainType;
  reasoning: string;
  command: string;
  status: CommandStatus;
  output?: string;
}

// Session
export interface Session {
  id: string;
  user_email: string;
  github_org: string;
  github_repo: string;
  gcp_project_id: string;
  gcp_region: string;
  gcp_service_name: string;
  status: 'active' | 'completed' | 'failed';
  created_at: string;
}

// Agent run
export interface AgentRun {
  id: string;
  session_id: string;
  status: PipelineStage;
  current_stage: PipelineStage;
  vulnerabilities_found: number;
  exploits_attempted: number;
  exploits_successful: number;
  fixes_applied: number;
  pr_url: string | null;
  started_at: string;
  completed_at: string | null;
}

// App details form
export interface AppDetails {
  appName: string;
  appDescription: string;
  appUrl: string;
  additionalContext?: string;
}

// Document
export interface Document {
  id: string;
  filename: string;
  type: 'architecture_diagram' | 'tech_spec' | 'other';
  size_bytes: number;
  uploaded_at: string;
}

// WebSocket connection state
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
