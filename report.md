# PUP Souvenir Shop Ledger — Project Report

## 1. General About the Ledger

The **PUP Souvenir Shop Ledger** is an offline-capable Point of Sale (POS), inventory, and bookkeeping web application built for the Polytechnic University of the Philippines (PUP) Souvenir Shop.

- **Purpose:** Helps shop staff ring up customer orders, track product stock levels, record restocks and daily expenses, and monitor cash flow and profit in Philippine Pesos (`₱`).
- **Offline & Local-First:** Built as a Progressive Web App (PWA) with a service worker ([sw.js](file:///Users/niesseteves/nPal/ledger/sw.js)) and browser `localStorage`. It works without an internet connection on tablets, phones, and computers.
- **Multi-Device Portable:** Because data is stored on the device, the app includes a built-in JSON backup, restore, and smart combine (merge) system so data can be moved or combined across devices.

---

## 2. Functions: Tabs & Buttons Explained Simply

The navigation bar at the top switches between **6 main tabs**:

### 🛍️ Tab 1: Sell (Point of Sale)

Used for everyday customer checkouts. Displays a banner with shop info and a rotating product photo carousel, a product catalog, and the current order cart.

- **Search bar (`🔍 Search products...`):** Filters products by name as you type.
- **Category chips (`All`, `Tops`, `Bottoms`, `Accessories`, `Bags`, `Photos/Illustrations`, `Stuffed Toys`, `Tableware`, `Stationaries`):** Filters the product grid to show only items in the selected category.
- **`+` (on a product card):** Adds 1 unit of that product to the current order (disabled when out of stock).
- **`−` / `+` (inside Current order):** Decreases or increases the quantity of an item in the cart.
- **`Customer / note (optional)` field:** Lets you attach a buyer's name or short note to the order.
- **`Clear` button:** Empties the current cart without recording a sale.
- **`Checkout` button:** Completes the sale, deducts the sold quantities from stock, and records the sale in the Ledger.
- **`🛒` Floating Cart button (on smaller screens):** Opens or closes the cart drawer and shows the item count and total price.

---

### 📊 Tab 2: Dashboard

Gives an instant summary of the shop's finances and inventory health.

- **Top summary cards:** Shows current **Cash balance** and total **Stock value (at cost)**.
- **Today / This month / This year sections:** Displays cards for **Sales**, **Cost of products sold**, **Other expenses**, **Net profit**, and **Restock spending**, alongside visual breakdowns and top-selling products.
- **Stocks section:** Shows a color-coded bar of **In stock**, **Low stock**, and **No stock** items, and lists products that need restocking.
- _(No action buttons on this tab — everything updates automatically as you record transactions.)_

---

### 📦 Tab 3: Items (Items & Inventory)

Used to add new merchandise, update prices/costs, manage product photos, and adjust stock levels.

- **`📷 Take photo` button:** Opens the device camera to snap a product photo (automatically resized to save storage).
- **`🖼 Choose photo` button:** Picks an existing image from the device gallery for the product.
- **`Remove photo` button:** Removes the product's custom photo and resets it to the default placeholder image.
- **Item form fields (`Name`, `Category`, `Selling price`, `Cost`, `Opening stock / Stock on hand`, `Low-stock alert at`):** Details for the product being added or edited.
- **`Save item` button:** Saves a new product or updates the product currently being edited.
- **`Clear` button:** Resets the form and cancels editing.
- **`Search items...` bar:** Filters the item list below by product name or category.
- **`Edit` button (on each item row):** Loads that product's details into the form at the top so you can update its price, cost, photo, or stock count.
- **`Del` button (on each item row):** Deletes the product from the catalog after confirmation (past ledger entries are kept).

---

### 📝 Tab 4: Record (Record Other Entries)

Used for non-POS transactions such as restocking inventory, paying shop expenses, recording miscellaneous income, or logging manual sales.

- **`Type` dropdown:** Chooses between:
  - _Restock (expense, stock in)_ — adds stock to an item and records the cost.
  - _Other expense_ — records general expenses (e.g., supplies, utilities).
  - _Other income_ — records non-product income.
  - _Manual sale (income, stock out)_ — logs a single-item sale with a custom date or amount.
- **`Item` & `Quantity` fields:** Shown when recording a Restock or Manual sale; automatically calculates the default peso amount from the item's cost or selling price.
- **`Amount (₱)`, `Date`, and `Note` fields:** Sets the peso value, transaction date, and optional supplier/reason note.
- **`Save entry` button:** Records the transaction into the ledger and updates stock if applicable.

---

### 📖 Tab 5: Ledger

Shows the complete chronological history of all money coming in (`In`), money going out (`Out`), and the running cash `Balance`.

- **`From` and `To` date pickers:** Filters the table to show only transactions within a specific date range.
- **`Type` dropdown:** Filters the table by transaction type (`All`, `sale`, `restock`, `expense`, `income`).
- **`Void` button (on each active row):** Cancels a mistaken entry. The row stays visible but struck through (`line-through`) for audit purposes, its cash effect becomes zero, and any stock change from that sale or restock is reversed.
- **`Export CSV` button:** Downloads the currently filtered ledger view as a `.csv` spreadsheet file that can be opened in Excel or Google Sheets.

---

### ⚙️ Tab 6: Settings

Manages backups, device syncing, shop identity, logo, and opening cash balance.

- **`i` (Info) buttons:** Tap any circular `i` button to show or hide a plain-language explanation of that setting.
- **`Download backup (.json)` button:** Saves a complete copy of all products, transactions, shop details, and logo as a `.json` file on your device.
- **`Load backup from another device` button:** Opens a file picker to load a `.json` backup file and previews what will happen before changing anything.
  - **`Combine with this device` button:** Merges the backup file with the current device's data (adds new products and transactions, skips duplicates, and adjusts stock for new entries only).
  - **`Replace this device's data` button:** Overwrites the current device's data completely with the loaded backup file.
  - **`Cancel` button:** Closes the import preview without making changes.
- **`Restore` button (inside Backup history):** Reverts the device back to an automatic safety copy (saved automatically before any Combine, Replace, or Erase).
- **Shop details fields (`Branch name`, `Address`, `Contact person / number`, `Notes`):** Saves automatically as you type. The branch name is displayed in the top header, and address/contact details appear on the Sell banner.
- **`Change logo` button:** Uploads a custom shop logo image.
- **`Use default logo` button:** Resets the shop logo back to the default PUP logo.
- **`Opening cash balance (₱)` field:** Sets the starting cash on hand before any recorded transactions.
- **`Erase all data` button:** Wipes all products, transactions, and settings on the device after double confirmation (saves a safety copy in Backup history first).

---

## 3. Current Progress and Future Updates

### Current Progress

- **Core POS & Inventory Workflow:** Complete product catalog with categories, resized photo uploads, low-stock alerts, and cart checkout.
- **Audit-Safe Bookkeeping:** Full transaction ledger with date/type filters, running cash balance, CSV export, and non-destructive voiding (struck-out audit trail with automatic stock reversal and negative-stock warnings).
- **Accurate Profit Tracking:** Tracks unit cost per sale to separate **Cost of products sold (COGS)**, **Other expenses**, **Net profit**, and **Restock spending**.
- **Data Safety & Multi-Device Sync:** JSON backup export, smart **Combine** (merge) and **Replace** restore modes, input sanitization (`migrate()`), storage-full alerts, and local **Backup history** with automatic safety snapshots.
- **Offline Support:** Works offline via Service Worker caching and local storage.

### Future Updates

- **UI — Using Stitch:**
  - Redesign and polish the user interface using **Stitch** to create a cleaner, more modern, and cohesive visual layout across mobile and tablet screens.
  - Improve spacing, typography, component consistency, and touch ergonomics for faster cashier operation.
- **Graphs — Dashboard Tab:**
  - Enhance the **Dashboard** tab with richer, interactive visual graphs and charts to make sales trends, daily/monthly income vs. expenses, profit margins, and top-performing product categories easier to analyze at a glance.
