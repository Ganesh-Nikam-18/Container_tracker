# 📦 Container Tracker

**Container Tracker** is a comprehensive Frappe/ERPNext application designed to manage the lifecycle, tracking, operations, and compliance of gas containers, ISO tanks, and cylinders. Easily monitor container movements, manage fillings, handle reconciliation, automate penalties, and ensure safety compliance all in one centralized system.

---

## ✨ Features at a Glance

The application introduces specialized DocTypes tailored to track every aspect of container operations:

### 🏭 Master Data & Configuration
| Feature / DocType | Description |
| :--- | :--- |
| **Containers** | The core record for each cylinder or ISO tank. Tracks real-time status (Available, Filled, In Transit, With Customer), custody, capacity, residual gas, and links to Fixed Assets. |
| **Container Types** | Classifies containers (e.g., CYL vs. ISO). Sets standard properties like fill capacity, tare weight, hydro test intervals, default gases, and security deposits. |
| **Container Settings** | Global configurations for business logic. Set rules for minimum retained gas (heel) penalties, tolerance limits, auto-invoicing rules, damage/loss charges, and API tracking settings. |
| **Item Capacity Matrix** | Defines the maximum capacity of specific gas items per container type. |

### 🔄 Operations & Tracking
| Feature / DocType | Description |
| :--- | :--- |
| **Container Filling Entry** | Logs the filling of gas into containers. Links directly with customer delivery notes and automatically posts to the container ledger. |
| **Extraction Entry** | Manages the process of extracting and tracking residual gas from returned containers. |
| **Inbound Shipments** | Tracks containers arriving from suppliers. Monitors status (On Vessel, Booked, Extracting), estimated time of arrival (ETA), last known position, and ownership (Own vs. Supplier). |

### 💰 Financials & Reconciliation
| Feature / DocType | Description |
| :--- | :--- |
| **Reconciliation** | The central hub for processing returned containers. Automatically calculates damage & loss charges and heel shortfall penalties (if returned with less than required gas). |
| **Chargebacks** | Automatically generated from Reconciliation to raise penalty or loss charges against customers. |
| **Container Ledger Entry** | An immutable ledger tracking every movement, location change, and fill-level adjustment for complete auditability. |

### 🛡️ Safety & Compliance
| Feature / DocType | Description |
| :--- | :--- |
| **Hydro Test** | Tracks mandatory safety testing of cylinders. Logs the test agency, inspector, and certificate details, updating the "Test Due" dates on containers to prevent unsafe filling. |

---

## 🛠️ App Installation

To install **Container Tracker** on your Frappe bench, run the following commands from your `frappe-bench` directory:

1. **Fetch the Application:**
   ```bash
   bench get-app https://github.com/asoral/Container_tracker.git
   ```
2. **Install on your target site:**
   ```bash
   bench --site <your-site-name> install-app container_tracker
   ```
3. **Run Migrations (Optional but recommended):**
   ```bash
   bench --site <your-site-name> migrate
   ```

---

## 📚 External Libraries & Dependencies

This application is built natively on the **Frappe Framework**.

- **External Python Libraries**: None. The app utilizes `frappe` standard libraries, meaning no additional PIP installations are required.
- **ERPNext Integration**: It seamlessly links with standard ERPNext entities (e.g., `Item`, `Customer`, `Supplier`, `Asset`, `Delivery Note`, `Sales Invoice`) to provide a unified tracking experience.

---
*Built to keep your assets tracked, your customers accountable, and your operations strictly compliant.*
