# Phola — South Africa's AI Travel Watchdog & GBV Safety Companion

[![Build Status](https://img.shields.io/badge/Build-Passing-emerald)](https://github.com/jackyphuti/Phola)
[![Framework](https://img.shields.io/badge/Next.js-16.2.6-black)](https://nextjs.org/)
[![Mobile Runtime](https://img.shields.io/badge/Capacitor-Android%20%7C%20iOS-3880ff)](https://capacitorjs.com/)
[![Security](https://img.shields.io/badge/Crypto-Zero--Knowledge%20AES--GCM-teal)](https://github.com/jackyphuti/Phola)
[![Languages](https://img.shields.io/badge/Languages-11%20Official%20SA-gold)](https://github.com/jackyphuti/Phola)

> **Built by @Jacky Mpoka**  
> **Official Git Repository:** [https://github.com/jackyphuti/Phola](https://github.com/jackyphuti/Phola)  
> **Production Web App:** [https://phola-beta.vercel.app](https://phola-beta.vercel.app)  
> **Android Build (APK):** [`phola-debug.apk`](./phola-debug.apk) (3.64 MB)  
> **Judge Submission Package:** [PHOLA_SUBMISSION_PACK.md](./PHOLA_SUBMISSION_PACK.md)

---

## 🌟 What is Phola?

**Phola** is a real-time travel safety companion and gender-based violence (GBV) prevention platform built specifically for the South African context. It protects commuters taking e-hailing (Uber/Bolt) and minibus taxis after dark, detects route anomalies, provides native in-app turn-by-turn navigation to the nearest SAPS police stations and trauma clinics, and preserves court-admissible encrypted evidence.

### 🛡️ Core Capabilities

1. **Autonomous SafeRide Watchdog**
   - Live GPS tracking with route anomaly detection.
   - Automated safety check-ins with automatic emergency contact dispatch if unresponsive.
2. **Native In-App GPS Navigation (No External Maps Required)**
   - 1-tap navigation directly inside Phola to the nearest SAPS police station or trauma clinic.
   - High-contrast route line with live turn-by-turn instruction banners and resilient multi-tier routing (Mapbox + OSRM + Straight-line fallback).
3. **1-Tap Emergency Panic (SOS)**
   - Instant dispatch to SAPS 10111, Nationwide Emergency 112, and the National GBV Command Centre (0800 428 428).
   - Silent emergency broadcast transmitting precise live GPS telemetry to personal emergency contacts.
4. **Zero-Knowledge Evidence Vault & Stealth Quick-Exit**
   - Client-side AES-GCM encrypted notes, photos, and audio evidence that survive phone confiscation.
   - Instant **Quick Exit** button that disguises the app as a standard weather forecast in milliseconds.
5. **Biometric Security & POPIA Compliance**
   - Native Apple Face ID (iOS) and Fingerprint Sensor (Android) with salted SHA-256 PIN fallback.
   - Granular consent management and 1-tap complete data deletion under South Africa's Protection of Personal Information Act (POPIA).
6. **11 Official South African Languages**
   - English, isiZulu, isiXhosa, Afrikaans, Sepedi, Setswana, Sesotho, Xitsonga, siSwati, Tshivenda, and isiNdebele.

---

## 📑 Hackathon / Competition Submission Documents

For judges and assessors, all required materials are consolidated in [**`PHOLA_SUBMISSION_PACK.md`**](./PHOLA_SUBMISSION_PACK.md):

- ✅ **Lean Business Canvas:** 9-box complete business model for consumer safety, campus partnerships, and enterprise duty-of-care.
- ✅ **Secure SDLC (SSDLC):** Full security lifecycle covering STRIDE threat modeling, Zero-Knowledge client crypto, and POPIA compliance.
- ✅ **11-Slide Presentation Deck:** Content structured and ready for PDF export.
- ✅ **App Build File (APK):** Pre-compiled `phola-debug.apk` in the repository root.
- ✅ **80-Second Demo Video Script:** Second-by-second storyboard and voiceover script under 90 seconds.
- ✅ **Judge Demo Account:** `demo@phola.co.za` / `Phola2026!Safe`.

---

## 🚀 Quick Start & Local Development

### Prerequisites
- Node.js 18+ & pnpm
- Java 17 & Android SDK (for mobile builds)

### Installation
```bash
# Clone the repository
git clone https://github.com/jackyphuti/Phola.git
cd Phola

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

### Production Build & APK Generation
```bash
# Production Next.js web build
pnpm run build

# Build native Android APK
pnpm run build:apk
```
The compiled APK will be output to `./phola-debug.apk`.

---

## 🔒 Security & Privacy Notice
Phola never tracks user location in the background without explicit user activation. All personal data handling complies strictly with the South African **Protection of Personal Information Act (POPIA No. 4 of 2013)**.
