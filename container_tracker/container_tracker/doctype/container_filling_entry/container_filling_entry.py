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
			container_doc.db_set('status', 'With Customer')
			container_doc.db_set('custodian', self.customer)
			container_doc.db_set('last_filled', today())
			
			if frappe.db.has_column("Containers", "filled_qty"):
				container_doc.db_set('filled_qty', item.qty_filled)
				
			if item.batch and frappe.db.has_column("Containers", "batch"):
				container_doc.db_set('batch', item.batch)
			
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
				"container_ledger_entry": cle.name,
				"qty": item.qty_filled,
				"filled_qty": item.qty_filled
			})
		
		# Save child table updates
		self.save(ignore_permissions=True)
		frappe.db.commit()

	def create_asset_movement(self, container_doc):
		# Create Asset Movement to transfer container from Filling Plant to Finished Goods
		# Asset Movement target_location is a Link to the Location doctype.
		target_location = "Finished Goods"
		
		# Ensure the Location exists in the system before using it
		if not frappe.db.exists("Location", target_location):
			loc = frappe.new_doc("Location")
			loc.location_name = target_location
			loc.insert(ignore_permissions=True)
		
		# For now, let's just log a basic Asset Movement
		am = frappe.new_doc("Asset Movement")
		am.company = frappe.defaults.get_user_default("Company")
		am.purpose = "Transfer"
		am.transaction_date = now_datetime()
		
		am.append("assets", {
			"asset": container_doc.asset,
			"target_location": target_location
		})
		
		try:
			am.insert(ignore_permissions=True)
			am.submit()
			return am.name
		except Exception as e:
			frappe.log_error(message=frappe.get_traceback(), title="Asset Movement Creation Failed in CFE")
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
