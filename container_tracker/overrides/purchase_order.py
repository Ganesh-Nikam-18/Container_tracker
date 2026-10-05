# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def cancel_linked_container_movements(doc, method=None):
	"""
	Called on Purchase Order / Purchase Receipt cancel via doc_events hook.
	Finds all submitted Container Movements linked to this document,
	cancels them (which triggers on_cancel → revert_containers + ledger entries),
	effectively putting containers back to their original source location and status.
	"""
	linked_movements = frappe.get_all(
		"Container Movements",
		filters={
			"reference_document_type": doc.doctype,
			"reference_document_name": doc.name,
			"docstatus": 1  # Only submitted ones need cancellation
		},
		fields=["name"]
	)

	if not linked_movements:
		return

	cancelled = []
	errors = []

	for m in linked_movements:
		try:
			movement_doc = frappe.get_doc("Container Movements", m.name)
			movement_doc.cancel()
			cancelled.append(m.name)
			frappe.db.commit()
		except Exception as e:
			errors.append(f"{m.name}: {str(e)}")

	if cancelled:
		frappe.msgprint(
			_("Cancelled {0} Container Movement(s) linked to this document: {1}").format(
				len(cancelled), ", ".join(cancelled)
			),
			indicator="blue",
			alert=True
		)

	if errors:
		frappe.log_error(
			title="Container Movement Cancel Error",
			message="\n".join(errors)
		)
		frappe.msgprint(
			_("Some Container Movements could not be cancelled. Check Error Log for details."),
			indicator="orange"
		)
