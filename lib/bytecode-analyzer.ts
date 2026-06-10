import { BytecodeAnalysis } from "@/lib/types";

type Opcode = {
  name: string;
  push: number;
};

const OPCODES: Record<number, Opcode> = {
  0x00: { name: "STOP", push: 0 },
  0x14: { name: "EQ", push: 0 },
  0x20: { name: "KECCAK256", push: 0 },
  0x34: { name: "CALLVALUE", push: 0 },
  0x54: { name: "SLOAD", push: 0 },
  0x55: { name: "SSTORE", push: 0 },
  0x56: { name: "JUMP", push: 0 },
  0x57: { name: "JUMPI", push: 0 },
  0x5b: { name: "JUMPDEST", push: 0 },
  0xa1: { name: "LOG1", push: 0 },
  0xa2: { name: "LOG2", push: 0 },
  0xa3: { name: "LOG3", push: 0 },
  0xa4: { name: "LOG4", push: 0 },
  0xf0: { name: "CREATE", push: 0 },
  0xf4: { name: "DELEGATECALL", push: 0 },
  0xf5: { name: "CREATE2", push: 0 },
  0xfa: { name: "STATICCALL", push: 0 },
  0xff: { name: "SELFDESTRUCT", push: 0 }
};

for (let index = 1; index <= 32; index += 1) {
  OPCODES[0x5f + index] = { name: `PUSH${index}`, push: index };
}

const KNOWN_SELECTORS: Record<string, string[]> = {
  "0x18160ddd": ["totalSupply()"],
  "0x70a08231": ["balanceOf(address)"],
  "0xa9059cbb": ["transfer(address,uint256)"],
  "0x23b872dd": ["transferFrom(address,address,uint256)"],
  "0x095ea7b3": ["approve(address,uint256)"],
  "0xdd62ed3e": ["allowance(address,address)"],
  "0x8da5cb5b": ["owner()"],
  "0xf2fde38b": ["transferOwnership(address)"],
  "0x715018a6": ["renounceOwnership()"],
  "0x3659cfe6": ["upgradeTo(address)"],
  "0x4f1ef286": ["upgradeToAndCall(address,bytes)"],
  "0x8456cb59": ["pause()"],
  "0x3f4ba83a": ["unpause()"],
  "0xac9650d8": ["multicall(bytes[])"]
};

const PATTERNS = [
  {
    standard: "ERC20",
    description: "ERC-20 fungible token",
    selectors: ["0x18160ddd", "0x70a08231", "0xa9059cbb", "0x23b872dd", "0x095ea7b3", "0xdd62ed3e"]
  },
  {
    standard: "Ownable",
    description: "owner-based access control",
    selectors: ["0x8da5cb5b", "0xf2fde38b"]
  },
  {
    standard: "Upgradeable",
    description: "upgradeability surface",
    selectors: ["0x3659cfe6", "0x4f1ef286"]
  }
];

type Instruction = {
  name: string;
  operand: string | null;
  byte: number;
};

function disassemble(bytecode: string) {
  const bytes = Buffer.from(bytecode.replace(/^0x/, ""), "hex");
  const instructions: Instruction[] = [];
  let pointer = 0;

  while (pointer < bytes.length) {
    const byte = bytes[pointer];
    const opcode = OPCODES[byte] ?? { name: `UNKNOWN_${byte.toString(16)}`, push: 0 };
    let operand: string | null = null;

    if (opcode.push > 0) {
      const slice = bytes.slice(pointer + 1, pointer + 1 + opcode.push);
      operand = `0x${slice.toString("hex")}`;
      pointer += opcode.push;
    }

    instructions.push({
      name: opcode.name,
      operand,
      byte
    });

    pointer += 1;
  }

  return instructions;
}

function extractSelectors(instructions: Instruction[]) {
  const selectors = new Set<string>();

  for (let index = 0; index < instructions.length - 1; index += 1) {
    const current = instructions[index];
    if (current.name !== "PUSH4" || !current.operand) {
      continue;
    }

    for (let lookahead = index + 1; lookahead < Math.min(index + 4, instructions.length); lookahead += 1) {
      if (instructions[lookahead].name === "EQ") {
        selectors.add(current.operand);
      }
    }
  }

  return Array.from(selectors);
}

function extractPrintableStrings(bytecode: string) {
  const bytes = Buffer.from(bytecode.replace(/^0x/, ""), "hex");
  const matches: Array<{ offset: number; text: string }> = [];
  let cursor = 0;

  while (cursor < bytes.length) {
    let end = cursor;
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) {
      end += 1;
    }

    if (end - cursor >= 5) {
      const text = bytes.slice(cursor, end).toString("ascii");
      if (!/^[a-fA-F0-9]+$/.test(text)) {
        matches.push({ offset: cursor, text });
      }
    }

    cursor = end + 1;
  }

  return matches.slice(0, 15);
}

function detectFlags(instructions: Instruction[]) {
  const flags: string[] = [];
  const opcodes = new Set(instructions.map((instruction) => instruction.name));

  if (opcodes.has("DELEGATECALL")) {
    flags.push("delegatecall");
  }
  if (opcodes.has("CREATE")) {
    flags.push("create");
  }
  if (opcodes.has("CREATE2")) {
    flags.push("create2");
  }
  if (opcodes.has("STATICCALL")) {
    flags.push("staticcall");
  }
  if (opcodes.has("SELFDESTRUCT")) {
    flags.push("selfdestruct");
  }
  if (opcodes.has("CALLVALUE")) {
    flags.push("payable-surface");
  }

  return flags;
}

function fingerprint(selectors: string[]) {
  return PATTERNS.map((pattern) => {
    const matched = pattern.selectors.filter((selector) => selectors.includes(selector)).length;
    const confidence = Math.round((matched / pattern.selectors.length) * 100);

    return {
      standard: pattern.standard,
      description: pattern.description,
      confidence
    };
  })
    .filter((pattern) => pattern.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);
}

export function analyzeBytecode(bytecode: string): BytecodeAnalysis {
  const instructions = disassemble(bytecode);
  const selectors = extractSelectors(instructions);

  return {
    bytecodeSize: Math.floor(bytecode.replace(/^0x/, "").length / 2),
    selectors: selectors.map((selector) => ({
      selector,
      signatures: KNOWN_SELECTORS[selector] ?? []
    })),
    patterns: fingerprint(selectors),
    specialFlags: detectFlags(instructions),
    strings: extractPrintableStrings(bytecode)
  };
}
