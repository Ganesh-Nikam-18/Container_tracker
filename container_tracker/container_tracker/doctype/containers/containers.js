// Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Containers", {
	refresh(frm) {
		if (frm.doc.type) {
			render_item_capacities(frm);
		}

		if (frm.doc.docstatus < 2) {
			frm.add_custom_button(__('Mark Damage'), () => {
				window.open_mark_damage_dialog(frm.doc.name, () => {
					frm.reload_doc();
				});
			}, __('Actions'));
		}
	},
	type(frm) {
		if (frm.doc.type) {
			render_item_capacities(frm);
		} else {
			$(frm.fields_dict.item_capacities_html.wrapper).html('');
		}
	},
	current_item(frm) {
		if (frm.doc.current_item) {
			frappe.model.with_doc("Item", frm.doc.current_item, () => {
				let item_doc = frappe.model.get_doc("Item", frm.doc.current_item);
				if (item_doc && item_doc.custom_available_gas_grade && item_doc.custom_available_gas_grade.length > 0) {
					let default_grade = item_doc.custom_available_gas_grade.find(d => d.is_default);
					if (!default_grade) {
						// Fallback to the first row if no default is marked
						default_grade = item_doc.custom_available_gas_grade[0];
					}

					if (default_grade && default_grade.gas_grade) {
						frm.set_value("current_grade", default_grade.gas_grade);
					} else {
						frm.set_value("current_grade", "");
					}
				} else {
					frm.set_value("current_grade", "");
				}
			});
		} else {
			frm.set_value("current_grade", "");
		}
	}
});

function render_item_capacities(frm) {
	frappe.call({
		method: 'frappe.client.get',
		args: { doctype: 'Container Types', name: frm.doc.type },
		callback: function (r) {
			if (r.message && r.message.item_capacity_matrix) {
				let matrix = r.message.item_capacity_matrix;
				if (matrix.length === 0) {
					$(frm.fields_dict.item_capacities_html.wrapper).html('<div class="text-muted">No capacities configured</div>');
					return;
				}

				let html = `
				<div style="margin-bottom: 15px;">
					<table class="table table-bordered">
						<thead>
							<tr>
								<th class="text-muted" style="font-weight: normal;">Item</th>
								<th class="text-muted" style="font-weight: normal;">Max fill</th>
								<th class="text-muted" style="font-weight: normal;">Max extract</th>
								<th class="text-muted" style="font-weight: normal;">Heel</th>
							</tr>
						</thead>
						<tbody>
				`;

				matrix.forEach(row => {
					let heelHtml = row.min_retained ? `<span class="indicator-pill orange" style="font-size: 12px;">${row.min_retained} ${row.uom || ''}</span>` : '—';
					html += `
							<tr>
								<td style="font-weight: 500;">${row.item}</td>
								<td>${row.max_fill || '—'} ${row.max_fill && row.uom ? row.uom : ''}</td>
								<td>${row.max_extraction || '—'}</td>
								<td>${heelHtml}</td>
							</tr>
					`;
				});

				html += `
						</tbody>
					</table>
				</div>
				`;

				$(frm.fields_dict.item_capacities_html.wrapper).html(html);
			}
		}
	});
}

window.open_mark_damage_dialog = function(containers, callback) {
	let container_list = Array.isArray(containers) ? containers : [containers];
	if (!container_list || container_list.length === 0) {
		frappe.msgprint(__('Please select at least one container.'));
		return;
	}

	let d = new frappe.ui.Dialog({
		title: __('Report Container Damage'),
		fields: [
			{
				fieldtype: 'HTML',
				fieldname: 'container_info',
				options: `<div class="p-2 mb-2 bg-light rounded font-weight-bold" style="font-size:13px;">
					Containers to Mark: <span class="text-primary">${container_list.join(', ')}</span>
				</div>`
			},
			{
				fieldtype: 'Select',
				fieldname: 'damage_type',
				label: __('Damage Type / Issue'),
				options: [
					'Physical Damage / Dent',
					'Valve Leakage / Faulty Valve',
					'Corrosion / Heavy Rust',
					'Hydro Test Expiry / Failure',
					'Contamination / Odor',
					'Other / General Maintenance'
				].join('\n'),
				reqd: 1
			},
			{
				fieldtype: 'Select',
				fieldname: 'target_status',
				label: __('New Status'),
				options: [
					'Damaged',
					'Scrapped'
				].join('\n'),
				default: 'Damaged',
				reqd: 1
			},
			{
				fieldtype: 'Small Text',
				fieldname: 'damage_details',
				label: __('Damage Details & Remarks'),
				placeholder: __('Describe the damage, leak location, or inspection remarks...'),
				reqd: 1
			}
		],
		primary_action_label: __('Submit Damage Report'),
		primary_action(values) {
			d.get_primary_btn().prop('disabled', true);
			frappe.call({
				method: 'container_tracker.container_tracker.doctype.containers.containers.mark_container_damaged',
				args: {
					containers: JSON.stringify(container_list),
					damage_type: values.damage_type,
					damage_details: values.damage_details,
					target_status: values.target_status
				},
				callback: function(r) {
					d.hide();
					if (r.message && r.message.message) {
						frappe.show_alert({ message: r.message.message, indicator: 'orange' });
						if (callback) callback(r.message);
					}
				}
			});
		}
	});

	d.show();
};
