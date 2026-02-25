"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ensureWalletClient, signSkillSubmission } from "@/lib/wallet";

type ListingType = "skill" | "soul";

export default function SellPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [type, setType] = useState<ListingType>("skill");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("clawt-session");
    if (!saved) {
      router.push("/");
      return;
    }
    const { token: t } = JSON.parse(saved);
    setToken(t);
  }, [router]);

  async function handleSubmit() {
    setError("");
    const priceDollars = parseFloat(priceStr);
    if (isNaN(priceDollars) || priceDollars < 0.01 || priceDollars > 1000) {
      setError("Price must be between $0.01 and $1000");
      return;
    }
    const priceUsdc = Math.round(priceDollars * 1_000_000);

    setLoading(true);
    try {
      let signatureJson: string | undefined;

      if (type === "skill") {
        const { address, walletClient } = await ensureWalletClient();
        const sig = await signSkillSubmission(address, walletClient, title, content);
        signatureJson = JSON.stringify(sig);
      }

      const res = await fetch("/api/marketplace/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          title,
          description,
          price: priceUsdc,
          content,
          signature: signatureJson,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create listing");
      router.push(`/marketplace/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              CLAWT
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/skills"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Skills
              </Link>
              <Link
                href="/souls"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Souls
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-10">
        <Link
          href={type === "skill" ? "/skills" : "/souls"}
          className="mb-4 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to catalog
        </Link>

        <h1 className="mb-1 text-xl font-semibold">Create Listing</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sell a skill or soul to the CLAWT community. Payments in USDC on Base Sepolia.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} className="ml-2 font-medium underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {(["skill", "soul"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-lg border px-4 py-2 text-sm capitalize transition-all ${
                    type === t
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Title</label>
            <input
              type="text"
              placeholder={type === "skill" ? "e.g. Advanced DeFi Arbitrage" : "e.g. Crypto Legal Advisor"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              placeholder="Brief description of what this offers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="h-20 w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Price (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="1000"
                placeholder="1.00"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-7 pr-4 text-sm outline-none transition-colors focus:border-primary"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                USDC
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {type === "skill" ? "SKILL.md Content" : "System Prompt"}
            </label>
            <p className="mb-1.5 text-xs text-muted-foreground">
              {type === "skill"
                ? "Paste the full SKILL.md with YAML frontmatter and documentation."
                : "Write the system prompt that defines this agent personality."}
            </p>
            <textarea
              placeholder={
                type === "skill"
                  ? "---\nname: my-skill\ndescription: ...\nversion: 1.0.0\n---\n\n# Skill docs..."
                  : "# SOUL\n\nI am a..."
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`h-48 w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary ${
                type === "skill" ? "font-mono text-xs" : ""
              }`}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!title || !description || !priceStr || !content || loading}
            className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? type === "skill"
                ? "Signing & Creating..."
                : "Creating..."
              : type === "skill"
                ? "Sign & Create Listing"
                : "Create Listing"}
          </button>
        </div>
      </main>
    </div>
  );
}
