# VeriSom Audit Console

Full-stack app and MCP service for getting a Somnia Agents safety score for a contract before an AI agent interacts with it.

## What it does

1. Fetches verified contract source from the Somnia explorer when available.
2. Falls back to deployed bytecode and runs local opcode/selector/pattern analysis when the contract is unverified.
3. Fetches recent contract transactions from the explorer.
4. Builds a local RAG corpus from verified resources and retrieved chain evidence.
5. Uses local lexical retrieval to rank the most relevant evidence for contract-context assembly.
6. Sends the final context to `requestSafetyScore(...)` on the VeriSom contract.
7. Polls on-chain state and events until `SafetyScoreReceived(...)` is available.
8. Exposes a single MCP tool that returns the Somnia Agents score directly to another AI agent before it calls the target contract.

## Setup

1. Install dependencies:

```powershell
cmd /c npm install
```

2. Create `.env` from `.env.example` and fill in RPC and contract settings as needed.

3. Start the app:

```powershell
cmd /c npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Recommended Claude Setup

For Claude, the easiest setup is the local stdio MCP server, because the connector can hold the user's own private key once in its environment and the tool call does not need to resend it every time.

### Claude Desktop MCP config

Use a local MCP entry that launches this project through `tsx`:

```json
{
  "mcpServers": {
    "verisom": {
      "command": "C:\\Users\\YOUR_USER\\Downloads\\verisom-final\\node_modules\\.bin\\tsx.cmd",
      "args": [
        "C:\\Users\\YOUR_USER\\Downloads\\verisom-final\\mcp-stdio.ts"
      ],
      "env": {
        "AGENT_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY_HERE",
        "SOMNIA_RPC_URL": "https://api.infra.testnet.somnia.network",
        "SOMNIA_EXPLORER_BASE_URL": "https://shannon-explorer.somnia.network",
        "VERISOM_CONTRACT_ADDRESS": "0x45e89Bae0eD991b63F8988d13EcEC1Ae0eEdDA77",
        "CHAIN_NAME": "Somnia Testnet",
        "VERISOM_POLL_INTERVAL_MS": "5000"
      }
    }
  }
}
```

Restart Claude Desktop after updating the config.

In this mode:

- the key belongs to the agent connector, not to a shared remote service
- the tool can use the connector env automatically
- users do not need to pass `privateKey` in every tool call

## MCP Modes

### Local stdio MCP

- Command: `cmd /c npm run mcp:stdio`
- Best for Claude Desktop and similar local connectors
- Uses `AGENT_PRIVATE_KEY` from the connector env if `privateKey` is not passed explicitly

### HTTP MCP

- Endpoint: `http://localhost:3000/api/mcp`
- Health: `http://localhost:3000/api/mcp/health`
- In HTTP mode, the tool does not use env fallback for signing, because that env would belong to the server process rather than the calling agent

## MCP Tool

The server exposes a single agent-facing tool:

1. `score_contract_before_interaction`
   - Builds the contract context, submits the request to VeriSom, waits for the Somnia Agents callback, and returns the final score directly.
   - In local stdio mode, it can use `AGENT_PRIVATE_KEY` from the connector environment.
   - In HTTP mode, the caller must pass `privateKey` explicitly.
   - Returns the Somnia Agents score, recommendation, findings, provenance, and the exact context used.

## Notes

- The default RPC and explorer targets are Somnia testnet endpoints from Somnia docs.
- RAG retrieval is fully local and does not require any embedding API key.
- The UI lets you either build context only or run the full analyze-and-submit pipeline.
- The MCP endpoint is intended for agents that need a pre-interaction contract safety score before signing or sending transactions.
