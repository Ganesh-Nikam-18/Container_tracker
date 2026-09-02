// Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Reconciliation", {
	setup(frm) {
		frm.set_query("transporter", function() {
			return {
				filters: {
					"is_transporter": 1,
					"disabled": 0
				}
			};
		});
	}
});
