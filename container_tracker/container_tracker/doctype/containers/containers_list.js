frappe.listview_settings['Containers'] = {
	get_indicator: function(doc) {
		let status = doc.status || "Unknown";
		let color = "gray";
		
		if (status === "Available") {
			color = "green";
		} else if (status === "Filled") {
			color = "blue";
		} else if (status === "With Customer" || status === "With Supplier") {
			color = "orange";
		} else if (status === "Damaged" || status === "Under Maintenance") {
			color = "red";
		} else if (status === "Scrapped") {
			color = "darkgrey";
		}

		return [__(status), color, "status,=," + status];
	},
	onload: function(listview) {
		listview.page.add_inner_button(__('Return from Reservation'), function() {
			let selected = listview.get_checked_items();
			if (selected.length === 0) {
				frappe.msgprint(__('Please select at least one container to return from reservation.'));
				return;
			}

			let reserved_containers = selected.filter(d => d.status === 'Reserved').map(d => d.name);
			if (reserved_containers.length === 0) {
				frappe.msgprint(__('None of the selected containers are currently in Reserved status.'));
				return;
			}

			frappe.confirm(
				__('Return <b>{0}</b> container(s) from reservation?', [reserved_containers.length]),
				() => {
					frappe.call({
						method: 'container_tracker.container_tracker.doctype.container_reservation_entry.container_reservation_entry.return_container_reservation',
						args: { containers: reserved_containers },
						callback: function(r) {
							if (r.message && r.message.message) {
								frappe.show_alert({ message: r.message.message, indicator: 'green' });
								listview.refresh();
							}
						}
					});
				}
			);
		});

		listview.page.add_inner_button(__('Mark Damage'), function() {
			let selected = listview.get_checked_items();
			if (selected.length === 0) {
				frappe.msgprint(__('Please select at least one container to mark as damaged.'));
				return;
			}

			let container_names = selected.map(d => d.name);
			if (window.open_mark_damage_dialog) {
				window.open_mark_damage_dialog(container_names, () => {
					listview.refresh();
				});
			} else {
				frappe.model.with_doctype('Containers', () => {
					window.open_mark_damage_dialog(container_names, () => {
						listview.refresh();
					});
				});
			}
		});
	}
};
