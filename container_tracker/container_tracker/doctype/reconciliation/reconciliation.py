# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

class Reconciliation(Document):
	def on_submit(self):
		for item in self.containers:
			if not item.container:
				continue

			container = frappe.get_doc("Containers", item.container)
			self.move_asset_on_return(container, item.condition)
			container.db_set("status", self.get_container_status(item.condition))
			container.db_set("custodian", "")

	def on_cancel(self):
		self.cancel_asset_movements()

		# Revert the container statuses
		for item in self.containers:
			if item.container:
				frappe.db.set_value("Containers", item.container, {
					"status": "With Customer",
					"custodian": self.customer
				})

		# Cancel linked Chargebacks
		chargebacks = frappe.get_all("Chargebacks", filters={"source_reconciliation": self.name, "docstatus": 1}, pluck="name")
		for cb_name in chargebacks:
			cb_doc = frappe.get_doc("Chargebacks", cb_name)
			cb_doc.cancel()

	def move_asset_on_return(self, container, condition):
		if not container.asset or condition == "Lost":
			return

		target_location = "Repair Bay" if condition == "Damaged" else "Filling Plant"
		if frappe.db.get_value("Asset", container.asset, "location") == target_location:
			return

		self.ensure_location(target_location)
		company = frappe.db.get_value("Asset", container.asset, "company")
		if not company:
			frappe.throw(f"Asset {container.asset} does not have a company.")

		movement = frappe.get_doc({
			"doctype": "Asset Movement",
			"company": company,
			"purpose": "Transfer",
			"transaction_date": now_datetime(),
			"reference_doctype": self.doctype,
			"reference_name": self.name,
			"assets": [{
				"asset": container.asset,
				"target_location": target_location,
			}],
		})
		movement.insert(ignore_permissions=True)
		movement.submit()

	def cancel_asset_movements(self):
		movement_names = frappe.get_all(
			"Asset Movement",
			filters={
				"reference_doctype": self.doctype,
				"reference_name": self.name,
				"docstatus": 1,
			},
			pluck="name",
		)
		for movement_name in movement_names:
			frappe.get_doc("Asset Movement", movement_name).cancel()

	def ensure_location(self, location_name):
		if frappe.db.exists("Location", location_name):
			return

		location = frappe.new_doc("Location")
		location.location_name = location_name
		location.insert(ignore_permissions=True)

	def get_container_status(self, condition):
		if condition == "Damaged":
			return "Damaged"
		if condition == "Lost":
			return "Scrapped"
		return "Available"
