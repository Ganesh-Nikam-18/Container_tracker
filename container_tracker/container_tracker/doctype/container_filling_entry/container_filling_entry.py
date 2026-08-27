# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, today

class ContainerFillingEntry(Document):
	def on_submit(self):
		self.process_containers()
		self.create_stock_entry()

	def process_containers(self):
		for item in self.container_filling_items:
			# 1. Update Container Document
			container_doc = frappe.get_doc("Containers", item.container)
			container_doc.db_set('status', 'Filled')
			container_doc.db_set('last_filled', today())
			container_doc.db_set('filled_qty', item.qty_filled)
			
			# 2. Create Container Ledger Entry
			cle = frappe.get_doc({
				"doctype": "Container Ledger Entry",
				"datetime": now_datetime(),
				"container": item.container,
				"filled_qty": item.qty_filled
			})
			# Link Asset Movement if container is an Asset
			if container_doc.asset:
				cle.asset_movement = self.create_asset_movement(container_doc)
			
			cle.insert(ignore_permissions=True)
			
			# 3. Add to CLE Items child table
			self.append("cle_items", {
				"container_ledger_entry": cle.name
			})
		
		# Save child table updates
		self.save(ignore_permissions=True)
		frappe.db.commit()

	def create_asset_movement(self, container_doc):
		# Placeholder for Asset Movement creation
		# In a real implementation, you would determine source and target locations
		return None

	def create_stock_entry(self):
		# Create Stock Entry (Material Issue) to consume the bulk gas
		default_warehouse = frappe.db.get_single_value("Stock Settings", "default_warehouse")
		if not default_warehouse:
			# Fallback if no default warehouse is set
			return
			
		se = frappe.get_doc({
			"doctype": "Stock Entry",
			"purpose": "Material Issue",
			"stock_entry_type": "Material Issue",
			"items": [
				{
					"item_code": self.item,
					"qty": self.quantity_posted,
					"s_warehouse": default_warehouse
				}
			]
		})
		
		try:
			se.insert(ignore_permissions=True)
			se.submit()
		except Exception as e:
			frappe.log_error(message=frappe.get_traceback(), title="Stock Entry Creation Failed in CFE")

@frappe.whitelist()
def get_delivery_note_items(delivery_note):
	if not delivery_note or frappe.db.get_value("Delivery Note", delivery_note, "docstatus") != 1:
		return []

	return frappe.get_all(
		"Delivery Note Item",
		filters={"parent": delivery_note},
		pluck="item_code",
		distinct=True,
		order_by="item_code",
	)
