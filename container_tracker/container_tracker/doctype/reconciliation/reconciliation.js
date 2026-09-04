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

frappe.ui.form.on("Reconciliation Items", {
	container: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if(row.container) {
			frappe.db.get_value('Containers', row.container, ['type', 'gas_item']).then(r => {
				if(r && r.message) {
					let type = r.message.type;
					let gas_item = r.message.gas_item;
					
					if(type && gas_item) {
						frappe.db.get_doc('Container Types', type).then(c_type => {
							if(c_type && c_type.item_capacity_matrix) {
								let matrix_row = c_type.item_capacity_matrix.find(m => m.item === gas_item);
								if(matrix_row) {
									frappe.model.set_value(cdt, cdn, 'heel_req', matrix_row.min_retained);
								}
							}
						});
					}
				}
			});
		}
	},
	heel_back: function(frm, cdt, cdn) {
		calculate_penalty(frm, cdt, cdn);
	},
	heel_req: function(frm, cdt, cdn) {
		calculate_penalty(frm, cdt, cdn);
	}
});

function calculate_penalty(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	frappe.db.get_value('Container Settings', 'Container Settings', 
		['tolerance_before_penalty', 'penalty_rate_per_unit_short', 'flat_recooling_charge']).then(r => {
		if(r && r.message) {
			let s = r.message;
			let shortfall = (row.heel_req || 0) - (row.heel_back || 0);
			let tol = s.tolerance_before_penalty || 0;
			if(shortfall > tol) {
				let pen = (shortfall * (s.penalty_rate_per_unit_short || 0)) + (s.flat_recooling_charge || 0);
				frappe.model.set_value(cdt, cdn, 'penalty', pen);
			} else {
				frappe.model.set_value(cdt, cdn, 'penalty', 0);
			}
		}
	});
}
