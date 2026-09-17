import frappe
from frappe.utils import today, getdate

@frappe.whitelist()
def get_submitted_delivery_notes():
	return frappe.get_all("Delivery Note", filters={"docstatus": 1}, pluck="name", order_by="modified desc", limit=100)

@frappe.whitelist()
def get_dn_items(delivery_note):
	if not delivery_note: return []
	
	dn_items = frappe.get_all("Delivery Note Item", filters={"parent": delivery_note}, fields=["item_code", "qty"])
	item_ordered = {}
	for d in dn_items:
		item_ordered[d.item_code] = item_ordered.get(d.item_code, 0.0) + float(d.qty)
		
	cfes = frappe.get_all("Container Filling Entry", filters={"delivery_note": delivery_note, "docstatus": ["!=", 2]}, fields=["item", "quantity_posted"])
	item_filled = {}
	for c in cfes:
		item_filled[c.item] = item_filled.get(c.item, 0.0) + float(c.quantity_posted or 0)
		
	valid_items = []
	for item, ordered in item_ordered.items():
		filled = item_filled.get(item, 0.0)
		if ordered - filled > 0.001:
			valid_items.append(item)
			
	return valid_items

@frappe.whitelist()
def get_item_batches(item_code):
	if not item_code: return []
	return frappe.get_all("Batch", filters={"item": item_code}, pluck="name", order_by="creation desc")

@frappe.whitelist()
def get_quick_pick_containers(item_code):
	if not item_code: return []
	valid_types = frappe.get_all("Item Capacity Matrix", filters={"item": item_code}, pluck="parent")
	if not valid_types:
		return []

	containers = frappe.get_all("Containers",
		filters={"status": "Available", "docstatus": 1, "type": ["in", valid_types]},
		pluck="name",
		limit=10
	)
	return containers

@frappe.whitelist()
def get_dn_item_qty(delivery_note, item_code):
	dn_items = frappe.get_all("Delivery Note Item", filters={"parent": delivery_note, "item_code": item_code}, fields=["qty", "batch_no", "serial_and_batch_bundle"])
	ordered_qty = sum([float(d.qty) for d in dn_items]) if dn_items else 0.0
	
	batch_no = None
	serial_and_batch_bundle = None
	for d in dn_items:
		if d.get("serial_and_batch_bundle"):
			serial_and_batch_bundle = d.serial_and_batch_bundle
			bundle_entries = frappe.get_all("Serial and Batch Entry", filters={"parent": d.serial_and_batch_bundle}, fields=["batch_no"])
			for entry in bundle_entries:
				if entry.get("batch_no"):
					batch_no = entry.batch_no
					break
			if serial_and_batch_bundle:
				break
		elif d.get("batch_no"):
			batch_no = d.batch_no
			break

	cfes = frappe.get_all("Container Filling Entry", filters={"delivery_note": delivery_note, "item": item_code, "docstatus": ["!=", 2]}, pluck="name")
	filled_qty = 0.0
	if cfes:
		cfe_data = frappe.get_all("Container Filling Entry", filters={"name": ["in", cfes]}, fields=["quantity_posted"])
		filled_qty = sum([float(d.quantity_posted) for d in cfe_data if d.quantity_posted])
	pending_qty = ordered_qty - filled_qty
	
	return {
		"ordered": ordered_qty,
		"pending": max(0, pending_qty),
		"batch_no": batch_no,
		"serial_and_batch_bundle": serial_and_batch_bundle
	}

@frappe.whitelist()
def validate_and_fetch_container(barcode, item_code):
	container = frappe.get_all("Containers", filters={"name": barcode}, limit=1)
	if not container:
		container = frappe.get_all("Containers", filters={"container_barcode": barcode}, limit=1)

	if not container:
		return {"error": f"Container '{barcode}' not found in the system."}

	container_name = container[0].name
	doc = frappe.get_doc("Containers", container_name)

	if doc.docstatus != 1:
		return {"error": f"Container {doc.name} is not Submitted (Draft or Cancelled)."}

	if doc.status != "Available":
		return {"error": f"Container {doc.name} is not 'Available' (Current status: {doc.status})."}

	if doc.test_due and getdate(doc.test_due) < getdate(today()):
		return {"error": f"Container {doc.name} test date has expired on {doc.test_due}."}

	# Validate via Item Capacity Matrix on the Container Type
	if not doc.type:
		return {"error": f"Container {doc.name} has no Container Type assigned."}

	container_type = frappe.get_doc("Container Types", doc.type)
	matrix_row = None
	for row in container_type.get("item_capacity_matrix", []):
		if row.item == item_code:
			matrix_row = row
			break

	if not matrix_row:
		return {"error": f"Item '{item_code}' is not allowed in container type '{doc.type}'. Check the Item Capacity Matrix on the Container Type."}

	container_capacity = float(doc.capacity or 0.0)
	max_fill = float(matrix_row.max_fill or 0.0)
	perc = float(matrix_row.perc_of_container_capacity or 0.0)

	if max_fill > 0:
		effective_capacity = max_fill
	else:
		# Fallback to container's own capacity field
		effective_capacity = container_capacity

	return {
		"name": doc.name,
		"type": doc.type,
		"capacity": effective_capacity,
		"max_fill": max_fill,
		"actual_container_capacity": container_capacity,
		"perc_of_container_capacity": perc,
		"tare_weight": float(doc.tare_weight or 0.0),
		"barcode": doc.container_barcode
	}

@frappe.whitelist()
def submit_filling_entry(payload):
	import json
	data = json.loads(payload)
	
	dn = data.get("delivery_note")
	item = data.get("item")
	operator = data.get("operator")
	batch = data.get("batch")
	serial_and_batch_bundle = data.get("serial_and_batch_bundle")
	containers = data.get("containers", [])
	
	if not containers:
		frappe.throw("No containers were scanned to fill.")
		
	cfe = frappe.new_doc("Container Filling Entry")
	cfe.posting_date = today()
	cfe.delivery_note = dn
	cfe.item = item
	cfe.operator = operator
	
	customer = frappe.db.get_value("Delivery Note", dn, "customer")
	if customer:
		cfe.customer = customer
		
	total_qty = 0.0
	
	for c_data in containers:
		c_id = c_data.get("name")
		qty_to_fill = float(c_data.get("qty", 0.0))
		c_doc = frappe.get_doc("Containers", c_id)

		cfe.append("container_filling_items", {
			"container": c_id,
			"type": c_doc.type,
			"qty_filled": qty_to_fill,
			"batch": batch,
			"serial_and_batch_bundle": serial_and_batch_bundle
		})

		total_qty += qty_to_fill
		
	cfe.used_containers_count = len(containers)
	cfe.quantity_posted = total_qty
	cfe.insert()
	cfe.submit()
	
	return cfe.name
