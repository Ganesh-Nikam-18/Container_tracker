import json

import frappe


@frappe.whitelist()
def get_reconciliation_data(customer: str | None = None):
	outstanding_containers = get_customer_outstanding_containers(customer)
	return {
		"total_outstanding": len(outstanding_containers),
		"containers": outstanding_containers
	}


@frappe.whitelist()
def validate_and_fetch_container(barcode: str, customer: str | None = None):
	if not customer:
		return {"error": "Select a customer before adding a returned container."}

	container = get_container_by_barcode_or_name(barcode)
	if not container:
		return {"error": "Container not found."}
	if container.status != "With Customer":
		return {
			"error": f"Container {container.name} is not with a customer. Current status: {container.status}."
		}

	outstanding_containers = {
		container.name: container for container in get_customer_outstanding_containers(customer)
	}
	outstanding_container = outstanding_containers.get(container.name)
	if not outstanding_container:
		return {
			"error": f"Container {container.name} is not in a submitted Container Filling Entry for {customer}."
		}

	item_code = outstanding_container.item_code or container.gas_item
	return {
		"name": container.name,
		"type": container.type,
		"capacity": container.capacity,
		"original_dn": outstanding_container.original_dn,
		"security_deposit": get_security_deposit(container.type),
		"heel_req": get_heel_requirement(container.type, item_code),
		"custodian": container.custodian,
	}

@frappe.whitelist()
def get_container_settings():
	return frappe.get_cached_doc("Container Settings").as_dict()

@frappe.whitelist()
def get_recent_reconciliations():
	recent = frappe.get_all(
		"Reconciliation",
		filters={"docstatus": ["!=", 2]},
		fields=["name", "posting_date", "customer", "transporter", "containers_received", "docstatus", "damage_and_loss_charges"],
		limit_page_length=5,
		order_by="creation desc"
	)
	return recent

@frappe.whitelist()
def submit_reconciliation(payload: str):
	data = json.loads(payload)
	customer = data.get("customer")
	containers = data.get("containers", [])
	if not customer:
		frappe.throw("Select a customer before submitting the reconciliation.")
	if not containers:
		frappe.throw("Add at least one returned container before submitting.")

	outstanding_containers = {
		container.name: container for container in get_customer_outstanding_containers(customer)
	}
	container_names = [container.get("name") for container in containers]
	if len(container_names) != len(set(container_names)):
		frappe.throw("The same container cannot be reconciled more than once.")

	invalid_containers = [
		container_name for container_name in container_names if container_name not in outstanding_containers
	]
	if invalid_containers:
		frappe.throw(
			"These containers are no longer outstanding with the selected customer: "
			+ ", ".join(str(container_name) for container_name in invalid_containers)
		)

	settings = frappe.get_cached_doc("Container Settings").as_dict()

	for c in containers:
		c["penalty"] = calculate_heel_penalty(
			c.get("heel_req"), c.get("heel_back")
		)
		
		out_container = outstanding_containers.get(c.get("name"))
		if out_container:
			security_deposit = get_security_deposit(out_container.type)
			condition = c.get("condition")
			
			if condition == "Damaged":
				charge_pct = settings.get("damaged_container_charge") or 0
				c["amount"] = float(security_deposit) * (float(charge_pct) / 100.0)
			elif condition == "Lost":
				charge_pct = settings.get("lost_container_charge") or 0
				c["amount"] = float(security_deposit) * (float(charge_pct) / 100.0)
			else:
				c["amount"] = 0.0

	total_charges = sum(float(c.get("amount") or 0) for c in containers)
	total_penalty = sum(float(c["penalty"]) for c in containers)

	# Create Reconciliation doc
	doc = frappe.get_doc({
		"doctype": "Reconciliation",
		"customer": customer,
		"transporter": data.get("transporter"),
		"posting_date": frappe.utils.today(),
		"containers_received": len(containers),
		"damage_and_loss_charges": total_charges,
		"heel_shortfall_penalty": total_penalty,
		"total_recovery": total_charges + total_penalty,
	})
	
	for c in containers:
		out_container = outstanding_containers[c.get("name")]
		doc.append("containers", {
			"container": c.get("name"),
			"condition": c.get("condition"),
			"charge_to": c.get("charge_to"),
			"charge": float(c.get("amount") or 0),
			"penalty": float(c.get("penalty") or 0),
			"remarks": c.get("remarks"),
			"heel_req": c.get("heel_req") or 0,
			"heel_back": c.get("heel_back") or 0,
			"delivery_note": out_container.original_dn,
		})
		
	doc.insert(ignore_permissions=True)
	
	# Generate Chargebacks if any
	cb_customer_items = []
	cb_supplier_items = []
	cust_charges = 0
	supp_charges = 0
	
	for c in containers:
		if float(c.get("amount") or 0) > 0 or float(c.get("penalty") or 0) > 0:
			item = {
				"container": c.get("name"),
				"condition_on_return": c.get("condition"),
				"remarks": c.get("remarks")
			}
			amt = float(c.get("amount") or 0) + float(c.get("penalty") or 0)
			if c.get("charge_to") == "Customer":
				cb_customer_items.append(item)
				cust_charges += amt
			elif c.get("charge_to") == "Supplier":
				cb_supplier_items.append(item)
				supp_charges += amt
				
	if cb_customer_items and data.get("customer"):
		cb = frappe.get_doc({
			"doctype": "Chargebacks",
			"document_type": "Customer",
			"party": data.get("customer"),
			"source_reconciliation": doc.name,
			"containers_charged": len(cb_customer_items),
			"amount": cust_charges,
			"containers": cb_customer_items
		}).insert(ignore_permissions=True)
		cb.submit()
		doc.append("chargebacks_raised", {
			"chargebacks": cb.name
		})
		
	if cb_supplier_items:
		if not data.get("transporter"):
			frappe.throw("You have assigned charges to the Transporter/Supplier, but no Transporter is selected at the top.")
			
		cb = frappe.get_doc({
			"doctype": "Chargebacks",
			"document_type": "Supplier",
			"party": data.get("transporter"),
			"source_reconciliation": doc.name,
			"containers_charged": len(cb_supplier_items),
			"amount": supp_charges,
			"containers": cb_supplier_items
		}).insert(ignore_permissions=True)
		cb.submit()
		doc.append("chargebacks_raised", {
			"chargebacks": cb.name
		})

	if cb_customer_items or cb_supplier_items:
		doc.save(ignore_permissions=True)

	doc.submit()
	
	return doc.name


def get_customer_outstanding_containers(customer: str | None):
	if not customer:
		return []

	filling_entries = frappe.get_all(
		"Container Filling Entry",
		filters={"customer": customer, "docstatus": 1},
		fields=["name", "delivery_note", "item"],
		order_by="creation desc",
	)
	if not filling_entries:
		return []

	entry_details = {entry.name: entry for entry in filling_entries}
	entry_positions = {entry.name: position for position, entry in enumerate(filling_entries)}
	filled_items = frappe.get_all(
		"Container Filling Items",
		filters={
			"parent": ["in", list(entry_details)],
			"parenttype": "Container Filling Entry",
		},
		fields=["container", "parent"],
	)

	container_entries = {}
	for item in filled_items:
		current_entry = container_entries.get(item.container)
		if item.container and (
			current_entry is None or entry_positions[item.parent] < entry_positions[current_entry]
		):
			container_entries[item.container] = item.parent
	if not container_entries:
		return []

	containers = frappe.get_all(
		"Containers",
		filters={
			"name": ["in", list(container_entries)],
			"status": "With Customer",
		},
		fields=["name", "type", "capacity", "container_barcode"],
	)
	for container in containers:
		filling_entry = entry_details[container_entries[container.name]]
		container["original_dn"] = filling_entry.delivery_note or "-"
		container["item_code"] = filling_entry.item

	return containers


def get_container_by_barcode_or_name(barcode: str):
	container = frappe.db.get_value(
		"Containers",
		{"name": barcode},
		["name", "status", "custodian", "type", "capacity", "gas_item"],
		as_dict=True,
	)
	if container:
		return container

	return frappe.db.get_value(
		"Containers",
		{"container_barcode": barcode},
		["name", "status", "custodian", "type", "capacity", "gas_item"],
		as_dict=True,
	)


def get_security_deposit(container_type: str):
	return frappe.db.get_value("Container Types", container_type, "security_deposit") or 0


def get_heel_requirement(container_type: str, item_code: str | None):
	if not item_code:
		return 0

	return (
		frappe.db.get_value(
			"Item Capacity Matrix",
			{"parent": container_type, "item": item_code},
			"min_retained",
		)
		or 0
	)


def calculate_heel_penalty(heel_requirement, heel_returned):
	shortfall = max(float(heel_requirement or 0) - float(heel_returned or 0), 0)
	penalty_rate = frappe.db.get_single_value("Container Settings", "penalty_rate_per_unit_short") or 0
	return shortfall * float(penalty_rate)
