# 🚀 Records Management System

A high-performance Angular 19 + Node.js + Express + SQLite application demonstrating modern frontend architecture, scalable backend APIs, virtual scrolling, client-side caching, and Web Worker-based data processing.

**How would you handle 1000+ records in a dropdown?**

I would avoid rendering all records in the UI. I would use an autocomplete/typeahead component with backend filtering and pagination. On the Angular side I would use debounceTime, OnPush change detection, trackBy, caching, and CDK Virtual Scroll if a large list must be displayed. This reduces DOM rendering, memory usage, network traffic, and change detection overhead, keeping the UI responsive even with tens of thousands of records.

This is the approach typically used in large Angular enterprise applications handling 10K–100K+ records.

## 📖 Overview

The Records Management System is designed to efficiently display and manage millions of records while maintaining excellent UI responsiveness.

The project demonstrates enterprise-grade frontend engineering techniques including:
+ Angular Standalone Components
+ Angular Signals
+ OnPush Change Detection
+ CDK Virtual Scrolling
+ Web Workers
+ RxJS Reactive Data Flow
+ Client-side Page Caching
+ Server-side Pagination
+ SQLite Database
+ RESTful APIs
+ Docker Support


## Run Application
**1. Option 1**

Start
```
docker compose -f docker/docker-compose.dev.yml up
```
or
```
docker compose -f docker/docker-compose.dev.yml up --build
```
Angular runs with
```
ng serve
```
Node runs with
```
ts-node-dev
```
Both support hot reload.

After modifying Angular code, No Docker command required. Simply save the file. Angular automatically recompiles. Browser refreshes.

After modifying Backend, No Docker command required.
```
Save

↓

run ts-node-dev

↓

Restart

↓
```
API updated

When do you rebuild?

Only if you change:
- Dockerfile
- package.json
- package-lock.json
- docker-compose.yml
- Node version
- Angular version

Run:

docker compose -f docker/docker-compose.dev.yml up --build

**2. Option 2**

Terminal 1 : Start Backend
```
cd backend
npm install
npm run dev
```
Output
```
Server started on port 3000
```

Terminal 2 : Start Angular
```
cd frontend
npm install
npm start
```

Angular
```
http://localhost:4200
```
Backend
```
http://localhost:3000
```

## Production Workflow

**Build images**
```
docker compose \
-f docker/docker-compose.prod.yml \
build
```

**Start**
```
docker compose \
-f docker/docker-compose.prod.yml \
up -d
Code changes in Production
```

**If Angular changes**
```
docker compose \
-f docker/docker-compose.prod.yml \
build angular-app
```

**Restart**
```
docker compose \
-f docker/docker-compose.prod.yml \
up -d angular-app
```

**Backend only**
```
docker compose \
-f docker/docker-compose.prod.yml \
build node-api

docker compose \
-f docker/docker-compose.prod.yml \
up -d node-api
```
No need to rebuild Redis.

**If package.json changes**
```
docker compose down

docker compose build --no-cache

docker compose up -d
```

## ✨ Features

### Frontend

* Angular 20 Standalone Components
* Angular Signals
* OnPush Change Detection
* CDK Virtual Scrolling
* Client-side page cache
* Web Worker based sorting
* Server-side pagination
* Reactive Forms
* RxJS operators
* Responsive UI
* Accessible components (WCAG-friendly)
* Loading indicators
* Error handling
* Retry mechanism

---

### Backend

* Express.js REST API
* SQLite database
* CRUD operations
* Pagination
* Filtering
* Sorting
* Health endpoint
* CORS support
* TypeScript

---

## ⚡ Performance Optimizations

| Feature                 | Benefit                            |
| ----------------------- | ---------------------------------- |
| Angular Signals         | Fine-grained UI updates            |
| OnPush Change Detection | Minimal component re-rendering     |
| Virtual Scroll          | Render only visible rows           |
| TrackBy                 | Prevent unnecessary DOM recreation |
| Web Worker              | Offload CPU-intensive sorting      |
| Page Cache              | Reduce API calls                   |
| Server-side Pagination  | Load only required records         |
| RxJS switchMap          | Cancel stale requests              |

---

## 🛠 Technology Stack

### Frontend

* Angular 20
* TypeScript
* RxJS
* Angular CDK
* Angular Signals
* SCSS

### Backend

* Node.js
* Express
* SQLite
* TypeScript

---

## 🚀 Getting Started

### Clone Repository

```bash
git clone <repository-url>

cd records-management
```

---

## Backend Setup

```bash
cd backend

npm install

npm run dev
```

Backend starts at

```text
http://localhost:3000
```

Health Check

```text
GET http://localhost:3000/health
```

---

## Frontend Setup

```bash
cd frontend

npm install

ng serve
```

Frontend

```text
http://localhost:4200
```

---

## Environment Configuration

```typescript
export const environment = {
    production: false,
    apiBaseUrl: 'http://localhost:3000/api'
};
```

---

## API Endpoints

### Get Records

```http
GET /api/records
```

Example

```http
GET /api/records?page=0&pageSize=50&sortField=name&sortDir=asc
```

---

### Update Record

```http
PUT /api/records/:id
```

---

### Delete Record

```http
DELETE /api/records/:id
```

---

### Health

```http
GET /health
```

---

## Pagination

Supports

* Page Number
* Page Size
* Sorting
* Search
* Filtering

Example

```http
/api/records?page=1&pageSize=100
```

---

## Filtering

Supports

* Search
* Category
* Status
* Amount Range
* Date Range

---

## Sorting

Supports

* Name
* Category
* Status
* Amount
* Created Date

Ascending and Descending.

---

## Client-side Cache

Pages already fetched are cached to avoid unnecessary network requests.

Benefits

* Faster page navigation
* Reduced API traffic
* Better user experience

---

## Virtual Scrolling

Angular CDK Virtual Scroll renders only the visible rows.

Instead of rendering:

```text
5,000,000 DOM elements
```

the application renders approximately:

```text
15–20 DOM elements
```

resulting in significantly improved rendering performance.

---

## Web Worker

Sorting and filtering can be delegated to a dedicated Web Worker.

Benefits

* Main UI thread remains responsive
* No UI freezing
* Better perceived performance

---

## Accessibility

The application follows modern accessibility principles:

* Keyboard navigation
* Semantic HTML
* ARIA labels
* Screen reader friendly
* High contrast compatible

---