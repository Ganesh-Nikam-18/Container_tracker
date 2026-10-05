// Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Container Movements", {
	setup(frm) {
		frm.set_query("party_type", function () {
			return {
				filters: {
					name: ["in", ["Customer", "Supplier", "Company", "Employee"]]
				}
			};
		});
	},

	refresh(frm) {
		frm.set_query("party_type", function () {
			return {
				filters: {
					name: ["in", ["Customer", "Supplier", "Company", "Employee"]]
				}
			};
		});
	},

	purpose(frm) {
		if (!frm.doc.purpose) return;

		if (["Send to Customer", "Receive from Customer"].includes(frm.doc.purpose)) {
			if (frm.doc.party_type !== "Customer") {
				frm.set_value("party_type", "Customer");
				frm.set_value("party", "");
			}
		} else if (["Send to Supplier", "Receive from Supplier", "Return to Supplier"].includes(frm.doc.purpose)) {
			if (frm.doc.party_type !== "Supplier") {
				frm.set_value("party_type", "Supplier");
				frm.set_value("party", "");
			}
		} else if (["Internal Transfer", "Move to Filling", "Return from Filling", "Move to Maintenance", "Return from Maintenance"].includes(frm.doc.purpose)) {
			if (!frm.doc.party_type) {
				frm.set_value("party_type", "Company");
			}
		}
	}
});

