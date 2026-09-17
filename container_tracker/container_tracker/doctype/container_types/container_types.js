// Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Container Types", {
	fill_capacity(frm) {
		// If fill capacity changes, recalculate all rows in the child table
		if (frm.doc.item_capacity_matrix) {
			frm.doc.item_capacity_matrix.forEach(row => {
				if (row.perc_of_container_capacity) {
					frappe.model.set_value(row.doctype, row.name, "max_fill", 
						flt(frm.doc.fill_capacity) * (flt(row.perc_of_container_capacity) / 100.0)
					);
				}
			});
		}
	}
});

frappe.ui.form.on("Item Capacity Matrix", {
	perc_of_container_capacity(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (flt(row.perc_of_container_capacity) > 100) {
			frappe.msgprint(__("Percentage cannot be greater than 100"));
			frappe.model.set_value(cdt, cdn, "perc_of_container_capacity", 100);
			row.perc_of_container_capacity = 100;
		}
		
		if (frm.doc.fill_capacity) {
			frappe.model.set_value(cdt, cdn, "max_fill", 
				flt(frm.doc.fill_capacity) * (flt(row.perc_of_container_capacity) / 100.0)
			);
		} else {
			frappe.msgprint(__("Please set Fill Capacity in the parent form first."));
			frappe.model.set_value(cdt, cdn, "perc_of_container_capacity", 0);
		}
	}
});
