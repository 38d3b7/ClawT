import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";

function parseImageRef(imageRef: string): { registry: string; repo: string; tag: string } {
  let ref = imageRef;
  let registry = "registry-1.docker.io";
  let tag = "latest";

  const tagIdx = ref.lastIndexOf(":");
  if (tagIdx !== -1 && !ref.substring(tagIdx + 1).includes("/")) {
    tag = ref.substring(tagIdx + 1);
    ref = ref.substring(0, tagIdx);
  }

  const slashCount = [...ref].filter((c) => c === "/").length;
  if (slashCount === 1) {
    return { registry, repo: ref, tag };
  }

  if (ref.includes(".") || ref.includes(":")) {
    const firstSlash = ref.indexOf("/");
    registry = ref.substring(0, firstSlash);
    ref = ref.substring(firstSlash + 1);
    if (registry === "docker.io") registry = "registry-1.docker.io";
  }

  return { registry, repo: ref, tag };
}

export async function POST(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { imageRef } = await request.json();
    if (!imageRef) {
      return NextResponse.json({ error: "Missing imageRef" }, { status: 400 });
    }

    const { registry, repo, tag } = parseImageRef(imageRef);

    let token = "";
    if (registry === "registry-1.docker.io") {
      const tokenRes = await fetch(
        `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull`
      );
      if (!tokenRes.ok) {
        throw new Error(`Docker auth failed: ${tokenRes.status}`);
      }
      const tokenData = await tokenRes.json();
      token = tokenData.token;
    }

    const manifestRes = await fetch(`https://${registry}/v2/${repo}/manifests/${tag}`, {
      headers: {
        Accept: [
          "application/vnd.docker.distribution.manifest.list.v2+json",
          "application/vnd.oci.image.index.v1+json",
          "application/vnd.docker.distribution.manifest.v2+json",
          "application/vnd.oci.image.manifest.v1+json",
        ].join(", "),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!manifestRes.ok) {
      const body = await manifestRes.text();
      throw new Error(`Registry returned ${manifestRes.status}: ${body.slice(0, 500)}`);
    }

    const manifest = await manifestRes.json();

    if (manifest.manifests && manifest.manifests.length > 0) {
      for (const m of manifest.manifests) {
        const platform = m.platform
          ? `${m.platform.os}/${m.platform.architecture}`
          : null;
        if (platform === "linux/amd64") {
          return NextResponse.json({
            digest: m.digest,
            registry: repo.includes("/") && !repo.startsWith("docker.io")
              ? `${registry === "registry-1.docker.io" ? "docker.io" : registry}/${repo}`
              : `docker.io/${repo}`,
          });
        }
      }
      const platforms = manifest.manifests
        .map((m: { platform?: { os: string; architecture: string } }) =>
          m.platform ? `${m.platform.os}/${m.platform.architecture}` : "unknown"
        )
        .join(", ");
      throw new Error(`No linux/amd64 manifest found. Available: ${platforms}`);
    }

    const contentDigest = manifestRes.headers.get("Docker-Content-Digest");
    if (contentDigest) {
      return NextResponse.json({
        digest: contentDigest,
        registry: `docker.io/${repo}`,
      });
    }

    throw new Error("Could not extract digest from manifest");
  } catch (err) {
    console.error("[image-digest] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
