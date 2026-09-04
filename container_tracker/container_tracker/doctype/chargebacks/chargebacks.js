// Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Chargebacks", {
	setup(frm) {
		frm.set_query("document_type", function () {
			return {
				filters: {
					name: ["in", ["Customer","Supplier"]]
				}
			};
		});
	}
});
