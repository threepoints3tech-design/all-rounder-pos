# General POS

Simple, general-purpose Point of Sale system. Works for any shop — clothing,
bakery, pharmacy, grocery, and more. All data is stored in your browser
(`localStorage`) so it runs fully locally with no backend.

## Features

- Product grid with categories & search
- Cart with quantity controls, subtotal, tax, total
- Checkout saves order to sales history
- Manage products (add / delete)
- Settings: shop name, currency, tax rate
- Sales history page

## Run locally

Requirements: [Bun](https://bun.sh) (or Node 20+ with npm).

```bash
bun install
bun run dev
```

Open http://localhost:8080

### With npm

```bash
npm install
npm run dev
```

## Build for production

```bash
bun run build
bun run start
```

## Tech

TanStack Start (React 19) + Vite 7 + Tailwind v4 + localStorage.
