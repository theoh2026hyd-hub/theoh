"use client";

import { useState, useEffect, useRef } from "react";
import AdminDashboard from "../components/AdminDashboard";
import { parseJsonResponse } from "../lib/fetchJson";
import { ADMIN_SECTION_KEYS } from "../lib/adminSyncSections";
import { appendDateRangeSearchParams } from "../lib/adminDateRange";

const DEFAULT_TODAY_RANGE = { preset: "today", from: "", to: "" };
const DATE_FILTERED_SECTIONS = new Set(["dashboard", "orders", "customers", "payments", "coins"]);

export default function AdminPage() {
  const [activeOrders, setActiveOrders] = useState([]);
  const [dashboardOrders, setDashboardOrders] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [ordersStats, setOrdersStats] = useState(null);
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminCategories, setAdminCategories] = useState([]);
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminAddons, setAdminAddons] = useState([]);
  const [adminCoupons, setAdminCoupons] = useState([]);
  const [adminCustomers, setAdminCustomers] = useState([]);
  const [adminPayments, setAdminPayments] = useState([]);
  const [adminSettings, setAdminSettings] = useState({});
  const [adminUpdates, setAdminUpdates] = useState([]);
  const [adminEvents, setAdminEvents] = useState([]);
  const [adminUpcomingItems, setAdminUpcomingItems] = useState([]);
  const [adminContacts, setAdminContacts] = useState([]);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [adminBootReady, setAdminBootReady] = useState(false);
  const initialLoadDoneRef = useRef(false);
  const sectionDateRangesRef = useRef({
    dashboard: DEFAULT_TODAY_RANGE,
    orders: DEFAULT_TODAY_RANGE
  });
  const knownOrderIdsRef = useRef(null);
  const adminAudioContextRef = useRef(null);

  const getAdminAudioContext = () => {
    if (typeof window === "undefined") return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!adminAudioContextRef.current) {
      adminAudioContextRef.current = new AudioContext();
    }
    return adminAudioContextRef.current;
  };

  const triggerOrderChime = async (order) => {
    try {
      const ctx = getAdminAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const playTone = (frequency, startAt, duration, volume = 0.24, type = "triangle") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + duration + 0.05);
      };

      playTone(880, now, 0.16);
      playTone(1174.66, now + 0.14, 0.2);
      playTone(1567.98, now + 0.3, 0.38);

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission();
        }
        if (Notification.permission === "granted") {
          new Notification(`New Order ${order.displayOrderId || (order.orderNumber ? `#${String(order.orderNumber).padStart(6, "0")}` : `#${order.id}`)}`, {
            body: `Guest Name: ${order.customerName} | Grand Total: ₹${parseFloat(order.grandTotal || 0).toFixed(2)}`
          });
        }
      }
    } catch (e) {
      console.warn("Chime synthesizer audio play failed:", e);
    }
  };

  const applyAdminPayload = (data, { playChime = false, section = null } = {}) => {
    const keys = section && ADMIN_SECTION_KEYS[section]
      ? ADMIN_SECTION_KEYS[section]
      : Object.keys(data).filter((k) => k !== "success" && k !== "section");

    if (section === "dashboard") {
      if (keys.includes("stats") && data.stats !== undefined) setAdminStats(data.stats);
      if (keys.includes("orders") && data.orders !== undefined) setDashboardOrders(data.orders);
    } else if (section === "orders") {
      if (keys.includes("stats") && data.stats !== undefined) setOrdersStats(data.stats);
      if (keys.includes("orders") && data.orders !== undefined) {
        const nextOrders = data.orders;
        if (playChime && knownOrderIdsRef.current !== null) {
          const newOrders = nextOrders.filter((order) => !knownOrderIdsRef.current.has(order.id));
          newOrders.forEach((order, index) => {
            setTimeout(() => {
              triggerOrderChime(order);
            }, index * 280);
          });
        }
        knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
        setActiveOrders(nextOrders);
      }
    } else {
      if (keys.includes("stats") && data.stats !== undefined) {
        setAdminStats(data.stats);
        setOrdersStats(data.stats);
      }
      if (keys.includes("orders") && data.orders !== undefined) {
        setDashboardOrders(data.orders);
        setActiveOrders(data.orders);
        knownOrderIdsRef.current = new Set(data.orders.map((order) => order.id));
      }
    }

    if (keys.includes("logs") && data.logs !== undefined) setAdminLogs(data.logs);
    if (keys.includes("categories") && data.categories !== undefined) setAdminCategories(data.categories);
    if (keys.includes("products") && data.products !== undefined) setAdminProducts(data.products);
    if (keys.includes("addons") && data.addons !== undefined) setAdminAddons(data.addons);
    if (keys.includes("coupons") && data.coupons !== undefined) setAdminCoupons(data.coupons);
    if (keys.includes("customers") && data.customers !== undefined) setAdminCustomers(data.customers);
    if (keys.includes("payments") && data.payments !== undefined) setAdminPayments(data.payments);
    if (keys.includes("settings") && data.settings !== undefined) setAdminSettings({ ...data.settings });
    if (keys.includes("updates") && data.updates !== undefined) setAdminUpdates(data.updates || []);
    if (keys.includes("events") && data.events !== undefined) setAdminEvents(data.events || []);
    if (keys.includes("upcomingItems") && data.upcomingItems !== undefined) {
      setAdminUpcomingItems(data.upcomingItems || []);
    }
    if (keys.includes("contacts") && data.contacts !== undefined) setAdminContacts(data.contacts || []);
  };

  const fetchAdminData = async ({ section = "dashboard", playChime = false, dateRange, silent = false } = {}) => {
    try {
      if (!silent) setIsSyncing(true);
      let effectiveDateRange = dateRange;

      if (dateRange !== undefined && dateRange !== null) {
        sectionDateRangesRef.current[section] = dateRange;
      } else if (dateRange === undefined && DATE_FILTERED_SECTIONS.has(section)) {
        const secRange = sectionDateRangesRef.current[section] || DEFAULT_TODAY_RANGE;
        effectiveDateRange = secRange?.preset === "all" ? null : secRange;
      } else if (dateRange === undefined && (section === "all" || !section)) {
        effectiveDateRange = DEFAULT_TODAY_RANGE;
      }

      const params = new URLSearchParams({
        section,
        _: String(Date.now())
      });
      if (effectiveDateRange) {
        appendDateRangeSearchParams(params, effectiveDateRange);
      }
      const res = await fetch(`/api/admin?${params.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store" }
      });
      if (res.status === 401) {
        setIsAdminAuthed(false);
        return false;
      }
      const data = await parseJsonResponse(res);
      if (data.success) {
        applyAdminPayload(data, { playChime, section: data.section || section });
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to fetch admin dashboard indexes:", err);
      return false;
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  // Poll orders every 15s; play chime when new order IDs appear
  useEffect(() => {
    if (!isAdminAuthed) return undefined;

    const primeAudio = () => {
      const ctx = getAdminAudioContext();
      if (ctx?.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };
    window.addEventListener("click", primeAudio, { once: true });
    window.addEventListener("keydown", primeAudio, { once: true });

    const pollOrders = () => {
      const range = sectionDateRangesRef.current.orders || DEFAULT_TODAY_RANGE;
      fetchAdminData({
        section: "orders",
        playChime: true,
        silent: true,
        dateRange: range?.preset === "all" ? null : range
      });
    };

    const intervalId = window.setInterval(pollOrders, 15000);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("click", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    };
  }, [isAdminAuthed]);

  // First login load: catalog + today's dashboard metrics only (filters refetch later)
  useEffect(() => {
    if (!isAdminAuthed) {
      setAdminBootReady(false);
      return;
    }
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    sectionDateRangesRef.current = {
      dashboard: DEFAULT_TODAY_RANGE,
      orders: DEFAULT_TODAY_RANGE
    };
    setAdminBootReady(false);
    fetchAdminData({ section: "all", playChime: false, dateRange: DEFAULT_TODAY_RANGE }).finally(() => {
      setAdminBootReady(true);
    });
  }, [isAdminAuthed]);

  useEffect(() => {
    if (!isAdminAuthed) {
      initialLoadDoneRef.current = false;
      sectionDateRangesRef.current = {
        dashboard: DEFAULT_TODAY_RANGE,
        orders: DEFAULT_TODAY_RANGE
      };
      knownOrderIdsRef.current = null;
      adminAudioContextRef.current = null;
      setAdminBootReady(false);
    }
  }, [isAdminAuthed]);

  const handleUpdateOrderStatus = async (orderId, newStatus, statusClass) => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-order-status",
          orderId,
          status: newStatus,
          statusClass
        })
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        fetchAdminData({ section: "orders", playChime: false });
      }
    } catch (err) {
      console.error("Failed to update status on admin dashboard:", err);
    }
  };

  return (
    <div style={{ background: "#0A0B09", minHeight: "100vh", padding: "0" }}>
      <AdminDashboard
        activeOrders={activeOrders}
        dashboardOrders={dashboardOrders}
        stats={adminStats}
        ordersStats={ordersStats}
        logs={adminLogs}
        categories={adminCategories}
        products={adminProducts}
        addons={adminAddons}
        coupons={adminCoupons}
        customers={adminCustomers}
        payments={adminPayments}
        settings={adminSettings}
        updates={adminUpdates}
        events={adminEvents}
        upcomingItems={adminUpcomingItems}
        contacts={adminContacts}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onRefreshData={(section, dateRange) =>
          fetchAdminData({ section: section || "dashboard", playChime: false, dateRange })
        }
        isSyncing={isSyncing}
        adminBootReady={adminBootReady}
        onAuthChange={setIsAdminAuthed}
      />
    </div>
  );
}
