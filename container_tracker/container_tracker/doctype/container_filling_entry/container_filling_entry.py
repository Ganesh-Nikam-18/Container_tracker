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
			container_doc = frappe.get_doc("Containers", item.container)
			container_doc.db_set('status', 'Filled')
			container_doc.db_set('custodian', self.customer)
			container_doc.db_set('last_filled', today())
			
			if frappe.db.has_column("Containers", "filled_qty"):
				container_doc.db_set('filled_qty', item.qty_filled)
				
			if item.batch and frappe.db.has_column("Containers", "batch"):
				container_doc.db_set('batch', item.batch)
			
			source_location = container_doc.current_location
				
			cle = frappe.get_doc({
				"doctype": "Container Ledger Entry",
				"datetime": now_datetime(),
				"container": item.container,
				"filled_qty": item.qty_filled,
				"item_code": self.item,
				"party": self.customer,
				"delivery_note": self.delivery_note,
				"entry_type": "Outward",
				"from": source_location,
				"to": self.customer,
				"reference_document_type": "Container Filling Entry",
				"reference_document_name": self.name
			})
			
			cle.containers_movement = self.create_container_movement(container_doc)
			
			cle.insert(ignore_permissions=True)

	def create_container_movement(self, container_doc):
		target_location = frappe.db.get_value("Delivery Note", self.delivery_note, "shipping_address_name")
		if not target_location:
			target_location = frappe.db.get_value("Delivery Note", self.delivery_note, "customer")
		if not target_location:
			frappe.throw(f"Cannot create Container Movement: No target location found. Please ensure Delivery Note {self.delivery_note} has a Shipping Address or Customer.")
		if not frappe.db.exists("Location", target_location):
			loc = frappe.new_doc("Location")
			loc.location_name = target_location
			loc.insert(ignore_permissions=True)
		
		source_location = container_doc.current_location
		if source_location == target_location:
			return None

		cm = frappe.new_doc("Container Movements")
		cm.company = frappe.defaults.get_user_default("Company") or container_doc.company
		cm.purpose = "Outbound"
		cm.transaction_date = now_datetime()
		cm.reference_document_type = "Container Filling Entry"
		cm.reference_document_name = self.name
		
		cm.append("containers", {
			"container": container_doc.name,
			"source_location": source_location,
			"target_location": target_location
		})
		
		try:
			cm.insert(ignore_permissions=True)
			cm.submit()
			return cm.name
		except Exception as e:
			frappe.log_error(message=frappe.get_traceback(), title="Container Movement Creation Failed in CFE")
			frappe.throw(f"Failed to create Container Movement for {container_doc.name}: {str(e)}")

	def create_stock_entry(self):
		default_warehouse = frappe.db.get_single_value("Stock Settings", "default_warehouse")
		if not default_warehouse:
			return
			
		batch = None
		if self.container_filling_items:
			batch = self.container_filling_items[0].batch
			
		se = frappe.get_doc({
			"doctype": "Stock Entry",
			"purpose": "Material Issue",
			"stock_entry_type": "Material Issue",
			"items": [
				{
					"item_code": self.item,
					"qty": self.quantity_posted,
					"s_warehouse": default_warehouse,
					"batch_no": batch
				}
			]
		})
		
		try:
			se.insert(ignore_permissions=True)
			se.submit()
		except Exception as e:
			frappe.log_error(message=frappe.get_traceback(), title="Stock Entry Creation Failed in CFE")
			frappe.msgprint(f"Failed to create Stock Entry for Bulk Gas. Check Error Log for details.", indicator="red", alert=True)

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
