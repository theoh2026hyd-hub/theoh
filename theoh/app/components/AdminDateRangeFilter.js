"use client";

import { Calendar, RefreshCw } from "lucide-react";

export default function AdminDateRangeFilter({
  value,
  onChange,
  onApply,
  isSyncing = false,
  compact = false
}) {
  const preset = value?.preset || "today";
  const isCustom = preset === "custom";

  return (
    <div
      className={`admin-date-range-filter${compact ? " compact" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap"
      }}
    >
      <Calendar size={14} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
      {isSyncing && (
        <RefreshCw size={14} style={{ color: "var(--accent-gold)", flexShrink: 0, animation: "spin 1s linear infinite" }} />
      )}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
      <select
        value={preset}
        onChange={(e) => {
          const next = { ...value, preset: e.target.value };
          onChange(next);
          if (e.target.value !== "custom") {
            onApply(next);
          }
        }}
        style={{
          background: "rgba(10, 15, 12, 0.6)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: "6px",
          fontSize: "12px",
          outline: "none",
          cursor: "pointer"
        }}
      >
        <option value="today">Today</option>
        <option value="week">Last 7 days</option>
        <option value="month">Last 30 days</option>
        <option value="custom">Custom range</option>
        <option value="all">All time</option>
      </select>

      {isCustom && (
        <>
          <input
            type="date"
            value={value?.from || ""}
            onChange={(e) => {
              const next = { ...value, from: e.target.value };
              onChange(next);
              if (next.from && next.to) onApply(next);
            }}
            style={{
              background: "rgba(10, 15, 12, 0.6)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              padding: "5px 8px",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer"
            }}
          />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>to</span>
          <input
            type="date"
            value={value?.to || ""}
            min={value?.from || undefined}
            onChange={(e) => {
              const next = { ...value, to: e.target.value };
              onChange(next);
              if (next.from && next.to) onApply(next);
            }}
            style={{
              background: "rgba(10, 15, 12, 0.6)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              padding: "5px 8px",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer"
            }}
          />
        </>
      )}



      {preset !== "all" && (
        <button
          type="button"
          className="icon-action-btn delete"
          onClick={() => {
            onChange({ preset: "all", from: "", to: "" });
            onApply({ preset: "all", from: "", to: "" });
          }}
          style={{ padding: "6px 10px", fontSize: "11px" }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
