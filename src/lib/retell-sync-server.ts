import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SYNC_TIMEOUT_MS = 120_000;
const MAX_BUFFER_BYTES = 1024 * 1024;

type SyncScriptPayload = {
  agent_id: string;
  agent_name: string;
  agent_version: number | string;
  response_engine: unknown;
  conversation_flow_id: string;
  conversation_flow_version: number | string;
  node_count: number;
};

type ExecFileFailure = Error & {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
};

export type RetellSyncResult = {
  agentId: string;
  agentName: string;
  agentVersion: number | string;
  responseEngine: unknown;
  conversationFlowId: string;
  conversationFlowVersion: number | string;
  nodeCount: number;
  stdout: string;
  stderr: string;
};

function readOutput(value: string | Buffer | undefined) {
  if (!value) {
    return "";
  }

  return typeof value === "string" ? value.trim() : value.toString("utf8").trim();
}

function getRetellSyncScriptPath() {
  return path.join(process.cwd(), "scripts", "sync-retell-memory-agent.mjs");
}

function parseSyncPayload(stdout: string): RetellSyncResult {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("Retell sync finished without returning a result payload.");
  }

  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");
  const candidate =
    startIndex >= 0 && endIndex > startIndex ? trimmed.slice(startIndex, endIndex + 1) : trimmed;

  let payload: SyncScriptPayload;
  try {
    payload = JSON.parse(candidate) as SyncScriptPayload;
  } catch {
    throw new Error("Retell sync returned an unreadable result payload.");
  }

  return {
    agentId: payload.agent_id,
    agentName: payload.agent_name,
    agentVersion: payload.agent_version,
    responseEngine: payload.response_engine,
    conversationFlowId: payload.conversation_flow_id,
    conversationFlowVersion: payload.conversation_flow_version,
    nodeCount: payload.node_count,
    stdout: trimmed,
    stderr: "",
  };
}

export async function runRetellMemoryAgentSyncServer() {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [getRetellSyncScriptPath()], {
      cwd: process.cwd(),
      timeout: SYNC_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
    });

    const syncResult = parseSyncPayload(stdout);
    return {
      ...syncResult,
      stderr: stderr.trim(),
    };
  } catch (error) {
    const execError = error as ExecFileFailure;
    const stdout = readOutput(execError.stdout);
    const stderr = readOutput(execError.stderr);
    const failureDetail = stderr || stdout || execError.message || "Unknown Retell sync failure";
    throw new Error(`Retell sync failed: ${failureDetail}`);
  }
}
