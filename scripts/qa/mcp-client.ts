// Minimal MCP Streamable HTTP client.
// Uses native Node.js fetch (Node 22+) and SSE stream parsing.
// No external dependencies required.

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface ToolContent {
  type: string;
  text?: string;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

async function parseSse(response: Response): Promise<JsonRpcResponse | null> {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are delimited by blank lines
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          const parsed = JSON.parse(json) as JsonRpcResponse;
          if (parsed.id !== undefined) {
            return parsed;
          }
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return null;
}

export class McpClient {
  private readonly url: string;
  private sessionId: string | null = null;
  private nextId = 1;

  constructor(port: number, path = "/mcp") {
    this.url = `http://127.0.0.1:${port}${path}`;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    return headers;
  }

  private async post(body: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    const sid = res.headers.get("Mcp-Session-Id");
    if (sid) this.sessionId = sid;

    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => String(res.status));
      throw new Error(`MCP HTTP ${res.status}: ${text}`);
    }

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/event-stream")) return parseSse(res);
    if (ct.includes("application/json")) return (await res.json()) as JsonRpcResponse;
    return null; // 202 Accepted for notifications
  }

  async initialize(): Promise<void> {
    const response = await this.post({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ofm-qa-runner", version: "0.1.0" },
      },
    });
    if (response?.error) throw new Error(`MCP initialize failed: ${response.error.message}`);
    // Fire-and-forget initialized notification
    await this.post({ jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => {});
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const response = await this.post({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    });
    if (!response) throw new Error(`No response from tool ${name}`);
    if (response.error) throw new Error(`Tool ${name} RPC error: ${response.error.message}`);
    return response.result as ToolResult;
  }

  async callToolText(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const result = await this.callTool(name, args);
    const text = (result.content ?? []).map((c) => c.text ?? "").join("");
    if (result.isError) throw new Error(`Tool ${name} returned error: ${text}`);
    return text;
  }
}
