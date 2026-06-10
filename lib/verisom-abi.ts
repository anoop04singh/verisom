export const VERISOM_ABI = [
  "function getRequiredDeposit() view returns (uint256)",
  "function requestSafetyScore(address targetContract,string chainName,string contractContext) payable returns (uint256 requestId)",
  "function auditJobs(uint256) view returns (address requester,address targetContract,string chainName,uint256 createdAt,bool completed,uint8 status,string rawScore,uint256 parsedScore)",
  "event SafetyScoreRequested(uint256 indexed requestId,address indexed requester,address indexed targetContract,string chainName)",
  "event SafetyScoreReceived(uint256 indexed requestId,address indexed requester,address indexed targetContract,uint8 status,string rawScore,uint256 parsedScore)"
] as const;
