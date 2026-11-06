"use client";

import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FormModalCloseButton from "../components/FormModalCloseButton";
import { Sparkles, Calendar, ArrowLeft, MapPin, CheckCircle, FileText, Send, Store } from "lucide-react";
import { parseJsonResponse } from "../lib/fetchJson";
import { isValidPhone, applyPhoneInputChange, getPhoneValidationError } from "../lib/phone";

export default function UpdatesClient() {
  const [updates, setUpdates] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCoins, setUserCoins] = useState(0);
  const [cart, setCart] = useState([]);
  const [registeredIds, setRegisteredIds] = useState([]);
  
  // Registration Form Modal state
  const [registerEvent, setRegisterEvent] = useState(null);
  const [regForm, setRegForm] = useState({ name: "", phone: "", email: "" });
  const [regSuccess, setRegSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appAlert, setAppAlert] = useState(null);
  const alert = (message) => setAppAlert({ message });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCoins = localStorage.getItem("theoh_coins");
      const storedCart = localStorage.getItem("theoh_cart");
      const storedRegs = localStorage.getItem("registered_events");
      if (storedCoins) setUserCoins(parseInt(storedCoins, 10));
      if (storedCart) setCart(JSON.parse(storedCart));
      if (storedRegs) setRegisteredIds(JSON.parse(storedRegs));
    }

    async function fetchData() {
      try {
        const res = await fetch("/api/menu");
        const data = await parseJsonResponse(res);
        if (data.success) {
          setUpdates(data.updates || []);
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error("Failed to load updates & events data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const closeRegistrationModal = () => {
    setRegisterEvent(null);
    setRegSuccess(false);
    setSubmitting(false);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerEvent) return;

    if (!isValidPhone(regForm.phone)) {
      alert(getPhoneValidationError(regForm.phone) || "Enter a valid 10-digit phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: registerEvent.id,
          name: regForm.name,
          phone: regForm.phone,
          email: regForm.email
        })
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setRegSuccess(true);
        const updatedRegs = [...registeredIds, registerEvent.id];
        setRegisteredIds(updatedRegs);
        localStorage.setItem("registered_events", JSON.stringify(updatedRegs));
        setRegForm({ name: "", phone: "", email: "" });
        setTimeout(() => {
          setRegSuccess(false);
          setRegisterEvent(null);
        }, 2500);
      } else {
        alert("Registration failed: " + data.error);
      }
    } catch (err) {
      console.error("Error submitting event registration:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ background: "var(--background-ivory)", minHeight: "100vh", color: "var(--text-charcoal)" }}>
      <Navbar 
        onCartToggle={() => {
          if (typeof window !== "undefined") {
            window.location.href = "/cart";
          }
        }} 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onDashboardToggle={() => {}}
        activeDashboard={null}
        userCoins={userCoins}
        activeSection="updates"
        setActiveSection={() => {}}
      />

      <main className="section-padding" style={{ marginTop: "80px", paddingBottom: "100px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 24px" }}>
          {/* Back button */}
          <button 
            onClick={() => { if (typeof window !== "undefined") window.location.href = "/"; }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--primary-brand)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              marginBottom: "35px",
              padding: "8px 16px",
              borderRadius: "30px",
              border: "1px solid var(--border-color)",
              backgroundColor: "rgba(15, 77, 47, 0.03)",
              transition: "var(--transition-fast)"
            }}
          >
            <ArrowLeft size={16} /> Back to THE OH !
          </button>

          {/* Page Header */}
          <div style={{ textAlign: "left", marginBottom: "40px" }}>
            <span style={{ color: "var(--accent-gold)", letterSpacing: "2px", fontWeight: "700", fontSize: "0.8rem", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>THE OH ! popup</span>
            <h1 style={{ color: "var(--primary-brand)", fontFamily: "var(--font-title)", fontSize: "2.8rem", fontWeight: "700", margin: "0" }}>Latest News &amp; Events</h1>
            <div style={{ width: "60px", height: "3px", background: "var(--accent-gold)", marginTop: "15px" }}></div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
              <div className="loading-spinner-luxury" style={{ borderTopColor: "var(--primary-brand)" }}></div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "60px" }}>
              
              {/* SECTION: BRAND ANNOUNCEMENTS */}
              <div>
                <h2 style={{ color: "var(--primary-brand)", fontFamily: "var(--font-title)", fontSize: "2rem", marginBottom: "20px" }}>Notes from the Atelier</h2>
                {updates.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 40px", color: "var(--text-gray)", background: "var(--card-bg)", borderRadius: "20px", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-soft)", maxWidth: "550px", margin: "0 auto" }}>
                    <Sparkles size={28} style={{ color: "var(--accent-gold)", marginBottom: "20px" }} />
                    <h3 style={{ fontFamily: "var(--font-title)", color: "var(--primary-brand)", fontSize: "1.4rem", marginBottom: "10px" }}>A Bespoke Reveal Awaits</h3>
                    <p style={{ margin: "0", fontSize: "0.95rem", lineHeight: "1.6" }}>We are currently perfecting our latest creations. Please return shortly to discover the next chapter of the THE OH ! narrative.</p>
                  </div>
                ) : (
                  <div className="updates-timeline" style={{ display: "flex", flexDirection: "column", gap: "35px" }}>
                    {updates.map((upd) => (
                      <div 
                        key={upd.id} 
                        style={{ 
                          background: "var(--card-bg)", 
                          border: "1px solid var(--border-color)", 
                          borderRadius: "20px", 
                          padding: "30px", 
                          boxShadow: "var(--shadow-soft)"
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "30px", alignItems: "flex-start" }}>
                          {upd.image_url && (
                            <div style={{ flex: "1 1 280px", height: "220px", overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(15, 77, 47, 0.08)" }}>
                              <img src={upd.image_url} alt={upd.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                          )}
                          <div style={{ flex: "2 1 400px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "220px" }}>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                                <span style={{ background: "rgba(15, 77, 47, 0.06)", border: "1px solid rgba(15, 77, 47, 0.15)", color: "var(--primary-brand)", fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "20px", textTransform: "uppercase" }}>{upd.tag}</span>
                                <span style={{ color: "var(--text-gray)", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Calendar size={12} style={{ color: "var(--accent-gold)" }} />
                                  {new Date(upd.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                </span>
                              </div>
                              <h2 style={{ color: "var(--primary-brand)", fontSize: "1.6rem", fontWeight: "700", marginBottom: "8px", fontFamily: "var(--font-title)", marginTop: "0" }}>{upd.title}</h2>
                              {upd.subtitle && <h3 style={{ color: "var(--accent-gold)", fontSize: "1rem", fontWeight: "600", marginBottom: "15px", marginTop: "0" }}>{upd.subtitle}</h3>}
                              <p style={{ color: "var(--text-charcoal)", fontSize: "0.95rem", lineHeight: "1.7", margin: "0", opacity: 0.9 }}>{upd.content}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: STALL EVENTS & MEETUPS */}
              <div>
                <h2 style={{ color: "var(--primary-brand)", fontFamily: "var(--font-title)", fontSize: "2rem", marginBottom: "20px" }}>Curated Experiences</h2>
                {events.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 40px", color: "var(--text-gray)", background: "var(--card-bg)", borderRadius: "20px", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-soft)", maxWidth: "550px", margin: "0 auto" }}>
                    <Store size={32} style={{ color: "var(--accent-gold)", marginBottom: "20px" }} />
                    <h3 style={{ fontFamily: "var(--font-title)", color: "var(--primary-brand)", fontSize: "1.4rem", marginBottom: "10px" }}>Future Engagements</h3>
                    <p style={{ margin: "0", fontSize: "0.95rem", lineHeight: "1.6" }}>We are currently orchestrating our next immersive pop-up. Join our inner circle to receive priority notification regarding our upcoming locations.</p>
                  </div>
                ) : (
                  <div className="events-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "30px" }}>
                {events.map((evt) => (
                  <div 
                    key={evt.id} 
                    style={{ 
                      background: "var(--card-bg)", 
                      border: "1px solid var(--border-color)", 
                      borderRadius: "20px", 
                      padding: "24px", 
                      boxShadow: "var(--shadow-soft)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      {evt.image_url && (
                        <div style={{ width: "100%", height: "180px", overflow: "hidden", borderRadius: "12px", marginBottom: "20px", border: "1px solid var(--border-color)" }}>
                          <img src={evt.image_url} alt={evt.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <span style={{ color: "var(--accent-gold)", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Calendar size={12} />
                          {new Date(evt.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <h3 style={{ color: "var(--primary-brand)", fontSize: "1.3rem", fontWeight: "700", marginBottom: "10px", fontFamily: "var(--font-title)", marginTop: "0" }}>{evt.title}</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-gray)", fontSize: "0.85rem", marginBottom: "15px" }}>
                        <MapPin size={14} style={{ color: "var(--primary-brand)" }} />
                        <span>{evt.location}</span>
                      </div>
                      <p style={{ color: "var(--text-charcoal)", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "20px", opacity: 0.9 }}>{evt.description}</p>
                    </div>

                    <div>
                      {registeredIds.includes(evt.id) ? (
                        <div style={{ 
                          textAlign: "center", 
                          padding: "12px", 
                          border: "1px solid rgba(46, 125, 50, 0.4)", 
                          borderRadius: "10px", 
                          background: "rgba(46, 125, 50, 0.1)", 
                          color: "var(--success-color)", 
                          fontSize: "14px", 
                          fontWeight: "700",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px"
                        }}>
                          <CheckCircle size={16} /> Confirmed
                        </div>
                      ) : evt.requires_registration ? (
                        <button 
                          onClick={() => setRegisterEvent(evt)}
                          style={{
                            width: "100%",
                            padding: "12px",
                            background: "var(--accent-gold)",
                            border: "none",
                            borderRadius: "10px",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            transition: "var(--transition-fast)"
                          }}
                          className="hover-gold-button"
                        >
                          <FileText size={16} /> Reserve Your Invitation
                        </button>
                      ) : (
                        <div style={{ textAlign: "center", padding: "10px", border: "1px solid rgba(46, 125, 50, 0.2)", borderRadius: "10px", background: "rgba(46, 125, 50, 0.03)", color: "var(--primary-brand)", fontSize: "13px", fontWeight: "600" }}>
                          Open Entry • All Guests Welcome
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </main>

      {/* REGISTRATION MODAL */}
      {registerEvent && (
        <div
          style={{ position: "fixed", top: "0", left: "0", right: "0", bottom: "0", background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: "10000", padding: "20px", backdropFilter: "blur(4px)" }}
          onClick={closeRegistrationModal}
        >
          <div
            style={{ background: "#fff", padding: "35px", borderRadius: "20px", width: "100%", maxWidth: "450px", border: "1px solid var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <FormModalCloseButton variant="light" onClick={closeRegistrationModal} />

            {regSuccess ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <CheckCircle size={56} style={{ color: "var(--success-color)", marginBottom: "20px" }} />
                <h3 style={{ fontFamily: "var(--font-title)", color: "var(--primary-brand)", fontSize: "1.5rem", marginBottom: "10px" }}>Invitation Confirmed</h3>
                <p style={{ color: "var(--text-gray)", fontSize: "0.95rem" }}>Your presence has been secured for <strong>{registerEvent.title}</strong>. We look forward to hosting you.</p>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: "var(--font-title)", color: "var(--primary-brand)", fontSize: "1.6rem", marginTop: "0", marginBottom: "10px", paddingRight: "36px" }}>Secure Your Attendance</h3>
                <p style={{ color: "var(--text-gray)", fontSize: "0.9rem", marginBottom: "25px", lineHeight: "1.5" }}>Kindly provide your credentials to join us for <strong>{registerEvent.title}</strong> at {registerEvent.location}.</p>
                
                <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-charcoal)" }}>Full Name</label>
                    <input 
                      type="text" 
                      required 
                      value={regForm.name} 
                      onChange={(e) => setRegForm({...regForm, name: e.target.value})} 
                      placeholder="e.g. Guest Name"
                      style={{ padding: "10px 14px", border: "1px solid var(--border-color)", borderRadius: "8px", outline: "none", fontSize: "14px" }}
                    />
                  </div>

                  <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-charcoal)" }}>Mobile Phone</label>
                    <input 
                      type="tel" 
                      required 
                      value={regForm.phone} 
                      onChange={(e) => {
                        const { value, error, overflow } = applyPhoneInputChange(e.target.value);
                        setRegForm({ ...regForm, phone: value });
                        if (overflow) alert(error);
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const { value, error, overflow } = applyPhoneInputChange(
                          e.clipboardData.getData("text")
                        );
                        setRegForm({ ...regForm, phone: value });
                        if (overflow) alert(error);
                      }}
                      placeholder="9876543210"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      style={{ padding: "10px 14px", border: "1px solid var(--border-color)", borderRadius: "8px", outline: "none", fontSize: "14px" }}
                    />
                  </div>

                  <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-charcoal)" }}>Email Address (Optional)</label>
                    <input 
                      type="email" 
                      value={regForm.email} 
                      onChange={(e) => setRegForm({...regForm, email: e.target.value})} 
                      placeholder="e.g. guest@example.com"
                      style={{ padding: "10px 14px", border: "1px solid var(--border-color)", borderRadius: "8px", outline: "none", fontSize: "14px" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                    <button 
                      type="button" 
                      onClick={closeRegistrationModal}
                      style={{ flex: 1, padding: "12px", background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "8px", color: "var(--text-charcoal)", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={submitting}
                      style={{ flex: 2, padding: "12px", background: "var(--primary-brand)", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                      {submitting ? "Reserving..." : <><Send size={14} /> Confirm Registration</>}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {appAlert && (
        <div className="modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-content glass-effect" style={{ maxWidth: '400px', width: '90%', padding: '25px', borderRadius: '16px', border: '1px solid rgba(15, 30, 20, 0.1)', textAlign: 'center', background: 'rgba(15,30,20,0.95)' }}>
            <h3 style={{ color: '#fff', marginBottom: '15px', fontFamily: 'var(--font-title)' }}>Notification</h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', marginBottom: '25px', lineHeight: '1.5' }}>
              {appAlert.message}
            </p>
            <button 
              onClick={() => {
                const cb = appAlert.onOk;
                setAppAlert(null);
                if (cb) cb();
              }} 
              className="btn-primary"
              style={{ padding: '8px 25px', borderRadius: '8px', border: 'none', background: 'var(--accent-gold)', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <Footer onDashboardToggle={() => {}} setActiveSection={() => {}} />
    </div>
  );
}
