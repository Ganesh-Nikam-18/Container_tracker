import frappe
from frappe.utils import today, getdate

@frappe.whitelist()
def get_submitted_delivery_notes():
	# Get submitted Delivery Notes (limit for performance, order by latest)
	return frappe.get_all("Delivery Note", filters={"docstatus": 1}, pluck="name", order_by="modified desc", limit=100)

@frappe.whitelist()
def get_dn_items(delivery_note):
	# Fetch distinct items from the selected Delivery Note
	if not delivery_note: return []
	return frappe.get_all("Delivery Note Item", filters={"parent": delivery_note}, pluck="item_code", distinct=True)

@frappe.whitelist()
def get_item_batches(item_code):
	# Fetch batches for the selected item
	if not item_code: return []
	return frappe.get_all("Batch", filters={"item": item_code}, pluck="name", order_by="creation desc")

@frappe.whitelist()
def get_quick_pick_containers(item_code):
	if not item_code: return []
	# Find Container Types that can hold this item via Item Capacity Matrix
	valid_types = frappe.get_all("Item Capacity Matrix", filters={"item": item_code}, pluck="parent")

	or_filters = [["gas_item", "=", item_code]]
	if valid_types:
		or_filters.append(["type", "in", valid_types])

	# Fetch available containers matching the gas item directly OR via their type matrix
	containers = frappe.get_all("Containers", 
		filters={"status": "Available", "docstatus": 1},
		or_filters=or_filters,
		pluck="name", 
		limit=10
	)
	return containers

@frappe.whitelist()
def get_dn_item_qty(delivery_note, item_code):
	# Calculate Ordered Qty from DN
	dn_items = frappe.get_all("Delivery Note Item", filters={"parent": delivery_note, "item_code": item_code}, fields=["qty"])
	ordered_qty = sum([float(d.qty) for d in dn_items]) if dn_items else 0.0
	
	# Calculate Pending Qty (Ordered - Already Filled in CFE)
	# Exclude Cancelled (docstatus 2)
	cfes = frappe.get_all("Container Filling Entry", filters={"delivery_note": delivery_note, "item": item_code, "docstatus": ["!=", 2]}, pluck="name")
	filled_qty = 0.0
	if cfes:
		cfe_data = frappe.get_all("Container Filling Entry", filters={"name": ["in", cfes]}, fields=["quantity_posted"])
		filled_qty = sum([float(d.quantity_posted) for d in cfe_data if d.quantity_posted])
		
	pending_qty = ordered_qty - filled_qty
	
	return {
		"ordered": ordered_qty,
		"pending": max(0, pending_qty)
	}

@frappe.whitelist()
def validate_and_fetch_container(barcode, item_code):
	# Search by name first, then container_barcode
	container = frappe.get_all("Containers", filters={"name": barcode}, limit=1)
	if not container:
		container = frappe.get_all("Containers", filters={"container_barcode": barcode}, limit=1)
		
	if not container:
		return {"error": f"Container '{barcode}' not found in the system."}
		
	container_name = container[0].name
	doc = frappe.get_doc("Containers", container_name)
	
	# Validation Rules
	if doc.docstatus != 1:
		return {"error": f"Container {doc.name} is not Submitted (Draft or Cancelled)."}
		
	if doc.status != "Available":
		return {"error": f"Container {doc.name} is not 'Available' (Current Status: {doc.status})."}
		
	if doc.test_due and getdate(doc.test_due) < getdate(today()):
		return {"error": f"Container {doc.name} test date has expired on {doc.test_due}."}
		
	if doc.gas_item != item_code:
		container_type = frappe.get_doc("Container Types", doc.type)
		valid_items = [row.item for row in container_type.get("item_capacity_matrix", [])]
		if item_code not in valid_items:
			return {"error": f"Container {doc.name} is configured for '{doc.gas_item}', and '{item_code}' is not a valid alternative for type '{doc.type}'."}
		
	return {
		"name": doc.name,
		"type": doc.type,
		"capacity": float(doc.capacity or 0.0),
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
	containers = data.get("containers", [])
	
	if not containers:
		frappe.throw("No containers were scanned to fill.")
		
	# Initialize CFE
	cfe = frappe.new_doc("Container Filling Entry")
	cfe.posting_date = today()
	cfe.delivery_note = dn
	cfe.item = item
	cfe.operator = operator
	
	customer = frappe.db.get_value("Delivery Note", dn, "customer")
	if customer:
		cfe.customer = customer
		
	total_qty = 0.0
	
	# Fetch pending qty
	dn_items = frappe.get_all("Delivery Note Item", filters={"parent": dn, "item_code": item}, fields=["qty"])
	ordered_qty = sum([float(d.qty) for d in dn_items]) if dn_items else 0.0
	
	cfes = frappe.get_all("Container Filling Entry", filters={"delivery_note": dn, "item": item, "docstatus": ["!=", 2]}, pluck="name")
	already_filled = 0.0
	if cfes:
		cfe_items = frappe.get_all("Container Filling Item", filters={"parent": ["in", cfes], "parenttype": "Container Filling Entry"}, fields=["qty_filled"])
		already_filled = sum([float(i.qty_filled or 0) for i in cfe_items])
	pending_qty = ordered_qty - already_filled
	
	for c_id in containers:
		c_doc = frappe.get_doc("Containers", c_id)
		c_capacity = float(c_doc.capacity or 0.0)
		
		if pending_qty > 0:
			qty_to_fill = min(c_capacity, pending_qty)
		else:
			qty_to_fill = 0.0
			
		cfe.append("container_filling_items", {
			"container": c_id,
			"type": c_doc.type,
			"qty_filled": qty_to_fill,
			"batch": batch
		})
		
		total_qty += qty_to_fill
		pending_qty -= qty_to_fill
		
	cfe.containers_filled = len(containers)
	cfe.quantity_posted = total_qty
	
	# Insert and Submit
	cfe.insert()
	cfe.submit()
	
	return cfe.name
