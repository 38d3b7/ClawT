"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { transferUSDC } from "@/lib/wallet";
import { connectWallet } from "@/lib/wallet";

interface ListingDetail {
  id: string;
  type: "skill" | "soul";
  title: string;
  description: string;
  price: number;
  priceFormatted: string;
  sellerAddress: string;
  preview: string;
  isOwner: boolean;
  purchased: boolean;
  content: string | null;
  createdAt: string;
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [delisting, setDelisting] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState<string | null>(null);

  const getToken = useCallback((): string | null => {
    const saved = localStorage.getItem("clawt-session");
    if (!saved) return null;
    return JSON.parse(saved).token;
  }, []);

  useEffect(() => {
    const token = getToken();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(`/api/marketplace/listings/${id}`, { headers })
      .then((r) => {
        if (!r.ok) throw new Error("Listing not found");
        return r.json();
      })
      .then((data: ListingDetail) => {
        setListing(data);
        if (data.content) setContent(data.content);
      })
      .catch(() => setError("Listing not found"))
      .finally(() => setLoading(false));
  }, [id, getToken]);

  async function handleBuy() {
    if (!listing) return;
    setError("");
    setBuying(true);

    try {
      const { address } = await connectWallet();
      const txHash = await transferUSDC(
        address as `0x${string}`,
        listing.sellerAddress as `0x${string}`,
        BigInt(listing.price)
      );

      const token = getToken();
      if (!token) throw new Error("Please sign in first");

      const res = await fetch(`/api/marketplace/listings/${id}/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ txHash }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Purchase verification failed");

      setContent(data.content);
      setListing((prev) => (prev ? { ...prev, purchased: true, content: data.content } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuying(false);
    }
  }

  async function handleDelist() {
    if (!listing) return;
    setDelisting(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Please sign in first");

      const res = await fetch(`/api/marketplace/listings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delist");
      router.push("/skills");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDelisting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Listing not found</p>
        <Link href="/skills" className="text-sm text-primary underline">
          Back to skills
        </Link>
      </div>
    );
  }

  const hasContent = !!content;

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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={listing.type === "skill" ? "/skills" : "/souls"}
          className="mb-6 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to {listing.type === "skill" ? "skills" : "souls"}
        </Link>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} className="ml-2 font-medium underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                {listing.type}
              </span>
              <h1 className="text-xl font-semibold">{listing.title}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{listing.description}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-semibold text-primary">{listing.priceFormatted}</p>
            <p className="text-xs text-muted-foreground">USDC</p>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Seller: <span className="font-mono">{listing.sellerAddress.slice(0, 8)}...{listing.sellerAddress.slice(-6)}</span>
          </span>
          {listing.createdAt && (
            <span>Listed {new Date(listing.createdAt).toLocaleDateString()}</span>
          )}
        </div>

        {listing.isOwner ? (
          <button
            onClick={handleDelist}
            disabled={delisting}
            className="mb-6 rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {delisting ? "Delisting..." : "Delist This Item"}
          </button>
        ) : !hasContent ? (
          <button
            onClick={handleBuy}
            disabled={buying}
            className="mb-6 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {buying ? "Processing payment..." : `Buy for ${listing.priceFormatted} USDC`}
          </button>
        ) : (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Purchased
          </div>
        )}

        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-medium">
              {hasContent ? "Full Content" : "Preview"}
            </h2>
          </div>
          <div className="p-4">
            {hasContent ? (
              <div className="relative">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {content}
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(content!)}
                  className="absolute right-0 top-0 rounded border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted"
                >
                  Copy
                </button>
              </div>
            ) : (
              <div className="relative">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                  {listing.preview}
                </pre>
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
