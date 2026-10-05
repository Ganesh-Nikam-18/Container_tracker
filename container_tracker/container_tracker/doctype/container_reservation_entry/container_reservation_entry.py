# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, getdate, nowdate, flt
import json

class ContainerReservationEntry(Document):
	def validate(self):
		self.validate_dates()
		self.validate_containers()

	def validate_dates(self):
		end_date = self.reserved_until_date or self.get("to_date")
		if self.from_date and end_date and getdate(self.from_date) > getdate(end_date):
			frappe.throw("Reservation From Date cannot be after Reserved Until Date")

	def validate_containers(self):
		items = self.get("reserved_containers") or self.get("reservation_items")
		if not items:
			frappe.throw("Please add at least one container to reserve")

		for item in items:
			existing = frappe.db.sql("""
				SELECT cre.name, cre.reference_document_type, cre.reference_document_name, cre.party
				FROM `tabContainer Reservation Entry` cre
				JOIN `tabContainer Reservation Item` cri ON cri.parent = cre.name
				WHERE cri.container = %s
				  AND cre.docstatus = 1
				  AND cre.status = 'Active'
				  AND cre.name != %s
				LIMIT 1
			""", (item.container, self.name or ""), as_dict=True)

			if existing:
				res = existing[0]
				doc_ref = f"{res.reference_document_type} {res.reference_document_name}" if res.reference_document_name else res.name
				frappe.throw(
					f"Container <b>{item.container}</b> is already actively reserved under {doc_ref} for <b>{res.party}</b>. "
					"Cancel or complete that reservation before reserving it again."
				)

	def on_submit(self):
		self.db_set("status", "Active")
		self.update_containers_on_reserve()
		self.make_ledger_entries(is_cancelled=0)

	def on_cancel(self):
		self.db_set("status", "Cancelled")
		self.revert_containers_on_cancel()
		self.make_ledger_entries(is_cancelled=1)

	def update_containers_on_reserve(self):
		items = self.get("reserved_containers") or self.get("reservation_items")
		end_date = self.reserved_until_date or self.get("to_date")
		for item in items:
			c_doc = frappe.get_doc("Containers", item.container)
			c_doc.status = "Reserved"
			c_doc.custodian_type = self.party_type or "Customer"
			c_doc.custodian = self.party
			c_doc.dispatch_date = self.from_date or nowdate()
			c_doc.return_to_owner = end_date
			c_doc.save(ignore_permissions=True)

			comment_text = (
				f"<b>Container Reserved (via {self.name})</b><br>"
				f"<b>Document:</b> {self.reference_document_type or ''} {self.reference_document_name or ''}<br>"
				f"<b>Party:</b> {self.party or ''}<br>"
				f"<b>Period:</b> {self.from_date} to {end_date}"
			)
			c_doc.add_comment("Comment", text=comment_text)

	def revert_containers_on_cancel(self):
		items = self.get("reserved_containers") or self.get("reservation_items")
		for item in items:
			c_doc = frappe.get_doc("Containers", item.container)
			if c_doc.status == "Reserved":
				c_doc.status = "Filled" if c_doc.fill_status != "Empty" else "Available"
				c_doc.custodian = None
				c_doc.custodian_type = None
				c_doc.dispatch_date = None
				c_doc.return_to_owner = None
				c_doc.save(ignore_permissions=True)

	def make_ledger_entries(self, is_cancelled=0):
		items = self.get("reserved_containers") or self.get("reservation_items")
		for item in items:
			c_item = item.item_code or frappe.db.get_value("Containers", item.container, "current_item")
			cle = frappe.get_doc({
				"doctype": "Container Ledger Entry",
				"datetime": now_datetime(),
				"entry_type": "Outward",
				"movement_type": "Reserved",
				"container": item.container,
				"item_code": c_item,
				"party_type": self.party_type,
				"party": self.party,
				"source_location": "Plant Main Store",
				"target_location": self.party or "Plant Main Store",
				"reference_document_type": "Container Reservation Entry",
				"reference_document_name": self.name,
				"is_cancelled": is_cancelled
			})
			cle.insert(ignore_permissions=True)


@frappe.whitelist()
def create_reservation_entry(
	company=None, party_type=None, party=None,
	reference_doctype=None, reference_name=None,
	from_date=None, to_date=None, containers=None
):
	"""
	Create and submit a Container Reservation Entry for specified containers.
	"""
	if isinstance(containers, str):
		container_list = json.loads(containers)
	else:
		container_list = containers or []

	if not container_list:
		frappe.throw("No containers selected for reservation")

	if not to_date:
		frappe.throw("Reserved Until Date is required")

	company = company or frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company")
	from_date = from_date or nowdate()

	doc_rows = []
	for c in container_list:
		cname = c.get("name") if isinstance(c, dict) else c
		c_item = c.get("item_code") if isinstance(c, dict) else None
		doc_rows.append({
			"doctype": "Container Reservation Item",
			"container": cname,
			"item_code": c_item
		})

	res_doc = frappe.get_doc({
		"doctype": "Container Reservation Entry",
		"company": company,
		"posting_date": nowdate(),
		"party_type": party_type,
		"party": party,
		"reference_document_type": reference_doctype,
		"reference_document_name": reference_name,
		"from_date": from_date,
		"reserved_until_date": to_date,
		"reserved_containers": doc_rows
	})
	res_doc.insert(ignore_permissions=False)
	res_doc.submit()

	return {
		"name": res_doc.name,
		"message": f"Container Reservation Entry <b>{res_doc.name}</b> submitted successfully."
	}
