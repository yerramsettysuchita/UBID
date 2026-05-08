"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ubidLookup } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { AppShell } from "@/components/AppShell";

export default function UBIDLookupPage() {
  const [name, setName]       = useState("");
  const [pan, setPan]         = useState("");
  const [gstin, setGstin]     = useState("");
  const [pincode, setPincode] = useState("");

  const lookup = useMutation({
    mutationFn: () => ubidLookup({
      business_name: name.trim()   || undefined,
      pan:    pan.trim().toUpperCase()   || undefined,
      gstin:  gstin.trim().toUpperCase() || undefined,
      pincode: pincode.trim()            || undefined,
    }),
  });

  const data     = lookup.data?.data;
  const definite = (data?.definite_matches as Record<string, unknown>[]) ?? [];
  const probable = (data?.probable_matches as Record<string, unknown>[]) ?? [];
  const safe     = data?.safe_to_register as boolean | undefined;

  const verdictColor = safe === undefined ? "var(--ink-3)"
    : safe ? "var(--active)"
    : definite.length > 0 ? "var(--closed)"
    : "var(--dormant)";

  const verdictBg = safe === undefined ? "var(--surface-2)"
    : safe ? "var(--active-lt)"
    : definite.length > 0 ? "var(--closed-lt)"
    : "var(--dormant-lt)";

  const verdictBorder = safe === undefined ? "var(--edge)"
    : safe ? "rgba(26,107,74,0.25)"
    : definite.length > 0 ? "rgba(127,29,29,0.25)"
    : "rgba(146,64,14,0.25)";

  const hasSearch = name.trim() || pan.trim() || gstin.trim();

  return (
    <AppShell
      title="UBID Preregistration Lookup"
      subtitle="Check whether a business already exists before creating a new registration"
    >
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16 }}>
        {/* Input form */}
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", padding: 22, boxShadow: "var(--shadow-sm)",
          height: "fit-content",
        }}>
          <div style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 18,
          }}>Enter Business Details</div>

          {[
            { label: "Business Name",  value: name,    setter: setName,    placeholder: "Sri Karnataka Textiles Pvt Ltd", mono: false },
            { label: "PAN Number",     value: pan,     setter: setPan,     placeholder: "ABCPK1234L",                    mono: true  },
            { label: "GSTIN",          value: gstin,   setter: setGstin,   placeholder: "29ABCPK1234L1Z5",              mono: true  },
            { label: "Pincode",        value: pincode, setter: setPincode, placeholder: "560001",                        mono: false },
          ].map((field) => (
            <div key={field.label} style={{ marginBottom: 14 }}>
              <label style={{
                fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)",
                display: "block", marginBottom: 5,
                textTransform: "uppercase", letterSpacing: "0.07em",
                fontFamily: "'Poppins', sans-serif",
              }}>{field.label}</label>
              <input
                value={field.value}
                onChange={(e) => field.setter(e.target.value)}
                placeholder={field.placeholder}
                className="input-field"
                style={{
                  fontFamily: field.mono ? "'JetBrains Mono', monospace" : "'Poppins', sans-serif",
                  fontSize: 13,
                }}
                onKeyDown={(e) => e.key === "Enter" && lookup.mutate()}
              />
            </div>
          ))}

          <button
            onClick={() => lookup.mutate()}
            disabled={lookup.isPending || !hasSearch}
            style={{
              width: "100%", padding: "11px 0", border: "none",
              borderRadius: "var(--r-md)",
              background: lookup.isPending || !hasSearch ? "var(--surface-2)" : "var(--navy)",
              color: lookup.isPending || !hasSearch ? "var(--ink-3)" : "#fff",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
              boxShadow: lookup.isPending || !hasSearch ? "none" : "0 4px 14px rgba(13,27,53,0.28)",
              fontFamily: "'Poppins', sans-serif", letterSpacing: "0.01em",
              transition: "all 0.15s",
            }}
          >
            {lookup.isPending ? "Checking…" : "Check for Existing UBID"}
          </button>

          <div style={{ marginTop: 10, fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>
            Provide at least one field to search
          </div>
        </div>

        {/* Results */}
        <div>
          {!data && !lookup.isPending && (
            <div style={{
              background: "var(--surface)", borderRadius: "var(--r-lg)",
              border: "1px solid var(--edge)", padding: "60px 40px",
              textAlign: "center", boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.18, color: "var(--ink)" }}>◎</div>
              <div style={{
                fontSize: 15, fontFamily: "'Poppins', serif",
                fontWeight: 600, color: "var(--ink)", marginBottom: 8,
              }}>Enter business details and click Check</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                We'll search across all Karnataka department records
              </div>
            </div>
          )}

          {lookup.isPending && (
            <div style={{
              background: "var(--surface)", borderRadius: "var(--r-lg)",
              border: "1px solid var(--edge)", padding: "60px 0",
              textAlign: "center", color: "var(--navy)",
              boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", margin: "0 auto 16px",
                border: "3px solid var(--edge)", borderTopColor: "var(--navy)",
                animation: "spin 0.7s linear infinite",
              }} />
              <div style={{ fontWeight: 600, fontFamily: "'Poppins', serif" }}>
                Searching across all departments…
              </div>
            </div>
          )}

          {data && (
            <div>
              {/* Verdict card */}
              <div style={{
                background: verdictBg, borderRadius: "var(--r-lg)",
                border: `1px solid ${verdictBorder}`,
                padding: "18px 22px", marginBottom: 14,
                boxShadow: "var(--shadow-sm)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: verdictColor === "var(--ink-3)" ? "var(--surface-2)" : `${verdictColor}1A`,
                    border: `1.5px solid ${verdictBorder}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, color: verdictColor,
                  }}>
                    {safe === undefined ? "◎" : safe ? "✓" : definite.length > 0 ? "✗" : "⚠"}
                  </div>
                  <div>
                    <div style={{
                      fontWeight: 800, fontSize: 15, color: verdictColor,
                      fontFamily: "'Poppins', serif",
                    }}>
                      {safe ? "CLEAR — Safe to Register"
                        : definite.length > 0 ? "BLOCKED — Business Already Exists"
                        : "REVIEW — Similar Businesses Found"}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>
                      {data.recommendation as string}
                    </div>
                  </div>
                </div>
              </div>

              {/* Definite matches */}
              {definite.length > 0 && (
                <div style={{
                  background: "var(--surface)", borderRadius: "var(--r-lg)",
                  border: "1px solid rgba(127,29,29,0.25)", overflow: "hidden", marginBottom: 12,
                  boxShadow: "var(--shadow-sm)",
                }}>
                  <div style={{
                    padding: "11px 18px", background: "var(--closed-lt)",
                    borderBottom: "1px solid rgba(127,29,29,0.18)",
                    fontFamily: "'Poppins', serif",
                    fontWeight: 700, fontSize: 13, color: "var(--closed)",
                  }}>
                    ✗ Definite Matches ({definite.length})
                  </div>
                  {definite.map((m) => (
                    <div key={m.ubid as string} style={{ padding: "16px 18px", borderBottom: "1px solid var(--edge)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 5, fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
                            {m.canonical_name as string}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--closed)", fontWeight: 600, marginBottom: 8 }}>
                            {m.reason as string}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <StatusBadge status={m.status as string} size="sm" />
                            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                              {m.district as string} · {m.primary_pincode as string}
                            </span>
                            {!!(m.pan) && (
                              <code style={{
                                fontSize: 10, color: "var(--gold-dk)", background: "var(--gold-lt)",
                                padding: "1px 6px", borderRadius: 3,
                                fontFamily: "'JetBrains Mono', monospace",
                                border: "1px solid rgba(184,132,12,0.18)",
                              }}>{m.pan as string}</code>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                          <div style={{
                            fontSize: 24, fontWeight: 800, color: "var(--closed)",
                            fontFamily: "'Poppins', serif",
                          }}>{Math.round((m.confidence as number) * 100)}%</div>
                          <div style={{ fontSize: 10, color: "var(--ink-3)" }}>confidence</div>
                          <Link href={`/business/${m.ubid}`} style={{
                            display: "block", marginTop: 8, fontSize: 11.5,
                            padding: "6px 14px", background: "var(--navy)", color: "#fff",
                            borderRadius: "var(--r-md)", fontWeight: 700, textAlign: "center",
                            fontFamily: "'Poppins', sans-serif",
                            boxShadow: "0 2px 8px rgba(13,27,53,0.22)",
                          }}>
                            Open UBID →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Probable matches */}
              {probable.length > 0 && (
                <div style={{
                  background: "var(--surface)", borderRadius: "var(--r-lg)",
                  border: "1px solid rgba(146,64,14,0.25)", overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                }}>
                  <div style={{
                    padding: "11px 18px", background: "var(--dormant-lt)",
                    borderBottom: "1px solid rgba(146,64,14,0.18)",
                    fontFamily: "'Poppins', serif",
                    fontWeight: 700, fontSize: 13, color: "var(--dormant)",
                  }}>
                    ⚠ Probable Matches ({probable.length}) — Review Before Proceeding
                  </div>
                  {probable.map((m) => (
                    <div key={m.ubid as string} style={{ padding: "16px 18px", borderBottom: "1px solid var(--edge)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 5, fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
                            {m.canonical_name as string}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--dormant)", marginBottom: 8 }}>
                            {m.reason as string}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <StatusBadge status={m.status as string} size="sm" />
                            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                              {m.district as string} · {m.primary_pincode as string}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                          <div style={{
                            fontSize: 24, fontWeight: 800, color: "var(--dormant)",
                            fontFamily: "'Poppins', serif",
                          }}>{Math.round((m.confidence as number) * 100)}%</div>
                          <div style={{ fontSize: 10, color: "var(--ink-3)" }}>similarity</div>
                          <Link href={`/business/${m.ubid}`} style={{
                            display: "block", marginTop: 8, fontSize: 11.5,
                            padding: "6px 14px", background: "var(--dormant)", color: "#fff",
                            borderRadius: "var(--r-md)", fontWeight: 700, textAlign: "center",
                            fontFamily: "'Poppins', sans-serif",
                          }}>
                            Review →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
