// Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Containers", {
	refresh(frm) {
		if (frm.doc.type) {
			render_item_capacities(frm);
		}
	},
    type(frm) {
        if (frm.doc.type) {
            render_item_capacities(frm);
        } else {
            $(frm.fields_dict.item_capacities_html.wrapper).html('');
        }
    }
});

function render_item_capacities(frm) {
	frappe.call({
		method: 'frappe.client.get',
		args: { doctype: 'Container Types', name: frm.doc.type },
		callback: function(r) {
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
