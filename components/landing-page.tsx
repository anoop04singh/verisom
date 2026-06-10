"use client";

import Link from "next/link";

const navLinks = [
  { href: "#workflow", label: "Workflow" },
  { href: "#surface", label: "MCP Surface" },
  { href: "#developers", label: "Agent Setup" },
  { href: "#proof", label: "Proof Layer" }
];

const workflowSteps = [
  {
    title: "Inspect the contract surface",
    description:
      "Fetch verified source code when available. If source is unavailable, fall back to deployed bytecode, selectors, and observable contract signals."
  },
  {
    title: "Build the evidence bundle",
    description:
      "Combine source excerpts, ABI or selector functions, recent transactions, bytecode signals, and local RAG retrieval into a structured decision context."
  },
  {
    title: "Return the verdict",
    description:
      "Submit the context to VeriSom on Somnia and return a contract score with an Allow, Review, or Avoid recommendation."
  }
];

const mcpCards = [
  {
    icon: "01",
    title: "Single tool call",
    description:
      "Agents call `score_contract_before_interaction` and receive the final score directly. No request-id handling. No extra choreography."
  },
  {
    icon: "02",
    title: "Connector-owned signing",
    description:
      "In local stdio mode, the connector keeps `AGENT_PRIVATE_KEY` inside its own environment. The agent never sends private keys through prompts or tool arguments."
  },
  {
    icon: "03",
    title: "Structured provenance",
    description:
      "Each response includes the RAG context, inspected functions, recent transactions, bytecode fallback signals, and the exact context submitted for scoring."
  }
];

const proofCards = [
  {
    eyebrow: "RAG Evidence",
    title: "Every score comes with evidence",
    copy:
      "See the retrieved source excerpts, context chunks, and signals that shaped the recommendation."
  },
  {
    eyebrow: "Function Surface",
    title: "Callable behavior stays visible",
    copy:
      "Understand which callable functions were inspected through ABI metadata or bytecode selectors."
  },
  {
    eyebrow: "On-chain Trail",
    title: "The verdict stays anchored",
    copy:
      "Anchor the result to recent contract activity and the final VeriSom oracle transaction."
  }
];

const setupSteps = [
  "Run this project locally and start the stdio server with `npm run mcp:stdio`.",
  "Configure the connector to launch `mcp-stdio.ts` through the local `tsx.cmd` binary.",
  "Set `AGENT_PRIVATE_KEY` once in the connector environment so tool calls stay clean."
];

const scoreFacts = [
  "Somnia safety score",
  "Allow / Review / Avoid recommendation",
  "Key risk findings",
  "RAG context used",
  "Contract functions analyzed",
  "Recent transactions sampled",
  "Submitted context payload",
  "Oracle transaction reference"
];

const codeSample = `{
  "mcpServers": {
    "verisom": {
      "command": "C:\\\\path\\\\to\\\\verisom-final\\\\node_modules\\\\.bin\\\\tsx.cmd",
      "args": [
        "C:\\\\path\\\\to\\\\verisom-final\\\\mcp-stdio.ts"
      ],
      "env": {
        "AGENT_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY_HERE",
        "SOMNIA_RPC_URL": "https://api.infra.testnet.somnia.network",
        "SOMNIA_EXPLORER_BASE_URL": "https://shannon-explorer.somnia.network",
        "VERISOM_CONTRACT_ADDRESS": "0x45e89Bae0eD991b63F8988d13EcEC1Ae0eEdDA77",
        "CHAIN_NAME": "Somnia Testnet"
      }
    }
  }
}`;

const toolCallSample = `const result = await score_contract_before_interaction({
  targetAddress: "0x3203332165Fa483e317095DcBA7d56d2ED4E15bC",
  intendedInteraction: "swap 500 USDC for ETH",
  auditFocus: "reentrancy, access control, fund handling"
});

result.somniaScore;
result.scoreBand;
result.recommendation;
result.keyFindings;
result.ragContextUsed;
result.contractFunctionsUsed;`;

function LogoMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className="vs-logo-mark">
      <path
        fill="currentColor"
        d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="vs-inline-icon">
      <path
        d="M5 12h14M12 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="vs-inline-icon">
      <path
        d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function LandingPage() {
  return (
    <main className="vs-root">
      <div className="vs-video-shell" aria-hidden="true">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="vs-video"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4"
        />
      </div>

      <svg className="vs-noise-defs" aria-hidden="true">
        <defs>
          <filter id="c3-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"
            />
            <feComposite in2="SourceGraphic" operator="in" result="noise" />
            <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
          </filter>
        </defs>
      </svg>

      <nav className="vs-nav">
        <div className="vs-container vs-nav-inner">
          <Link href="/" className="vs-nav-logo" aria-label="VeriSom home">
            <LogoMark />
            <span className="vs-nav-logo-text">VeriSom</span>
          </Link>

          <div className="vs-nav-links">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="vs-nav-actions">
            <a href="#developers" className="vs-nav-cta">
              Setup Guide
            </a>
          </div>
        </div>
      </nav>

      <section className="vs-hero">
        <div className="vs-container vs-hero-inner">
          <div className="vs-hero-eyebrow">
            <span className="vs-eyebrow-dot" />
            On-chain contract safety for autonomous agents
          </div>

          <h1 className="vs-hero-title">
            Score the contract
            <br />
            <span className="vs-gradient-word animate-shiny">before your agent signs.</span>
          </h1>

          <p className="vs-hero-subtitle">
            VeriSom gives AI agents a transaction-time safety verdict before they approve,
            swap, transfer, or call a smart contract. It inspects verified source or
            bytecode, recent on-chain activity, RAG evidence, callable functions, and
            Somnia agent results, then returns a direct score with provenance.
          </p>

          <div className="vs-hero-actions">
            <a href="#developers" className="vs-btn vs-btn-primary vs-btn-hero">
              <BoltIcon />
              View connector setup
            </a>
            <a href="#surface" className="vs-btn vs-btn-outline">
              Explore MCP surface
              <ArrowIcon />
            </a>
          </div>

          <p className="vs-hero-note">
            One MCP tool. One contract score. Evidence included.
          </p>

          <div className="vs-hero-command-center liquid-glass">
            <div className="vs-command-copy">
              <span className="vs-command-kicker">Agent-side result surface</span>
              <h2>Built for the moment before execution.</h2>
              <p>
                Agents do not need long reports. They need a clear decision before value
                moves. VeriSom returns the exact surface an agent needs: score,
                recommendation, findings, inspected functions, recent activity, and the
                evidence used to produce the verdict.
              </p>
              <div className="vs-chip-row vs-chip-row-left">
                {scoreFacts.map((fact) => (
                  <span key={fact} className="vs-chip">
                    {fact}
                  </span>
                ))}
              </div>
            </div>

            <div className="vs-hero-scorecard">
              <div className="vs-score-head">
                <span className="vs-score-title">Example result</span>
                <span className="vs-score-badge">ALLOW</span>
              </div>
              <div className="vs-score-ring-wrap">
                <div className="vs-score-ring">
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <circle className="vs-score-ring-bg" cx="50" cy="50" r="40" />
                    <circle className="vs-score-ring-fill" cx="50" cy="50" r="40" />
                  </svg>
                  <div className="vs-score-ring-text">
                    <span className="vs-score-number">85</span>
                    <span className="vs-score-label">Somnia score</span>
                  </div>
                </div>
              </div>
              <div className="vs-hero-score-list">
                <div className="vs-finding">
                  <span className="vs-finding-mark" />
                  <p>Verified source was available and included in the scoring context.</p>
                </div>
                <div className="vs-finding">
                  <span className="vs-finding-mark" />
                  <p>Recent on-chain activity was sampled before the verdict.</p>
                </div>
                <div className="vs-finding">
                  <span className="vs-finding-mark" />
                  <p>Callable function surface was extracted from ABI metadata or bytecode selectors.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="vs-section" id="workflow">
        <div className="vs-container vs-two-column">
          <div>
            <div className="vs-section-eyebrow">
              <span className="vs-eyebrow-dot" />
              Workflow
              <span className="vs-tag">Pre-transaction scoring</span>
            </div>
            <h2 className="vs-section-title">A control layer for agents that execute on-chain.</h2>
            <p className="vs-section-copy">
              VeriSom acts as a control layer for agents that interact with smart contracts.
              The agent makes one MCP call. VeriSom builds the evidence, submits the
              context to Somnia, and returns a direct safety decision before execution.
            </p>
            <div className="vs-steps">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="vs-step">
                  <div className="vs-step-number">0{index + 1}</div>
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="vs-proof-column" id="proof">
            {proofCards.map((card) => (
              <article key={card.title} className="vs-proof-card liquid-glass">
                <span className="vs-proof-eyebrow">{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="vs-section" id="surface">
        <div className="vs-container">
          <div className="vs-section-center">
            <div className="vs-section-eyebrow">
              <span className="vs-eyebrow-dot" />
              MCP surface
            </div>
            <h2 className="vs-section-title">Minimal input. High-confidence output.</h2>
          </div>

          <div className="vs-card-grid">
            {mcpCards.map((card) => (
              <article key={card.title} className="vs-card liquid-glass">
                <div className="vs-card-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="vs-section" id="developers">
        <div className="vs-container vs-developer-grid">
          <div>
            <div className="vs-section-eyebrow">
              <span className="vs-eyebrow-dot" />
              Agent setup
            </div>
            <h2 className="vs-section-title">Local stdio connector setup.</h2>
            <p className="vs-section-copy">
              VeriSom currently exposes a local stdio MCP server through `mcp-stdio.ts`.
              For Claude-style local connectors, launch the project through the local
              `tsx.cmd` binary and keep `AGENT_PRIVATE_KEY` in the connector environment.
            </p>
            <div className="vs-setup-list">
              {setupSteps.map((step, index) => (
                <div key={step} className="vs-setup-item">
                  <span>0{index + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="vs-code-stack">
            <div className="vs-code-block">
              <div className="vs-code-bar">
                <span className="vs-dot vs-dot-red" />
                <span className="vs-dot vs-dot-yellow" />
                <span className="vs-dot vs-dot-green" />
                <span className="vs-code-label">claude_desktop_config.json</span>
              </div>
              <pre>{codeSample}</pre>
            </div>
            <div className="vs-code-block">
              <div className="vs-code-bar">
                <span className="vs-dot vs-dot-red" />
                <span className="vs-dot vs-dot-yellow" />
                <span className="vs-dot vs-dot-green" />
                <span className="vs-code-label">tool usage</span>
              </div>
              <pre>{toolCallSample}</pre>
            </div>
          </div>
        </div>
      </section>

      <section className="vs-final-cta">
        <div className="vs-container">
          <div className="vs-final-card liquid-glass">
            <div className="vs-final-glow" aria-hidden="true" />
            <h2>Make contract safety part of your agent runtime.</h2>
            <p>
              Give your agent one MCP tool to evaluate smart contracts before interaction.
              Keep signing inside the connector, return a clear score, and preserve the
              evidence behind every verdict.
            </p>
            <div className="vs-hero-actions">
              <a href="#developers" className="vs-btn vs-btn-primary vs-btn-hero">
                <BoltIcon />
                Open setup guide
              </a>
              <a href="#surface" className="vs-btn vs-btn-outline">
                Review MCP surface
                <ArrowIcon />
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="vs-footer">
        <div className="vs-container vs-footer-inner">
          <div className="vs-footer-brand">
            <LogoMark />
            <span>VeriSom</span>
          </div>
          <div className="vs-footer-links">
            <a href="#developers">Agent setup</a>
            <a href="#surface">MCP surface</a>
            <a href="#workflow">Proof layer</a>
            <a href="#workflow">Workflow</a>
          </div>
          <p className="vs-footer-credit">made with &lt;3 by anoop</p>
        </div>
      </footer>
    </main>
  );
}
