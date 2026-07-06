# NomadLogs: Travel Community Platform

**This README.md is an AI-generated placeholder based on the concept documentation of the project.**

**As the application is currently in development, it is subject to conceptual updates.**

A decentralized, full-stack travel community platform designed for the entire lifecycle of an adventure—from "Before" (planning) to "During" and "After" . This ecosystem prioritizes connectivity resilience through PWA features and global reach through AI-assisted content translation.

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](<[https://reactjs.org/](https://reactjs.org/)>)
[![React Router](https://img.shields.io/badge/React_Router-v7-CA4245?style=flat-square&logo=react-router)](https://reactrouter.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![tRPC](https://img.shields.io/badge/tRPC-TypeSafe-2596be?style=flat-square&logo=trpc)](https://trpc.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)

## 📋 Table of Contents

- [✨ Features](#-features)
- [🛠 Technology Stack](#-technology-stack)
- [🧠 Architectural Deep-Dive](#-architectural-deep-dive)
- [🎮 Application Views](#-application-views)
- [⚙️ API Architecture (tRPC)](#️-api-architecture-trpc)

---

## ✨ Features

### 🕹️ Journey Documentation

- **Markdown Storytelling:** High-fidelity journal entries with dynamic text and media integration.
- **Interactive Mapping:** Pinning locations and tracking paths via Mapbox/MapLibre GL JS.
- **AI Writing Helper:** Intelligent writing assistance and automatic location extraction from narratives.

### 📶 Connectivity Resilience

- **Offline Drafting:** Local-first drafting using **IndexedDB** to prevent data loss in remote areas.
- **Background Sync:** Service workers automatically push local drafts to the server once connection is restored.
- **Map Caching:** Offline map functionality via pre-fetched vector tiles and a "Stale-While-Revalidate" strategy.

### 🌍 Global Engagement

- **AI Summary Translation:** One-click translation of post summaries into multiple languages (English, Spanish, Japanese) via `ai.translateSummary`.
- **Itinerary Planning:** A "Before" phase module for day-by-day scheduling and collaborative coordination.
- **One-Click Conversion:** Seamlessly transform planned itineraries into completed Journal entries with pre-filled maps and notes.

### 📊 Creator Studio

- **Engagement Analytics:** Real-time KPI tracking including Views, Likes, Shares, and Scroll Depth.
- **Admin Feedback Loop:** Real-time policy feedback delivered via **Socket.IO** directly to the dashboard.

---

## 🛠 Technology Stack

| Layer                     | Technology            | Implementation Detail                         |
| :------------------------ | :-------------------- | :-------------------------------------------- |
| **Architectural Pattern** | Decoupled Monorepo    | SPA + SSR for high performance                |
| **Frontend**              | React.js (v7)         | Fluid, responsive UI                          |
| **Backend**               | Node.js + Express.js  | Powered by tRPC for end-to-end type safety    |
| **Primary Database**      | PostgreSQL            | Relational storage for community data         |
| **Cache Layer**           | Redis                 | High-speed caching for analytics and search   |
| **Offline Engine**        | IndexedDB & Workbox 4 | Persistent local storage for drafts and plans |
| **Real-time Stream**      | Socket.IO             | Admin-to-creator instant feedback             |

---

## 🧠 Architectural Deep-Dive

### Offline-First Logic

NomadLogs addresses the "lie-fi" challenge by treating network connectivity as a luxury rather than a requirement.

- **Static Content:** Service workers proxy requests using a **Cache-First** strategy.
- **Dynamic Content:** Analytics and profiles use **Network-First** with a local cache fallback.
- **Data Integrity:** Employs a **Last-Write-Wins** strategy combined with IndexedDB version counters to handle offline edit conflicts.

### AI Language Integration

To dismantle global communication barriers, the AI translation workflow is **schema-aware**. It targets the summary fields while preserving markdown metadata, ensuring content remains discoverable in the user's preferred language on the "Explore" view.

### Performance Optimization

- **tRPC:** Minimizes the data footprint of API calls through a type-safe interface.
- **Redis Aggregation:** The Analytics Dashboard avoids heavy PostgreSQL queries by retrieving pre-aggregated metrics from Redis, which are updated asynchronously.

---

## 🎮 Application Views

| View                  | URI             | Functionality                                              |
| :-------------------- | :-------------- | :--------------------------------------------------------- |
| **Home**              | `/`             | Featured map searches and trending journals.               |
| **Explore**           | `/explore`      | Categorized browsing by tags, interests, or language.      |
| **Journal Detail**    | `/journals/:id` | Full travel path, media, and comments (Offline Supported). |
| **Creator Studio**    | `/studio`       | Personal analytics dashboard and content management.       |
| **Itinerary Planner** | `/plan/:id`     | "Plan mode" with map pinning and day-by-day organization.  |
| **Content Editor**    | `/studio/:id`   | Markdown editor with AI translation and writing tools.     |

---

## ⚙️ API Architecture (tRPC)

The backend is organized into type-safe namespaces to handle specific business logic:

- **`plan.*`**: Manages day-by-day scheduling, itinerary persistence, and pin data.
- **`post.*`**: Handles blog post CRUD and triggers the `syncOffline` procedure for IndexedDB reconciliation.
- **`ai.*`**: Interfaces with NLP engines for `extract` (location) and `translateSummary` procedures.
- **`analytics.*`**: Fetches engagement data and trends via Redis.
- **`map.*`**: Retrieves location pins and the `getOfflineManifest` for PWA caching.

---

> **Note:** NomadLogs is designed as a leadership-class tool for social travel documentation, reducing the friction between experiencing a journey and sharing it with the world.
