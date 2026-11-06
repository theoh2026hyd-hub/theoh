"use client";

import { MapPin } from "lucide-react";
import {
  CONTACT_EMAIL,
  CONTACT_LOCATION,
  CONTACT_LOCATION_MAP_LINK
} from "../lib/contactInfo";
import {
  ContactPhoneIconLink,
  ContactInstagramIconLink,
  ContactEmailIconLink
} from "./ContactIconLinks";
import BrandName from "./BrandName";
import { BRAND_NAME } from "../lib/brand";

export default function Footer({ onDashboardToggle, setActiveSection, onSectionNavigate }) {
  const handleLinkClick = (id) => {
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      const target = id === "home" ? "/" : `/?section=${id}`;
      window.location.assign(target);
      return;
    }

    if (onSectionNavigate) {
      onSectionNavigate(id);
      return;
    }

    if (onDashboardToggle) onDashboardToggle(null);
    if (setActiveSection) setActiveSection(id);

    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <footer className="footer-wrapper">
      <div className="footer-container">
        
        {/* Brand Description Column */}
        <div className="footer-column brand-column">
          <div className="footer-logo" onClick={() => handleLinkClick("home")}>
            <BrandName inline={false} showTelugu />
          </div>
          <p className="brand-desc">
            {BRAND_NAME} crafts signature Premium Oat Bowls from the finest ingredients, thoughtfully prepared, nutritious, and delivered fresh to your door.
          </p>
        </div>


        {/* Quick Links Column */}
        <div className="footer-column">
          <h4 className="footer-heading">Explore</h4>
          <ul className="footer-links">
            <li><button onClick={() => handleLinkClick("menu")} className="footer-btn">Menu</button></li>
            <li><button onClick={() => { if (typeof window !== "undefined") window.location.href = "/why-us"; }} className="footer-btn">Why <BrandName className="brand-name-inline--nav" /></button></li>
            <li><button onClick={() => handleLinkClick("about")} className="footer-btn">Our Craft</button></li>
          </ul>
        </div>

        {/* Support Links Column */}
        <div className="footer-column">
          <h4 className="footer-heading">Our Experience</h4>
          <ul className="footer-links">
            <li><button onClick={() => handleLinkClick("contact")} className="footer-btn">Contact Us</button></li>
            <li><button onClick={() => { if (typeof window !== "undefined") window.location.href = "/delivery-map"; }} className="footer-btn">Delivery Coverage</button></li>
            <li><button type="button" onClick={() => { if (typeof window !== "undefined") window.location.href = "/terms"; }} className="footer-btn">Terms of Service</button></li>
          </ul>
        </div>

        {/* Contact Column */}
        <div className="footer-column footer-contact-column">
          <h4 className="footer-heading">Contact</h4>
          <ul className="footer-contact-list">
            <li className="footer-contact-icons">
              <ContactPhoneIconLink className="footer-contact-phone-link" size={18} />
              <ContactInstagramIconLink className="footer-contact-social-link" size={18} />
              <ContactEmailIconLink
                email={CONTACT_EMAIL}
                className="footer-contact-social-link"
                size={18}
              />
            </li>
            <li>
              <a
                href={CONTACT_LOCATION_MAP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-contact-link footer-contact-location"
                title={`View ${CONTACT_LOCATION} on Google Maps`}
                aria-label={`Open ${CONTACT_LOCATION} in Google Maps`}
              >
                <MapPin size={16} aria-hidden="true" />
                <span>{CONTACT_LOCATION}</span>
              </a>
            </li>
          </ul>
        </div>

      </div>

      <div className="footer-divider"></div>

      <div className="footer-bottom">
        <div className="copyright">
          © {new Date().getFullYear()} THE OH !. All rights reserved.
        </div>
        <div className="footer-powered-by">
          Powered by{" "}
          <a
            href="https://thecraftlance.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="powered-by-link"
          >
            TheCraftlance
          </a>
        </div>
      </div>
    </footer>
  );
}
