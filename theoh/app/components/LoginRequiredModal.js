"use client";

import { X } from "lucide-react";
import UserAuthPanel from "./UserAuthPanel";

export default function LoginRequiredModal({ isOpen, onClose, onAuthenticated, message }) {
  if (!isOpen) return null;

  return (
    <div className="login-required-overlay" onClick={onClose}>
      <div className="login-required-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="login-required-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        {message && <p className="login-required-message">{message}</p>}
        <UserAuthPanel
          variant="modal"
          onAuthenticated={(user, options) => {
            // Do not call onClose here — parent closes the modal and must keep
            // any pending cart action until profile setup finishes.
            onAuthenticated?.(user, options);
          }}
        />
      </div>

      <style jsx>{`
        .login-required-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 11, 9, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 10000;
          box-sizing: border-box;
        }

        .login-required-panel {
          position: relative;
          width: 100%;
          max-width: 980px;
          overflow: visible;
          border-radius: 20px;
          background: #fff;
          box-sizing: border-box;
        }

        .login-required-close {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 2;
          border: none;
          background: rgba(0, 0, 0, 0.06);
          border-radius: 999px;
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .login-required-message {
          margin: 0;
          padding: 16px 20px 0;
          font-size: 14px;
          color: #444;
          text-align: center;
        }

        @media (max-width: 768px) {
          .login-required-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .login-required-panel {
            max-width: 100%;
            border-radius: 16px 16px 0 0;
          }

          .login-required-message {
            padding: 12px 14px 0;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
