import {
  createWalletClient,
  createPublicClient,
  custom,
  getAddress,
  type WalletClient,
  type PublicClient,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";

export type EigenClients = {
  walletClient: WalletClient;
  publicClient: PublicClient;
  address: `0x${string}`;
};

export async function createClients(): Promise<EigenClients> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.[0]) throw new Error("No accounts returned");
  const address = getAddress(accounts[0]);

  const walletClient = createWalletClient({
    account: address,
    chain: sepolia,
    transport: custom(window.ethereum),
  });
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(window.ethereum),
  });

  return { walletClient, publicClient, address };
}

export async function signSiweForEigen(
  address: `0x${string}`,
  walletClient: WalletClient
) {
  const sdk = await import("@layr-labs/ecloud-sdk/browser");
  const siwe = sdk.createSiweMessage({
    address,
    chainId: sepolia.id,
    domain: window.location.host,
    uri: window.location.origin,
    statement: "Sign in to CLAWT",
  });
  const signature = await walletClient.signMessage({
    account: address,
    message: siwe.message,
  });
  return { message: siwe.message, signature };
}

async function resolveImageDigest(
  imageRef: string,
  token: string
): Promise<{ digest: string; registry: string }> {
  const res = await fetch("/api/eigen/image-digest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageRef }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Image digest resolution failed: ${data.error ?? res.status}`);
  }
  return res.json();
}

export async function deployAgent(
  clients: EigenClients,
  envVars: Record<string, string>,
  opts: { name: string; token: string }
) {
  const sdk = await import("@layr-labs/ecloud-sdk/browser");
  const envConfig = sdk.getEnvironmentConfig("sepolia");
  const imageRef = process.env.NEXT_PUBLIC_AGENT_IMAGE ?? "frsrventure/clawt-agent:latest";

  const { digest: digestStr, registry } = await resolveImageDigest(imageRef, opts.token);

  const digestHex = digestStr.includes(":") ? digestStr.split(":")[1] : digestStr;
  const digestBytes = new Uint8Array(
    digestHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
  );
  if (digestBytes.length !== 32) {
    throw new Error(`Digest must be 32 bytes, got ${digestBytes.length}`);
  }

  const salt = crypto.getRandomValues(new Uint8Array(32));

  const appId = await sdk.calculateAppID({
    publicClient: clients.publicClient,
    environmentConfig: envConfig,
    ownerAddress: clients.address,
    salt,
  });

  const keys = sdk.getKMSKeysForEnvironment("sepolia", "prod");
  const protectedHeaders = sdk.getAppProtectedHeaders(appId);
  const plaintext = Buffer.from(JSON.stringify(envVars));
  const encryptedEnvStr = await sdk.encryptRSAOAEPAndAES256GCM(
    keys.encryptionKey,
    plaintext,
    protectedHeaders
  );

  const release = {
    rmsRelease: {
      artifacts: [{ digest: digestBytes, registry }],
      upgradeByTime: Math.floor(Date.now() / 1000) + 3600,
    },
    publicEnv: new Uint8Array(Buffer.from(JSON.stringify({}))),
    encryptedEnv: new Uint8Array(Buffer.from(encryptedEnvStr)),
  };

  const prepared = await sdk.prepareDeployBatch({
    walletClient: clients.walletClient,
    publicClient: clients.publicClient,
    environmentConfig: envConfig,
    salt,
    release,
    publicLogs: false,
    imageRef,
  });

  const canBatch = await sdk.supportsEIP5792(clients.walletClient);

  if (canBatch) {
    const batchResult = await sdk.executeDeployBatched({
      walletClient: clients.walletClient,
      publicClient: clients.publicClient,
      environmentConfig: envConfig,
      data: {
        appId: prepared.appId,
        salt: prepared.salt,
        executions: prepared.executions,
      },
      publicLogs: false,
    });
    return { appId: batchResult.appId as `0x${string}` };
  }

  const seqResult = await sdk.executeDeploySequential({
    walletClient: clients.walletClient,
    publicClient: clients.publicClient,
    environmentConfig: envConfig,
    data: {
      appId: prepared.appId,
      salt: prepared.salt,
      executions: prepared.executions,
    },
    publicLogs: false,
  });
  return { appId: seqResult.appId as `0x${string}` };
}

export async function upgradeAgentEnv(
  clients: EigenClients,
  appId: `0x${string}`,
  envVars: Record<string, string>,
  opts: { token: string }
) {
  const sdk = await import("@layr-labs/ecloud-sdk/browser");
  const envConfig = sdk.getEnvironmentConfig("sepolia");
  const imageRef = process.env.NEXT_PUBLIC_AGENT_IMAGE ?? "frsrventure/clawt-agent:latest";

  const { digest: digestStr, registry } = await resolveImageDigest(imageRef, opts.token);

  const digestHex = digestStr.includes(":") ? digestStr.split(":")[1] : digestStr;
  const digestBytes = new Uint8Array(
    digestHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
  );
  if (digestBytes.length !== 32) {
    throw new Error(`Digest must be 32 bytes, got ${digestBytes.length}`);
  }

  const keys = sdk.getKMSKeysForEnvironment("sepolia", "prod");
  const protectedHeaders = sdk.getAppProtectedHeaders(appId);
  const plaintext = Buffer.from(JSON.stringify(envVars));
  const encryptedEnvStr = await sdk.encryptRSAOAEPAndAES256GCM(
    keys.encryptionKey,
    plaintext,
    protectedHeaders
  );

  const release = {
    rmsRelease: {
      artifacts: [{ digest: digestBytes, registry }],
      upgradeByTime: Math.floor(Date.now() / 1000) + 3600,
    },
    publicEnv: new Uint8Array(Buffer.from(JSON.stringify({}))),
    encryptedEnv: new Uint8Array(Buffer.from(encryptedEnvStr)),
  };

  const prepared = await sdk.prepareUpgradeBatch({
    walletClient: clients.walletClient,
    publicClient: clients.publicClient,
    environmentConfig: envConfig,
    appID: appId,
    release,
    publicLogs: false,
    needsPermissionChange: false,
    imageRef,
  });

  const txHash = await sdk.executeUpgradeBatch(
    { appId: prepared.appId, executions: prepared.executions },
    {
      walletClient: clients.walletClient,
      publicClient: clients.publicClient,
      environmentConfig: envConfig,
    }
  );
  return txHash;
}

export async function sendLifecycleTx(
  clients: EigenClients,
  action: "start" | "stop" | "terminate",
  appId: `0x${string}`
) {
  const sdk = await import("@layr-labs/ecloud-sdk/browser");
  const envConfig = sdk.getEnvironmentConfig("sepolia");

  const encoders = {
    start: sdk.encodeStartAppData,
    stop: sdk.encodeStopAppData,
    terminate: sdk.encodeTerminateAppData,
  };

  const data = encoders[action](appId);

  const hash = await clients.walletClient.sendTransaction({
    account: clients.address,
    to: envConfig.appControllerAddress as `0x${string}`,
    data,
    chain: sepolia,
  });

  await clients.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
