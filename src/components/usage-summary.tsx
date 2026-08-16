import type { UserUsage } from "@/lib/usage";

const nf = new Intl.NumberFormat("en-US");

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground font-ui text-[11px] tracking-wider uppercase">
        {label}
      </div>
      <div className="font-data mt-1 text-xl tabular-nums">{value}</div>
    </div>
  );
}

export function UsageSummary({ usage }: { usage: UserUsage }) {
  const { totalTokens, last7Days, requests, conversations, byModel } = usage;
  const max = Math.max(...byModel.map((m) => m.tokens), 1);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-ui text-sm font-medium tracking-wide uppercase">Your usage</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Tokens you&apos;ve used. Everyone here shares one gateway key, so this counts
          against the same budget as everyone else.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total tokens" value={nf.format(totalTokens)} />
        <Stat label="Last 7 days" value={nf.format(last7Days)} />
        <Stat label="Requests" value={nf.format(requests)} />
        <Stat label="Chats" value={nf.format(conversations)} />
      </div>

      {byModel.length > 0 && (
        <div className="rounded-md border p-4">
          <div className="text-muted-foreground font-ui mb-3 text-[11px] tracking-wider uppercase">
            By model
          </div>
          <ul className="space-y-2.5">
            {byModel.map((m) => (
              <li key={m.model} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-data truncate text-xs">{m.model}</span>
                  <span className="font-data shrink-0 text-xs tabular-nums">
                    {nf.format(m.tokens)}
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-brand h-full rounded-full"
                    style={{ width: `${Math.max((m.tokens / max) * 100, 2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalTokens === 0 && (
        <p className="text-muted-foreground text-sm">
          Nothing yet — send a message and it&apos;ll show up here.
        </p>
      )}
    </section>
  );
}
