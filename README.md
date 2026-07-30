# 💖 CashApp — Nền Tảng Quản Lý Tài Chính & Chia Tiền Thông Minh Cho Cặp Đôi

![CashApp Banner](https://img.shields.io/badge/Status-Production--Ready-brightgreen?style=for-the-badge)
![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql)
![WebSockets](https://img.shields.io/badge/Real--Time-WebSockets-FF6600?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Enabled-000000?style=for-the-badge&logo=pwa)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions)

> **CashApp** là ứng dụng web quản lý tài chính tập trung dành riêng cho các cặp đôi. Với giao diện Glassmorphism Dark Mode sang trọng, trải nghiệm PWA mượt mà, và backend RESTful API kết hợp WebSockets thời gian thực, CashApp giải quyết triệt để bài toán chia tiền minh bạch, cấn trừ công nợ tự động và kiểm soát hạn mức ngân sách gia đình.

---

## 🌟 Tính Năng Nổi Bật (Core Features)

### 1. 🔐 Đăng Nhập & Không Gian Chung (Pairing Space)
- Xác thực người dùng qua Email/Social (Google, Apple) với JWT Token & HttpOnly Cookies.
- Tạo **Không gian chung (Shared Space)** với mã mời ngẫu nhiên (`Invite Code`) để người kia tham gia.

### 2. 💸 Ghi Chép Giao Dịch & Chia Tiền Linh Hoạt (Split Engines)
- Hỗ trợ 3 cơ chế chia tiền thông minh:
  - **Chia đều (50/50)**: Tự động chia đôi số tiền.
  - **Chia theo tỷ lệ %**: Tùy chỉnh tỷ lệ (ví dụ: 70/30, 60/40).
  - **Chia theo số tiền cụ thể**: Nhập chính xác số tiền từng người gánh chịu.
- **Server Validation**: Backend tự động re-validate xem tổng số tiền chia có bằng 100% số tiền gốc hay không.

### 3. ⚖️ Cấn Trừ & Thanh Toán Tự Động (Settle Up & Debt Balancing)
- Tự động tính toán số dư ròng (**Net Balance**) giữa 2 người dùng.
- Thao tác **Settle Up** 1-Click để triệt tiêu công nợ hoàn toàn.

### 4. 📊 Phân Tích & Hạn Mức Ngân Sách (Analytics & Budgets)
- Biểu đồ tròn (Pie Chart) phân tích tỷ trọng chi tiêu theo danh mục.
- Biểu đồ cột (Bar Chart) theo dõi xu hướng chi tiêu 3/6/12 tháng.
- Đặt hạn mức ngân sách tháng với Progress Bar cảnh báo thông minh (*Vượt mức / Sắp đạt giới hạn*).

### 5. ⚡ Real-Time WebSockets Synchronization
- Tự động phát thông báo **Toast Notification** tức thì tới máy đối phương ngay khi phát sinh giao dịch mới mà không cần reload trang.

### 6. 📱 Progressive Web App (PWA Mobile Native Experience)
- Hỗ trợ **"Add to Home Screen"** trên iOS và Android.
- Đóng gói Offline Service Worker và App Manifest chuẩn chỉ.

---

## 🏗️ Kiến Trúc Hệ Thống (Architecture Stack)

| Tầng | Công Nghệ Sử Dụng |
| :--- | :--- |
| **Frontend** | React 18 / 19, Vite, Vanilla CSS Design System, Lucide Icons, Chart.js, jsPDF, VitePWA |
| **Backend** | Node.js, Express.js, WebSockets (`ws`), Express Rate Limit, Cookie Parser |
| **Database** | PostgreSQL (ACID Compliant, Triggers, Foreign Keys, JSONB Audit Logs) |
| **Testing** | Vitest, Supertest (Unit Tests & REST API Integration Tests) |
| **DevOps & CI/CD** | GitHub Actions Workflow, Vercel (`vercel.json`), Render (`render.yaml`) |

---

## 🛠️ Hướng Dẫn Cài Đặt & Vận Hành (Getting Started)

### 1. Yêu cầu môi trường
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. Cài đặt Dependencies
```bash
git clone https://github.com/YOUR_USERNAME/cashapp.git
cd cashapp
npm install
```

### 3. Chạy môi trường Development

#### Khởi chạy Backend Server (HTTP REST + WebSockets on port 5000):
```bash
npm run server
```

#### Khởi chạy Frontend Vite Dev Server (on http://localhost:5173):
```bash
npm run dev
```

---

## 🧪 Kiểm Thử & Quality Assurance (QA)

Chạy bộ kiểm thử tự động (Unit Tests & API Integration Tests):
```bash
npm test
```

Build đóng gói ứng dụng PWA Production:
```bash
npm run build
```

---

## 📁 Cấu Trúc Thư Mục Project

```
cashapp/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions CI/CD Pipeline
├── database/
│   └── schema.sql             # PostgreSQL Schema Definition
├── server/
│   ├── __tests__/             # API Integration Tests (Supertest)
│   ├── db.js                  # Server Database Engine
│   └── server.js              # Express REST & WebSocket Server
├── src/
│   ├── components/            # Reusable Visual Components
│   ├── context/               # Global App Context & State
│   ├── pages/                 # Main Module Screens
│   ├── services/              # API Client SDK & WebSocket Client
│   └── utils/                 # Financial Calculations & Helpers
├── public/                    # PWA Icons & Manifest
├── render.yaml                # Render Infrastructure Config
├── vercel.json                # Vercel Frontend Deploy Config
└── vite.config.js             # Vite & PWA Build Setup
```

---

## 📝 Giấy Phép (License)

Dự án phát triển dưới giấy phép MIT License. Cặp đôi của bạn xứng đáng có một công cụ tài chính đẳng cấp! 💖
