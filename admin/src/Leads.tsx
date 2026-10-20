// "Book a demo" requests as a pipeline: new → contacted → demo done → pilot → won / lost.
// One tap to email or call; the status changes right away (and goes back if saving fails).
import { useState } from "react";
import { Mail, Phone } from "lucide-react";
import { supabase } from "./supabase";
import {
  ago,
  languageName,
  leadStatuses,
  num,
  useRpc,
  type Lead,
  type LeadStatus,
} from "./lib";
import { Badge, Failed, Loading } from "./ui";

export function Leads() {
  const { data, setData } = useRpc<Lead[]>("hq_leads");
  const [show, setShow] = useState<LeadStatus | "open" | "all">("open");
  const [failed, setFailed] = useState(false);

  if (data === undefined) return <Loading />;
  if (data === null) return <Failed />;

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    const update = (s: LeadStatus) =>
      setData((all) =>
        all?.map((l) => (l.id === lead.id ? { ...l, status: s } : l)),
      );
    update(status);
    const { data: ok, error } = await supabase.rpc("hq_set_lead_status", {
      p_id: lead.id,
      p_status: status,
    });
    if (error || ok !== true) {
      update(lead.status);
      setFailed(true);
    } else setFailed(false);
  };

  const isOpen = (l: Lead) => !["won", "lost"].includes(l.status);
  const tabs: { key: typeof show; label: string; count: number }[] = [
    { key: "open", label: "Open", count: data.filter(isOpen).length },
    ...leadStatuses.map((s) => ({
      key: s.key,
      label: s.label,
      count: data.filter((l) => l.status === s.key).length,
    })),
    { key: "all", label: "All", count: data.length },
  ];
  const rows = data.filter((l) =>
    show === "all" ? true : show === "open" ? isOpen(l) : l.status === show,
  );

  return (
    <div>
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="radiogroup"
        aria-label="Show"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={show === t.key}
            onClick={() => setShow(t.key)}
            className={`min-h-10 shrink-0 rounded-full border px-3 text-sm font-semibold ${
              show === t.key
                ? "border-ink bg-ink text-canvas"
                : "border-line bg-surface text-ink"
            }`}
          >
            {t.label}{" "}
            <span className="tabular-nums opacity-70">{num(t.count)}</span>
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-danger mt-3 text-sm">
          Couldn't save the new status. Try again.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-ink-muted mt-6">No leads here.</p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {rows.map((l) => (
            <li key={l.id} className="rounded-card bg-surface shadow-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {l.restaurant_name || l.name}
                  </p>
                  <p className="text-ink-muted text-sm">
                    {[
                      l.restaurant_name ? l.name : null,
                      l.city,
                      l.language && languageName(l.language),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <label>
                  <span className="sr-only">Status</span>
                  <select
                    value={l.status}
                    onChange={(e) =>
                      void setStatus(l, e.target.value as LeadStatus)
                    }
                    className="input w-auto py-2 text-sm font-semibold"
                  >
                    {leadStatuses.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-ink-muted mt-2 flex flex-wrap items-center gap-2 text-xs">
                Asked {ago(l.created_at)}
                {l.source === "try_your_menu" && <Badge>Tried own menu</Badge>}
                {l.preferred_time && <span>· prefers {l.preferred_time}</span>}
              </p>
              {l.message && (
                <p
                  className="mt-2 line-clamp-3 text-sm whitespace-pre-line"
                  dir="auto"
                >
                  {l.message}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`mailto:${l.email}`}
                  className="btn-secondary min-h-11 px-3 py-2 text-sm"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  {l.email}
                </a>
                {l.phone && (
                  <a
                    href={`tel:${l.phone.replace(/\s+/g, "")}`}
                    className="btn-secondary min-h-11 px-3 py-2 text-sm"
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    {l.phone}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
