# VeriSom

On-chain contract safety infrastructure for autonomous agents.

VeriSom gives an AI agent a contract safety score before it approves, swaps, transfers, or calls a smart contract. It gathers verified source code when available, falls back to bytecode analysis when it is not, adds recent on-chain activity, builds a local RAG evidence set, submits the assembled context to the VeriSom contract on Somnia, and returns a direct machine-usable verdict.

Live landing page: [verisom.vercel.app](https://verisom.vercel.app/)

Repository: [github.com/anoop04singh/verisom](https://github.com/anoop04singh/verisom)

## What VeriSom is

VeriSom is two things in one repository:

1. A marketing landing page for the VeriSom MCP server.
2. An agent-facing contract scoring service that exposes:
   - a local `stdio` MCP server for tools like Claude Desktop
   - an HTTP MCP endpoint
   - plain HTTP analysis and request/status routes

The core job of the system is not to generate a long human audit report. It is to help an AI agent answer one operational question before interacting with a contract:

`Should I interact with this contract right now?`

The answer comes back as:

- a Somnia score
- a score band
- an `allow`, `review`, or `avoid` recommendation
- structured findings
- the RAG context used
- the functions and transaction evidence used
- the exact contract context that was submitted for scoring

## Core value proposition

- One tool call for the agent.
- One direct score result.
- One evidence trail explaining why the score exists.
- No Gemini embeddings or external embedding dependency.
- Verified source when possible, bytecode fallback when not.
- Private key can stay inside the local agent connector environment in `stdio` mode.

## Product surface

### Landing page

The root page is a marketing site for the MCP server and setup flow.

### MCP server

The server exposes a single tool:

- `score_contract_before_interaction`

This tool:

1. analyzes the target contract
2. builds the contract context
3. submits the request to the VeriSom contract
4. waits for the Somnia Agents callback
5. returns the final structured result directly

There is no request-id choreography required for the MCP caller.

### HTTP routes

The repository also exposes direct HTTP routes:

- `POST /api/analyze`
- `POST /api/request`
- `GET /api/request/[requestId]`
- `GET|POST|DELETE /api/mcp`
- `GET /api/mcp/health`

## High-level architecture

```text
                           +----------------------+
                           |   Claude / Agent     |
                           |  or any MCP client   |
                           +----------+-----------+
                                      |
                         stdio MCP or HTTP MCP call
                                      |
                                      v
                         +------------+-------------+
                         |       VeriSom Server     |
                         |  Next.js + MCP runtime   |
                         +------------+-------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
         +-----------+-----------+         +-----------+-----------+
         | Contract acquisition  |         |  On-chain submission  |
         | + local RAG assembly  |         |   to VeriSom/Somnia   |
         +-----------+-----------+         +-----------+-----------+
                     |                                 |
                     v                                 v
      +--------------+----------------+      +---------+----------+
      | Verified source or bytecode   |      | requestSafetyScore |
      | Explorer metadata             |      | poll auditJobs     |
      | Recent transactions           |      | wait for event     |
      | Lexical retrieval             |      +---------+----------+
      +--------------+----------------+                |
                     |                                 |
                     +---------------+-----------------+
                                     |
                                     v
                         +-----------+------------+
                         | Final structured score |
                         | allow/review/avoid     |
                         | provenance + evidence  |
                         +------------------------+
```

## End-to-end flow

```text
Agent
  |
  | score_contract_before_interaction(targetAddress, intendedInteraction, auditFocus)
  v
VeriSom MCP Server
  |
  |-- fetch explorer address metadata
  |-- fetch smart contract profile
  |-- fetch recent transactions
  |
  |-- if verified source exists:
  |      use source + ABI + metadata
  |
  |-- else:
  |      fetch deployed bytecode from RPC
  |      extract selectors, patterns, flags, strings
  |
  |-- build local knowledge documents
  |-- rank documents with lexical retrieval
  |-- build contract context string
  |-- compute local heuristic findings
  |
  |-- call VeriSom contract: requestSafetyScore(...)
  |-- wait until auditJobs(requestId).completed == true
  |-- read parsedScore and callback event
  |
  |-- combine local heuristic recommendation
  |   with Somnia score
  v
Return final result to agent
```

## Verified-source path vs bytecode-fallback path

```text
                    +---------------------------+
                    | Fetch explorer contract   |
                    | metadata and source       |
                    +-------------+-------------+
                                  |
                    +-------------+-------------+
                    | Is verified source found? |
                    +------+--------------------+
                           | yes
                           v
         +-----------------+------------------+
         | Chunk source code and add ABI      |
         | Build verified-source documents    |
         +-----------------+------------------+
                           |
                           | no
                           v
         +-----------------+------------------+
         | Fetch deployed bytecode from RPC   |
         | Disassemble and inspect opcodes    |
         | Extract selectors and flags        |
         +-----------------+------------------+
                           |
                           v
             +-------------+--------------+
             | Build common RAG evidence  |
             | and contract context       |
             +----------------------------+
```

## Implementation overview

### Stack

- Next.js 15
- React 19
- TypeScript
- `ethers` for chain interaction
- `@modelcontextprotocol/sdk` for MCP transports
- `zod` for MCP tool schemas

### Important files

- [mcp-stdio.ts](mcp-stdio.ts): local `stdio` MCP entrypoint
- [lib/mcp-server.ts](lib/mcp-server.ts): MCP tool registration and final orchestration
- [lib/audit-pipeline.ts](lib/audit-pipeline.ts): analysis pipeline entry
- [lib/rag.ts](lib/rag.ts): local lexical RAG document creation and ranking
- [lib/bytecode-analyzer.ts](lib/bytecode-analyzer.ts): selector/pattern/flag extraction
- [lib/context-builder.ts](lib/context-builder.ts): final context string assembly
- [lib/interaction-assessment.ts](lib/interaction-assessment.ts): local heuristic recommendation layer
- [lib/verisom.ts](lib/verisom.ts): contract submission and polling
- [lib/explorer.ts](lib/explorer.ts): explorer metadata and transaction fetchers
- [lib/rpc.ts](lib/rpc.ts): raw RPC access
- [app/api/mcp/route.ts](app/api/mcp/route.ts): HTTP MCP transport
- [app/api/analyze/route.ts](app/api/analyze/route.ts): analysis-only HTTP route
- [app/api/request/route.ts](app/api/request/route.ts): submission route
- `app/api/request/[requestId]/route.ts`: request status route
- [components/landing-page.tsx](components/landing-page.tsx): landing page content/UI

## Detailed architecture

### 1. Contract acquisition layer

Implemented primarily in [lib/explorer.ts](lib/explorer.ts) and [lib/rpc.ts](lib/rpc.ts).

The acquisition layer pulls:

- explorer address metadata
- explorer contract metadata
- verified source code if available
- ABI if available
- recent transactions
- deployed bytecode from RPC when verification is missing

Explorer data comes from:

- `SOMNIA_EXPLORER_BASE_URL/api/v2/addresses/:address`
- `SOMNIA_EXPLORER_BASE_URL/api/v2/addresses/:address/counters`
- `SOMNIA_EXPLORER_BASE_URL/api/v2/smart-contracts/:address`
- `SOMNIA_EXPLORER_BASE_URL/api/v2/addresses/:address/transactions`

RPC data is used to get deployed bytecode directly from chain state.

### 2. Bytecode analysis layer

Implemented in [lib/bytecode-analyzer.ts](lib/bytecode-analyzer.ts).

When source is unavailable, VeriSom disassembles bytecode and extracts:

- opcode-level signals
- selectors inferred from `PUSH4 ... EQ` dispatch patterns
- known selector signatures
- pattern fingerprints such as:
  - `ERC20`
  - `Ownable`
  - `Upgradeable`
- high-signal flags such as:
  - `delegatecall`
  - `create`
  - `create2`
  - `staticcall`
  - `selfdestruct`
  - `payable-surface`
- printable embedded strings

This is not a full decompiler. It is a practical bytecode evidence layer for pre-transaction decision support.

### 3. Local RAG layer

Implemented in [lib/rag.ts](lib/rag.ts).

VeriSom now uses fully local lexical retrieval. There is no Gemini embedding dependency.

#### What goes into the knowledge base

The RAG corpus is assembled from:

- contract overview metadata
- verified source chunks
- additional verified source files
- verified ABI
- bytecode analysis output
- summarized recent transactions
- individual recent transaction records

#### How retrieval works

1. Build a synthetic audit query from:
   - target address
   - chain name
   - default security concerns
   - user-supplied `auditFocus`
2. Tokenize documents and query lexically.
3. Score token overlap with category weighting.
4. Rank all documents.
5. Take the top retrieved items.
6. Feed them into the final contract context.

Current retrieval mode:

- `local-lexical-rag`

This keeps the system:

- offline-friendly
- deterministic
- inexpensive
- simple to run inside local agent environments

### 4. Context assembly layer

Implemented in [lib/context-builder.ts](lib/context-builder.ts).

The final `contractContext` string includes:

- audit target
- chain
- audit focus
- acquisition mode
- verified-source summary or bytecode summary
- proxy / implementation hints
- recent transaction summary
- retrieval mode
- retrieved evidence blocks

This context is what gets submitted on-chain to the VeriSom contract.

### 5. Local heuristic assessment layer

Implemented in [lib/interaction-assessment.ts](lib/interaction-assessment.ts).

Before the Somnia result comes back, VeriSom computes local findings using:

- source verification status
- proxy detection
- bytecode flags
- upgradeability signals
- privileged functions
- pause / freeze controls
- mint / burn / rebase controls
- upgrade functions
- fund movement functions
- fee / tax / wallet-limit controls
- recent failed transactions
- missing activity history

This produces:

- `localHeuristicRecommendation`
- `localHeuristicRiskLevel`
- `localHeuristicRiskScore`
- `reasons`
- `keyFindings`

The final recommendation is then reconciled with the Somnia score.

### 6. On-chain request and callback layer

Implemented in [lib/verisom.ts](lib/verisom.ts) and [lib/verisom-abi.ts](lib/verisom-abi.ts).

The current contract interaction flow is:

1. Read `getRequiredDeposit()`
2. Submit `requestSafetyScore(targetContract, chainName, contractContext)` with the required deposit
3. Parse the `SafetyScoreRequested` event from the receipt
4. Poll `auditJobs(requestId)`
5. Query `SafetyScoreReceived` events
6. Return the final parsed score and transaction reference

Relevant ABI surface:

```text
getRequiredDeposit()
requestSafetyScore(address,string,string)
auditJobs(uint256)
SafetyScoreRequested(...)
SafetyScoreReceived(...)
```

## MCP architecture

### Local stdio mode

`stdio` mode is the recommended mode for Claude Desktop and similar local agent connectors.

Why:

- the private key can stay in the connector environment
- the agent does not need to resend `privateKey` every call
- the MCP server can use `AGENT_PRIVATE_KEY` automatically

Entrypoint:

- [mcp-stdio.ts](mcp-stdio.ts)

Behavior:

- `allowEnvPrivateKey: true`

### HTTP MCP mode

HTTP MCP is exposed through [app/api/mcp/route.ts](app/api/mcp/route.ts).

Behavior:

- `allowEnvPrivateKey: false`

That distinction is important:

- in local `stdio`, env keys belong to the user's own local connector
- in HTTP mode, server env keys would belong to the deployed server, not to the calling agent

So in HTTP mode the caller must explicitly provide `privateKey`.

## MCP tool contract

### Tool name

- `score_contract_before_interaction`

### Input

```ts
{
  targetAddress: string;
  chainName?: string;
  intendedInteraction?: string;
  auditFocus?: string;
  privateKey?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}
```

### Output

```ts
{
  targetAddress: string;
  chainName: string;
  somniaScore: number;
  somniaStatus: string;
  scoreBand: "strong" | "caution" | "danger" | "unknown";
  scoreInterpretation: string;
  recommendation: "allow" | "review" | "avoid";
  shouldInteract: boolean;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  reasons: string[];
  keyFindings: Array<{
    title: string;
    severity: "low" | "medium" | "high";
    evidence: string;
  }>;
  proceedGuidance: string;
  localHeuristicRecommendation: "allow" | "review" | "avoid";
  localHeuristicRiskLevel: "low" | "medium" | "high";
  localHeuristicRiskScore: number;
  verified: boolean;
  sourceMode: "verified-source" | "bytecode-fallback";
  contractName: string | null;
  compilerVersion: string | null;
  proxyDetected: boolean;
  implementationAddress: string | null;
  retrievalMode: string;
  recentTransactionCount: number;
  privateKeySource: "input" | "env";
  oracleTransactionHash: string;
  ragContextUsed: Array<...>;
  contractFunctionsUsed: Array<...>;
  recentTransactionsUsed: Array<...>;
  bytecodeSignalsUsed: {
    patterns: Array<...>;
    specialFlags: string[];
    selectors: Array<...>;
  } | null;
  contractContext: string;
}
```

## Security model

### Private keys

VeriSom is designed so the easiest recommended path is also the safer one:

- use local `stdio` MCP
- keep `AGENT_PRIVATE_KEY` in the agent connector environment
- never paste the key into chat
- never send the key in every tool call unless you are intentionally using HTTP mode

### Important distinction

`AGENT_PRIVATE_KEY` fallback is only appropriate when the MCP process is running locally for the user.

It is not appropriate for a shared remote server model.

### What the score means

VeriSom is a contract interaction risk gate, not a formal verification engine and not a complete manual audit replacement.

Agents should use it as:

- a pre-transaction control
- a contract selection filter
- a reason to stop and ask for review when the output says `review` or `avoid`

## API reference

### `POST /api/analyze`

Analyze a contract and build the context without submitting an on-chain request.

Example:

```json
{
  "targetAddress": "0x3203332165Fa483e317095DcBA7d56d2ED4E15bC",
  "chainName": "Somnia Testnet",
  "auditFocus": "reentrancy, access control, fund handling"
}
```

Returns analysis artifacts including:

- verification status
- source mode
- contract profile
- recent transactions
- local knowledge base preview
- assembled `contractContext`

### `POST /api/request`

Submit a prepared contract context to the VeriSom contract.

Example:

```json
{
  "targetAddress": "0x3203332165Fa483e317095DcBA7d56d2ED4E15bC",
  "chainName": "Somnia Testnet",
  "contractContext": "prebuilt context string",
  "privateKey": "0x..."
}
```

### `GET /api/request/[requestId]`

Read request status and score data.

Query param:

- `startBlock` optional

### `GET /api/mcp/health`

Health response:

```json
{
  "status": "ok",
  "service": "verisom-audit-mcp"
}
```

## Local development setup

### Prerequisites

- Node.js
- npm
- access to Somnia RPC and explorer endpoints
- a funded private key if you want to submit live score requests

### Install

Clone the repository:

```powershell
git clone https://github.com/anoop04singh/verisom.git
cd verisom
```

Then install dependencies:

```powershell
cmd /c npm install
```

### Configure environment

Create `.env` from `.env.example`.

Current environment variables:

```env
SOMNIA_RPC_URL=https://api.infra.testnet.somnia.network
SOMNIA_EXPLORER_BASE_URL=https://shannon-explorer.somnia.network
VERISOM_CONTRACT_ADDRESS=0x45e89Bae0eD991b63F8988d13EcEC1Ae0eEdDA77
AGENT_PRIVATE_KEY=0xYOUR_AGENT_PRIVATE_KEY_HERE
CHAIN_NAME=Somnia Testnet
VERISOM_POLL_INTERVAL_MS=5000
```

### Run the app

```powershell
cmd /c npm run dev
```

Then open:

- [http://localhost:3000](http://localhost:3000)

### Build for production

```powershell
cmd /c npm run build
cmd /c npm run start
```

## Claude Desktop setup

This is the recommended way to use VeriSom as an MCP server.

### Why this mode is preferred

- easiest setup for end users
- key stays local to the connector
- no need to send `privateKey` in every tool call
- direct synchronous score response

### Claude config example

Open your Claude Desktop MCP config and add:

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

Then restart Claude Desktop.

### Example Claude prompt

```text
Use VeriSom to score this contract before interaction.

targetAddress: 0x3203332165Fa483e317095DcBA7d56d2ED4E15bC
intendedInteraction: swap 500 USDC for ETH
auditFocus: reentrancy, access control, fund handling
```

## HTTP MCP usage

If you are integrating over HTTP rather than local `stdio`:

- endpoint: `http://localhost:3000/api/mcp`
- health: `http://localhost:3000/api/mcp/health`

In this mode, pass `privateKey` explicitly because env fallback is disabled.

## Example result shape

```text
Target contract: 0x...
Somnia Agents score: 85
Score band: strong
Recommendation: allow
Risk level: low
Risk score: 15
Interpretation: The Somnia Agents score suggests comparatively lower observed risk.

Key findings:
- [low] Lower structural uncertainty: Verified source is available and no obvious proxy layer was detected.

Guidance: Proceed for the intended interaction, but still verify transaction parameters, token amounts, and approvals at execution time.
```

## Repository layout

```text
verisom-final/
|-- app/
|   |-- api/
|   |   |-- analyze/route.ts
|   |   |-- mcp/route.ts
|   |   |-- mcp/health/route.ts
|   |   |-- request/route.ts
|   |   `-- request/[requestId]/route.ts
|   |-- globals.css
|   |-- icon.svg
|   |-- layout.tsx
|   `-- page.tsx
|-- components/
|   `-- landing-page.tsx
|-- lib/
|   |-- audit-pipeline.ts
|   |-- bytecode-analyzer.ts
|   |-- config.ts
|   |-- context-builder.ts
|   |-- explorer.ts
|   |-- interaction-assessment.ts
|   |-- mcp-server.ts
|   |-- rag.ts
|   |-- rpc.ts
|   |-- types.ts
|   |-- utils.ts
|   |-- verisom-abi.ts
|   `-- verisom.ts
|-- public/
|   |-- verisom-logo.png
|   `-- verisom-logo.svg
|-- mcp-stdio.ts
|-- package.json
`-- README.md
```

## Current design decisions

- Embedding-based RAG was removed.
- RAG now works fully locally using lexical ranking.
- The MCP surface is intentionally minimal: one tool, one final score result.
- The landing page is marketing-only; the main product value is the MCP service.
- The agent receives evidence artifacts, not just a naked score.

## Limitations

- Bytecode analysis is heuristic, not decompilation.
- Explorer completeness affects metadata quality.
- Recent transaction interpretation depends on explorer response quality.
- On-chain score turnaround depends on the VeriSom contract workflow and callback timing.
- A strong score is not a guarantee of safety.

## Recommended usage model

Use VeriSom when an agent is about to:

- approve a token
- call an arbitrary contract
- swap through an unknown router
- transfer value into a protocol
- interact with a newly discovered token or dApp

Recommended agent behavior:

- `allow`: proceed with normal parameter checks
- `review`: require human or policy review
- `avoid`: stop the interaction and choose another path

## Verification

Useful local commands:

```powershell
cmd /c npm run build
cmd /c npm run mcp:stdio
```

## License

Add your intended license here if the repository is meant to be open-source under a specific license.
