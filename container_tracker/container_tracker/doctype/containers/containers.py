import frappe
from frappe.utils import now_datetime
from frappe.model.document import Document
import json


class Containers(Document):
	def after_insert(self):
		# Automatically set the barcode to the Container's own ID upon creation
		if not self.container_barcode:
			self.db_set('container_barcode', self.name)


@frappe.whitelist()
def mark_container_damaged(containers, damage_type, damage_details, target_status="Damaged"):
	"""
	Mark one or more containers as Damaged or Scrapped with details.
	containers: string (single container name or JSON array string)
	"""
	if isinstance(containers, str) and containers.startswith("["):
		container_list = json.loads(containers)
	elif isinstance(containers, list):
		container_list = containers
	else:
		container_list = [containers]

	if not container_list:
		frappe.throw("No container specified")

	if not damage_type or not damage_details:
		frappe.throw("Damage Type and Damage Details are required")

	if target_status not in ["Damaged", "Scrapped"]:
		target_status = "Damaged"

	updated = []
	for cname in container_list:
		if not frappe.has_permission("Containers", "write", cname):
			continue

		c = frappe.get_doc("Containers", cname)
		old_status = c.status

		c.status = target_status
		c.save(ignore_permissions=True)

		# Add timeline comment
		comment_text = (
			f"<b>Marked Container as {target_status}</b><br>"
			f"<b>Damage Type:</b> {damage_type}<br>"
			f"<b>Details:</b> {damage_details}<br>"
			f"<b>Reported By:</b> {frappe.session.user}"
		)
		c.add_comment("Comment", text=comment_text)

		# Log Container Ledger Entry
		try:
			target_loc = "Scrap Yard" if target_status == "Scrapped" else "Maintenance Shop / Damaged Yard"
			cle = frappe.get_doc({
				"doctype": "Container Ledger Entry",
				"datetime": now_datetime(),
				"entry_type": "Outward",
				"movement_type": f"Marked {target_status}",
				"container": cname,
				"item_code": c.current_item,
				"source_location": c.current_location or "Plant Main Store",
				"target_location": target_loc,
				"status_before": old_status
			})
			cle.insert(ignore_permissions=True)
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Failed to log CLE for mark_container_damaged on {cname}")

		updated.append(cname)

	return {
		"message": f"Successfully updated {len(updated)} container(s) status to {target_status}",
		"updated": updated,
		"target_status": target_status
	}


@frappe.whitelist()
def reserve_containers(containers, party_type, party, from_date=None, return_to_owner=None):
	"""
	Reserve one or more containers for a specific Customer or Supplier for a given date range.
	containers: list or JSON array string of container names
	"""
	if isinstance(containers, str) and containers.startswith("["):
		container_list = json.loads(containers)
	elif isinstance(containers, list):
		container_list = containers
	else:
		container_list = [containers]

	if not container_list:
		frappe.throw("No containers specified for reservation")

	if not party_type or not party:
		frappe.throw("Party Type and Party are required for reservation")

	if not return_to_owner:
		frappe.throw("Expected Return / Reserved Until Date is required")

	from frappe.utils import nowdate
	from_date = from_date or nowdate()

	updated = []
	for cname in container_list:
		if not frappe.has_permission("Containers", "write", cname):
			continue

		c = frappe.get_doc("Containers", cname)
		old_status = c.status

		c.status = "Reserved"
		c.custodian_type = party_type
		c.custodian = party
		c.dispatch_date = from_date
		c.return_to_owner = return_to_owner
		c.save(ignore_permissions=True)

		# Add timeline comment
		comment_text = (
			f"<b>Container Reserved</b><br>"
			f"<b>Party Type:</b> {party_type}<br>"
			f"<b>Party:</b> {party}<br>"
			f"<b>From Date:</b> {from_date}<br>"
			f"<b>Reserved Until:</b> {return_to_owner}<br>"
			f"<b>Reserved By:</b> {frappe.session.user}"
		)
		c.add_comment("Comment", text=comment_text)

		# Log Container Ledger Entry
		try:
			cle = frappe.get_doc({
				"doctype": "Container Ledger Entry",
				"datetime": now_datetime(),
				"entry_type": "Outward",
				"movement_type": "Reserved",
				"container": cname,
				"item_code": c.current_item,
				"party_type": party_type,
				"party": party,
				"supplier": party if party_type == "Supplier" else None,
				"customer": party if party_type == "Customer" else None,
				"source_location": c.current_location or "Plant Main Store",
				"target_location": party,
				"status_before": old_status
			})
			cle.insert(ignore_permissions=True)
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Failed to log CLE for reserve_containers on {cname}")

		updated.append(cname)

	return {
		"message": f"Successfully reserved {len(updated)} container(s) for {party} until {return_to_owner}",
		"updated": updated,
		"party": party,
		"return_to_owner": return_to_owner
	}
