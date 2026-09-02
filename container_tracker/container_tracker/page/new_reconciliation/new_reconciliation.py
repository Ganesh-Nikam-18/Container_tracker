import frappe
import json

@frappe.whitelist()
def get_reconciliation_data(customer):
	if not customer:
		return {"total_outstanding": 0, "containers": []}
		
	# 1. Find all submitted Container Filling Entries for this customer
	cfes = frappe.get_all("Container Filling Entry", filters={"customer": customer, "docstatus": 1}, pluck="name")
	
	if not cfes:
		return {"total_outstanding": 0, "containers": []}
		
	# 2. Get all containers listed in those CFEs
	cfi_list = frappe.get_all("Container Filling Items", filters={"parent": ["in", cfes]}, fields=["container", "parent"])
	
	# Mapping of container to its original DN (from the CFE's delivery_note field)
	# Wait, CFE has delivery_note field directly on the parent.
	cfe_dn_map = {}
	cfe_docs = frappe.get_all("Container Filling Entry", filters={"name": ["in", cfes]}, fields=["name", "delivery_note"])
	for c in cfe_docs:
		cfe_dn_map[c.name] = c.delivery_note

	container_names = list(set([i.container for i in cfi_list]))
	
	if not container_names:
		return {"total_outstanding": 0, "containers": []}
		
	# 3. Filter only those containers that are STILL outstanding (status != Available/Damaged/Scrapped)
	outstanding_containers = frappe.get_all(
		"Containers",
		filters={"name": ["in", container_names], "status": "With Customer", "custodian": customer},
		fields=["name", "type", "capacity", "container_barcode"]
	)
	
	# Map the Original DN back to the containers
	for cont in outstanding_containers:
		# Find which CFE parent this container belonged to
		for i in cfi_list:
			if i.container == cont.name:
				cont["original_dn"] = cfe_dn_map.get(i.parent, "-")
				break
	
	return {
		"total_outstanding": len(outstanding_containers),
		"containers": outstanding_containers
	}

@frappe.whitelist()
def validate_and_fetch_container(barcode, customer):
	# Allow passing either ID or barcode
	container = frappe.db.get_value("Containers", {"name": barcode}, ["name", "status", "custodian", "type", "capacity"], as_dict=True)
	
	if not container:
		container = frappe.db.get_value("Containers", {"container_barcode": barcode}, ["name", "status", "custodian", "type", "capacity"], as_dict=True)
		
	if not container:
		return {"error": "Container not found"}
		
	if container.status != "With Customer":
		return {"error": f"Container {container.name} is not 'With Customer'. Current status: {container.status}"}
		
	if container.custodian and container.custodian != customer:
		return {"error": f"Container {container.name} is with {container.custodian}, not {customer}."}
		
	# Find the original delivery note (best effort from Container Filling Entry)
	original_dn = "-"
	cfes = frappe.get_all("Container Filling Entry", filters={"customer": customer, "docstatus": 1}, pluck="name")
	if cfes:
		items = frappe.get_all("Container Filling Items", filters={"parent": ["in", cfes], "container": container.name}, fields=["parent"], order_by="creation desc", limit=1)
		if items:
			cfe_doc = frappe.db.get_value("Container Filling Entry", items[0].parent, "delivery_note")
			if cfe_doc:
				original_dn = cfe_doc
	
	return {
		"name": container.name,
		"type": container.type,
		"capacity": container.capacity,
		"original_dn": original_dn
	}

@frappe.whitelist()
def get_recent_reconciliations():
	recent = frappe.get_all(
		"Reconciliation",
		fields=["name", "posting_date", "customer", "transporter", "containers_received", "docstatus", "damage_and_loss_charges"],
		limit_page_length=5,
		order_by="creation desc"
	)
	return recent

@frappe.whitelist()
def submit_reconciliation(payload):
	data = json.loads(payload)
	
	# Create Reconciliation doc
	doc = frappe.get_doc({
		"doctype": "Reconciliation",
		"customer": data.get("customer"),
		"transporter": data.get("transporter"),
		"posting_date": frappe.utils.today(),
		"containers_received": len(data.get("containers", [])),
		"damage_and_loss_charges": data.get("total_charges", 0),
		"heel_shortfall_penalty": data.get("total_penalty", 0),
		"total_recovery": data.get("total_recovery", 0)
	})
	
	for c in data.get("containers", []):
		doc.append("containers", {
			"container": c.get("name"),
			"condition": c.get("condition"),
			"charge_to": c.get("charge_to"),
			"charge": float(c.get("amount") or 0),
			"penalty": float(c.get("penalty") or 0),
			"remarks": c.get("remarks"),
			"heel_req": c.get("heel_req") or 0,
			"heel_back": c.get("heel_back") or 0,
		})
		
		# Update container status
		cont_doc = frappe.get_doc("Containers", c.get("name"))
		if c.get("condition") == "Damaged":
			cont_doc.db_set("status", "Damaged")
		elif c.get("condition") == "Lost":
			cont_doc.db_set("status", "Scrapped")
		else:
			cont_doc.db_set("status", "Available")
			
		cont_doc.db_set("custodian", "")
		
	doc.insert(ignore_permissions=True)
	doc.submit()
	
	return doc.name
