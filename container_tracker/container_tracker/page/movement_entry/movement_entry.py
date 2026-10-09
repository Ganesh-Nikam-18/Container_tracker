import frappe
from frappe.utils import flt, getdate, nowdate, date_diff, add_days
import json


# ---------------------------------------------------------------------------
# KPI & Board Data
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_kpi_counts():
	"""Return container counts grouped by status for the KPI strip."""
	results = frappe.db.sql("""
		SELECT status, COUNT(*) as cnt
		FROM `tabContainers`
		WHERE docstatus < 2
		GROUP BY status
	""", as_dict=True)

	counts = {r.status: r.cnt for r in results}
	total = sum(counts.values())

	# Days-held alerts: our containers with customers/suppliers for > 30 days
	overdue_count = frappe.db.count("Containers", filters={
		"status": ["in", ["With Customer", "With Supplier"]],
		"holder_since": ["<", add_days(nowdate(), -30)],
		"docstatus": ["<", 2]
	})

	# Test due in next 30 days
	test_due_count = frappe.db.count("Containers", filters={
		"test_due": ["between", [nowdate(), add_days(nowdate(), 30)]],
		"docstatus": ["<", 2]
	})

	return {
		"total": total,
		"available": counts.get("Available", 0),
		"filled": counts.get("Filled", 0),
		"reserved": counts.get("Reserved", 0),
		"in_filling": counts.get("In Filling", 0),
		"with_customer": counts.get("With Customer", 0),
		"with_supplier": counts.get("With Supplier", 0),
		"under_maintenance": counts.get("Under Maintenance", 0),
		"in_transit": counts.get("In Transit", 0),
		"ready_for_dispatch": counts.get("Ready For Dispatch", 0),
		"scrapped": counts.get("Scrapped", 0),
		"overdue_days": overdue_count,
		"test_due_soon": test_due_count,
	}


@frappe.whitelist()
def get_containers_for_board(status=None, owner_type=None, custodian=None, item_code=None, search=None, limit=200):
	"""Return containers for the board view or selection grids with filtering."""
	filters = {"docstatus": ["<", 2]}
	if status:
		filters["status"] = status
	if owner_type:
		filters["owner_type"] = owner_type
	if custodian:
		filters["custodian"] = custodian

	containers = frappe.get_all(
		"Containers",
		filters=filters,
		fields=[
			"name", "type", "status", "fill_status", "owner_type", "owner_",
			"custodian", "custodian_type", "current_location", "test_due",
			"holder_since", "dispatch_date", "current_item", "current_grade",
			"current__qty", "capacity", "last_filled"
		],
		or_filters={"name": ["like", f"%{search}%"]} if search else None,
		limit_page_length=int(flt(limit)) if limit else 300
	)

	valid_container_types = set()
	if item_code:
		# 1. Fetch allowed types from Item Capacity Matrix
		matrix_types = frappe.get_all("Item Capacity Matrix", filters={"item": item_code}, pluck="parent")
		if matrix_types:
			valid_container_types.update(matrix_types)
		# 2. Fetch default container type from Item doc
		default_type = frappe.db.get_value("Item", item_code, "custom_default_container_type")
		if default_type:
			valid_container_types.add(default_type)

	today = getdate()
	valid_list = []
	for c in containers:
		# If current_item is empty, resolve from last movement item
		if not c.get("current_item"):
			last_item = frappe.db.sql("""
				SELECT mi.item_code 
				FROM `tabContainer Movement Items` mi
				JOIN `tabContainer Movements` cm ON cm.name = mi.parent
				WHERE mi.container = %s AND cm.docstatus = 1 AND mi.item_code IS NOT NULL AND mi.item_code != ''
				ORDER BY cm.transaction_date DESC, cm.creation DESC
				LIMIT 1
			""", (c.name,), as_dict=True)
			if last_item:
				c["current_item"] = last_item[0].item_code

		if item_code:
			is_item_match = (c.get("current_item") == item_code)
			is_type_match = (valid_container_types and c.get("type") in valid_container_types)
			# If valid_container_types exist for this item, container MUST match type or current_item
			if valid_container_types and not (is_type_match or is_item_match):
				continue
			elif not valid_container_types and not is_item_match and c.get("current_item"):
				continue

		if c.holder_since:
			c["days_held"] = date_diff(today, getdate(c.holder_since))
		else:
			c["days_held"] = 0

		if c.test_due:
			days_to_expiry = date_diff(getdate(c.test_due), today)
			c["test_due_days"] = days_to_expiry
			c["test_status"] = (
				"expired" if days_to_expiry < 0 else
				"critical" if days_to_expiry <= 14 else
				"warning" if days_to_expiry <= 30 else
				"ok"
			)
		else:
			c["test_due_days"] = None
			c["test_status"] = "unknown"

		valid_list.append(c)

	return valid_list


# ---------------------------------------------------------------------------
# Container 360° Detail
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_container_360(container):
	"""Full detail for a single container: fields + last 10 ledger entries + open chargebacks."""
	if not frappe.has_permission("Containers", "read", container):
		frappe.throw("No permission")

	c = frappe.get_doc("Containers", container)
	today = getdate()

	data = {
		"name": c.name,
		"type": c.type,
		"status": c.status,
		"fill_status": c.fill_status,
		"owner_type": c.owner_type,
		"owner": c.owner_,
		"custodian": c.custodian,
		"custodian_type": c.custodian_type,
		"current_location": c.current_location,
		"test_due": str(c.test_due) if c.test_due else None,
		"holder_since": str(c.holder_since) if c.holder_since else None,
		"dispatch_date": str(c.dispatch_date) if c.dispatch_date else None,
		"current_item": c.current_item,
		"current_grade": c.current_grade,
		"current_qty": c.current__qty,
		"capacity": c.capacity,
		"last_filled": str(c.last_filled) if c.last_filled else None,
		"days_held": date_diff(today, getdate(c.holder_since)) if c.holder_since else 0,
	}

	if c.test_due:
		data["test_due_days"] = date_diff(getdate(c.test_due), today)

	# Last 10 ledger entries
	data["ledger"] = frappe.get_all(
		"Container Ledger Entry",
		filters={"container": container},
		fields=["name", "datetime", "entry_type", "movement_type", "source_location",
				"target_location", "party", "containers_movement", "is_cancelled", "status_before"],
		order_by="datetime desc",
		limit_page_length=10
	)

	# Last 5 movements
	data["movements"] = frappe.get_all(
		"Container Movements",
		filters=[
			["Container Movement Items", "container", "=", container]
		],
		fields=["name", "purpose", "transaction_date", "party", "docstatus"],
		order_by="transaction_date desc",
		limit_page_length=5
	)

	return data


# ---------------------------------------------------------------------------
# Generic Movement Creator (all 11 types)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def create_movement_generic(
	purpose, containers_json,
	party_type=None, party=None,
	expected_return_date=None,
	reference_doctype=None, reference_name=None
):
	"""
	Unified movement creator for all 11 movement types.
	containers_json: JSON array of {name, item_code, qty}
	"""
	container_list = json.loads(containers_json) if isinstance(containers_json, str) else containers_json

	if not container_list:
		frappe.throw("No containers selected")

	company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company")

	# Auto-resolve party from reference document if not provided
	if reference_doctype and reference_name and not party:
		if reference_doctype in ["Purchase Order", "Purchase Receipt"]:
			party_type = "Supplier"
			party = frappe.db.get_value(reference_doctype, reference_name, "supplier")
		elif reference_doctype in ["Sales Order", "Delivery Note", "Sales Invoice"]:
			party_type = "Customer"
			party = frappe.db.get_value(reference_doctype, reference_name, "customer")

	rows = []
	for c in container_list:
		container_name = c.get("name")
		c_info = frappe.db.get_value(
			"Containers", container_name,
			["type", "fill_status", "current_location"],
			as_dict=True
		) or {}

		# Make sure container document has current_location set
		if not c_info.get("current_location"):
			frappe.db.set_value("Containers", container_name, "current_location", "Plant Main Store")

		target_loc = party
		if purpose in ["Receive from Customer", "Receive from Supplier", "Return from Maintenance"]:
			target_loc = "Plant Main Store"
		elif purpose == "Move to Filling":
			target_loc = "Filling Station"
		elif purpose == "Return from Filling":
			target_loc = "Finished Goods Yard"
		elif purpose == "Move to Maintenance":
			target_loc = "Maintenance Shop"
		elif purpose == "Scrap / Decommission":
			target_loc = "Scrap Yard"
		elif not target_loc:
			target_loc = "Plant Main Store"

		rows.append({
			"doctype": "Container Movement Items",
			"container": container_name,
			"container_type": c_info.get("type"),
			"item_code": c.get("item_code"),
			"target_location": target_loc,
			"qty": flt(c.get("qty", 0)),
		})

	doc_data = {
		"doctype": "Container Movements",
		"purpose": purpose,
		"company": company,
		"transaction_date": nowdate(),
		"containers": rows,
	}

	if party_type:
		doc_data["party_type"] = party_type
	if party:
		doc_data["party"] = party
	if expected_return_date:
		doc_data["expected_return_date"] = expected_return_date
	if reference_doctype:
		doc_data["reference_document_type"] = reference_doctype
	if reference_name:
		doc_data["reference_document_name"] = reference_name

	movement = frappe.get_doc(doc_data)
	movement.insert(ignore_permissions=False)
	movement.submit()

	return {"name": movement.name, "purpose": purpose}


@frappe.whitelist()
def cancel_movement_entry(movement_name, reason=None):
	"""Cancel a submitted Container Movements document directly from movement entry page."""
	if not movement_name:
		frappe.throw("Movement name is required")

	if not frappe.has_permission("Container Movements", "cancel", movement_name):
		frappe.throw(f"No permission to cancel Container Movement {movement_name}")

	mov = frappe.get_doc("Container Movements", movement_name)
	if mov.docstatus != 1:
		frappe.throw(f"Movement {movement_name} is not in submitted state.")

	mov.cancel()

	if reason:
		mov.add_comment("Comment", f"Movement cancelled from Movement Entry workspace. Reason: {reason}")
		for item in mov.get("containers"):
			c_doc = frappe.get_doc("Containers", item.container)
			c_doc.add_comment("Comment", f"Movement {movement_name} cancelled. Reason: {reason}")

	return {"status": "success", "message": f"Movement {movement_name} cancelled successfully"}


@frappe.whitelist()
def register_and_receive_party_containers(
	party_type, party, item_code, container_type, qty,
	grade=None, current_qty=None, return_to_owner=None, test_due=None,
	reference_doctype=None, reference_name=None, **kwargs
):
	"""
	Quick register Party-owned containers (owner_type='Supplier' or 'Customer')
	with status='Filled' & fill_status='Filled' and auto-submit a Receive movement entry.
	"""
	if not party_type or party_type not in ["Supplier", "Customer"]:
		party_type = "Supplier"
	if not party:
		frappe.throw(f"{party_type} is required")
	if not container_type:
		frappe.throw("Container Type is required")

	qty = max(1, int(qty or 1))
	current_qty = flt(current_qty or 0)

	company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company")
	created_containers = []

	for i in range(qty):
		doc_dict = {
			"doctype": "Containers",
			"owner_type": party_type,
			"owner_": party,
			"type": container_type,
			"status": "Filled",
			"fill_status": "Filled",
			"current_item": item_code,
			"current_grade": grade,
			"current__qty": current_qty,
			"return_to_owner": return_to_owner,
			"current_location": "Plant Main Store",
			"custodian_type": "Company",
			"custodian": company,
			"naming_series": "CYL.-.#####"
		}
		if test_due:
			doc_dict["test_due"] = test_due

		c_doc = frappe.get_doc(doc_dict)
		c_doc.insert(ignore_permissions=True)
		created_containers.append(c_doc.name)

	purpose = f"Receive from {party_type}"
	mov_containers = [
		{
			"name": cname,
			"item_code": item_code,
			"grade": grade,
			"qty": current_qty
		}
		for cname in created_containers
	]

	res = create_movement_generic(
		purpose=purpose,
		containers_json=json.dumps(mov_containers),
		party_type=party_type,
		party=party,
		reference_doctype=reference_doctype,
		reference_name=reference_name
	)

	return {
		"status": "success",
		"message": f"Successfully registered {len(created_containers)} {party_type} container(s) and logged movement {res.get('name')}!",
		"created_containers": created_containers,
		"movement_name": res.get("name")
	}


@frappe.whitelist()
def register_and_receive_supplier_containers(
	supplier, item_code, container_type, qty,
	grade=None, current_qty=None, return_to_owner=None, test_due=None,
	reference_doctype=None, reference_name=None, **kwargs
):
	return register_and_receive_party_containers(
		party_type="Supplier",
		party=supplier,
		item_code=item_code,
		container_type=container_type,
		qty=qty,
		grade=grade,
		current_qty=current_qty,
		return_to_owner=return_to_owner,
		test_due=test_due,
		reference_doctype=reference_doctype,
		reference_name=reference_name
	)


# Location helper functions removed — party assignment is now handled
# directly by the Container Movements doctype controller



@frappe.whitelist()
def get_dn_filling_items(delivery_note):
	"""Return gas items, batch numbers, and requested volumes from a Delivery Note for Container Filling Entry."""
	if not delivery_note:
		return {"items": [], "customer": None}

	if not frappe.has_permission("Delivery Note", "read", delivery_note):
		frappe.throw("No permission")

	dn = frappe.get_doc("Delivery Note", delivery_note)

	items = []
	for item in dn.items:
		item_doc = frappe.get_cached_doc("Item", item.item_code)
		
		# Resolve batch_no from item line or Serial and Batch Bundle
		batch_no = item.get("batch_no")
		if not batch_no and item.get("serial_and_batch_bundle"):
			bundle_entries = frappe.get_all(
				"Serial and Batch Entry",
				filters={"parent": item.serial_and_batch_bundle},
				fields=["batch_no"]
			)
			if bundle_entries and bundle_entries[0].get("batch_no"):
				batch_no = bundle_entries[0].batch_no

		# Calculate currently filled volume for this DN item from submitted Container Filling Entries
		cfe_items = frappe.db.sql("""
			SELECT SUM(cfi.qty_filled) as filled_qty, COUNT(DISTINCT cfi.container) as cont_count
			FROM `tabContainer Filling Items` cfi
			JOIN `tabContainer Filling Entry` cfe ON cfe.name = cfi.parent
			WHERE cfe.delivery_note = %s AND cfe.item = %s AND cfe.docstatus = 1
		""", (delivery_note, item.item_code), as_dict=True)

		filled_qty = flt(cfe_items[0].filled_qty) if cfe_items and cfe_items[0].filled_qty else 0
		filled_conts = cfe_items[0].cont_count if cfe_items and cfe_items[0].cont_count else 0

		items.append({
			"item_code": item.item_code,
			"item_name": item_doc.item_name or item.item_code,
			"qty": flt(item.qty),
			"batch_no": batch_no or "",
			"serial_and_batch_bundle": item.get("serial_and_batch_bundle") or "",
			"filled_qty": filled_qty,
			"filled_conts": filled_conts,
			"pending_filling_qty": max(0, flt(item.qty) - filled_qty),
			"default_container_type": item_doc.get("custom_default_container_type")
		})

	return {
		"items": items,
		"customer": dn.customer
	}


# ---------------------------------------------------------------------------
# Filling Entry Creator
# ---------------------------------------------------------------------------

@frappe.whitelist()
def create_filling_entry(containers_json, item, qty_per_container=None, customer=None, delivery_note=None):
	"""
	Create a Container Filling Entry (and trigger its on_submit: ledger entry, stock entry).
	containers_json: array of {name, qty_filled, batch}
	"""
	container_list = json.loads(containers_json) if isinstance(containers_json, str) else containers_json

	if not container_list:
		frappe.throw("No containers provided for filling")

	total_qty = sum(flt(c.get("qty_filled", qty_per_container or 0)) for c in container_list)

	filling_items = []
	for c in container_list:
		filling_items.append({
			"doctype": "Container Filling Items",
			"container": c["name"],
			"qty_filled": flt(c.get("qty_filled", qty_per_container or 0)),
			"batch": c.get("batch"),
		})

	cfe_data = {
		"doctype": "Container Filling Entry",
		"posting_date": nowdate(),
		"item": item,
		"quantity_posted": total_qty,
		"operator": frappe.session.user,
		"container_filling_items": filling_items,
	}

	if customer:
		cfe_data["customer"] = customer
	if delivery_note:
		cfe_data["delivery_note"] = delivery_note

	# Temporarily make customer/delivery_note optional at validation level
	cfe = frappe.get_doc(cfe_data)

	try:
		cfe.insert(ignore_permissions=True)
		cfe.submit()
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Filling Entry Creation Failed")
		frappe.throw(f"Failed to create Filling Entry: {str(e)}")

	# Also create Move to Filling + Return from Filling movements
	container_names = [c["name"] for c in container_list]
	_create_filling_movements(container_names, cfe.name)

	return {"name": cfe.name}


def _create_filling_movements(container_names, cfe_name):
	"""Auto-create Move to Filling → Return from Filling movement pair."""
	company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company")

	for purpose in ["Move to Filling", "Return from Filling"]:
		rows = []
		for cname in container_names:
			c_type = frappe.db.get_value("Containers", cname, "type")

			rows.append({
				"doctype": "Container Movement Items",
				"container": cname,
				"container_type": c_type,
				"qty": 0,
			})

		try:
			mov = frappe.get_doc({
				"doctype": "Container Movements",
				"purpose": purpose,
				"company": company,
				"transaction_date": nowdate(),
				"reference_document_type": "Container Filling Entry",
				"reference_document_name": cfe_name,
				"containers": rows,
			})
			mov.insert(ignore_permissions=True)
			mov.submit()
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Auto {purpose} movement failed for CFE {cfe_name}")

			frappe.log_error(frappe.get_traceback(), f"Auto {purpose} movement failed for CFE {cfe_name}")


# ---------------------------------------------------------------------------
# Holdings (Days Held) View
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_holdings(party_type=None, min_days=0):
	"""
	Return our containers currently held by customers/suppliers with days-held data.
	party_type: 'Customer' or 'Supplier' or None (both)
	"""
	filters = {
		"status": ["in", ["With Customer", "With Supplier"]],
		"owner_type": "Company",
		"docstatus": ["<", 2],
	}
	if party_type == "Customer":
		filters["status"] = "With Customer"
	elif party_type == "Supplier":
		filters["status"] = "With Supplier"

	containers = frappe.get_all(
		"Containers",
		filters=filters,
		fields=[
			"name", "type", "status", "fill_status",
			"custodian", "custodian_type",
			"holder_since", "dispatch_date",
			"test_due", "current_item", "current_location"
		],
		order_by="holder_since asc"
	)

	today = getdate()
	results = []
	for c in containers:
		days_held = date_diff(today, getdate(c.holder_since)) if c.holder_since else 0
		if days_held < int(min_days):
			continue

		c["days_held"] = days_held
		c["urgency"] = (
			"overdue" if days_held >= 30 else
			"warning" if days_held >= 15 else
			"ok"
		)
		if c.test_due:
			c["test_due_days"] = date_diff(getdate(c.test_due), today)
		else:
			c["test_due_days"] = None
		results.append(c)

	return results


# ---------------------------------------------------------------------------
# Existing methods kept intact for backward compatibility
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_document_items(doctype, docname):
	if not frappe.has_permission(doctype, "read", docname):
		frappe.throw("No permission")

	doc = frappe.get_doc(doctype, docname)

	items = []
	for item in doc.items:
		item_doc = frappe.get_cached_doc("Item", item.item_code)
		if item_doc.get("custom_requires_container"):
			movements = frappe.get_all("Container Movements",
				filters={
					"reference_document_type": doctype,
					"reference_document_name": docname,
					"docstatus": ("<", 2)
				},
				fields=["name"]
			)

			handled_volume = 0
			handled_containers_count = 0
			if movements:
				movement_names = [m.name for m in movements]
				movement_items = frappe.get_all("Container Movement Items",
					filters={
						"parent": ("in", movement_names),
						"item_code": item.item_code
					},
					fields=["container", "container_type"]
				)

				handled_containers_count = len(movement_items)

				if movement_items:
					types = list(set([m.container_type for m in movement_items if m.container_type]))
					if types:
						max_fills = {}
						matrices = frappe.get_all("Item Capacity Matrix",
							filters={"parent": ["in", types], "item": item.item_code},
							fields=["parent", "max_fill"]
						)
						for m in matrices:
							max_fills[m.parent] = m.max_fill

						type_doc_capacities = {}
						t_docs = frappe.get_all("Container Types", filters={"name": ["in", types]}, fields=["name", "fill_capacity"])
						for td in t_docs:
							type_doc_capacities[td.name] = flt(td.fill_capacity)

						for mi in movement_items:
							cap = max_fills.get(mi.container_type) or type_doc_capacities.get(mi.container_type) or 0
							handled_volume += cap

			items.append({
				"item_code": item.item_code,
				"qty": item.qty,
				"default_container_type": item_doc.get("custom_default_container_type"),
				"handled_qty": handled_volume,
				"handled_containers": handled_containers_count
			})

	return items


@frappe.whitelist()
def get_available_company_containers(item_code, container_type=None, reference_name=None, limit=None):
	filters = {
		"owner_type": "Company",
		"status": ["in", ["Available", "Reserved"]],
		"fill_status": "Empty",
		"docstatus": 0
	}
	if container_type and container_type != "null" and container_type != "undefined":
		filters["type"] = container_type

	containers = frappe.get_all("Containers",
		filters=filters,
		fields=["name", "test_due", "current_location", "type", "owner_type", "fill_status", "status", "custodian"],
		limit_page_length=max(1, int(flt(limit))) if limit else 100
	)

	container_types = list(set([c.type for c in containers if c.type]))
	max_fills = {}
	type_doc_capacities = {}
	if container_types:
		matrices = frappe.get_all("Item Capacity Matrix",
			filters={"parent": ["in", container_types], "item": item_code},
			fields=["parent", "max_fill"]
		)
		for m in matrices:
			max_fills[m.parent] = m.max_fill

		t_docs = frappe.get_all("Container Types", filters={"name": ["in", container_types]}, fields=["name", "fill_capacity"])
		for td in t_docs:
			type_doc_capacities[td.name] = flt(td.fill_capacity)

	from frappe.utils import getdate, nowdate
	valid_containers = []
	today = getdate(nowdate())

	for c in containers:
		if c.test_due and getdate(c.test_due) < today:
			continue

		cap = max_fills.get(c.type) or type_doc_capacities.get(c.type) or 0
		if not cap:
			continue

		# If reserved, verify if reserved for this document
		if c.status == "Reserved":
			res_doc = frappe.db.sql("""
				SELECT cre.reference_document_name, cre.party
				FROM `tabContainer Reservation Entry` cre
				JOIN `tabContainer Reservation Item` cri ON cri.parent = cre.name
				WHERE cri.container = %s
				  AND cre.docstatus = 1
				  AND cre.status = 'Active'
				LIMIT 1
			""", (c.name,), as_dict=True)

			if res_doc:
				reserved_ref = res_doc[0].reference_document_name
				if reference_name and reserved_ref and reserved_ref != reference_name:
					continue  # Reserved for a different document!

		c["capacity"] = cap
		valid_containers.append(c)

	return valid_containers


@frappe.whitelist()
def get_filled_containers_for_item(item_code, container_type=None, party=None, limit=300):
	"""Return filled containers matching gas item for dispatch to customer."""
	from frappe.utils import getdate, nowdate
	today = getdate(nowdate())

	filters = {"docstatus": ["<", 2]}
	containers = frappe.get_all("Containers",
		filters=filters,
		fields=[
			"name", "type", "status", "fill_status", "owner_type", "owner_",
			"custodian", "custodian_type", "current_location", "test_due",
			"holder_since", "dispatch_date", "current_item", "current_grade",
			"current__qty", "capacity", "last_filled"
		],
		limit_page_length=int(flt(limit)) if limit else 300
	)

	valid_container_types = set()
	if item_code:
		matrix_types = frappe.get_all("Item Capacity Matrix", filters={"item": item_code}, pluck="parent")
		if matrix_types:
			valid_container_types.update(matrix_types)
		default_type = frappe.db.get_value("Item", item_code, "custom_default_container_type")
		if default_type:
			valid_container_types.add(default_type)

	valid_containers = []
	for c in containers:
		# 1. Must NOT be Empty (fill_status != 'Empty')
		if c.fill_status == "Empty":
			continue

		# 2. Status must be Filled (or Available if filled)
		if c.status not in ["Filled", "Available"]:
			continue

		# 3. Exclude test_due expired containers
		if c.test_due and getdate(c.test_due) < today:
			continue

		# 4. Owner filter: Must be Company owned OR Customer owned matching party
		if c.owner_type == "Customer" and party and c.owner_ != party:
			continue

		# 5. Item Code matching
		if not c.get("current_item"):
			last_item = frappe.db.sql("""
				SELECT mi.item_code 
				FROM `tabContainer Movement Items` mi
				JOIN `tabContainer Movements` cm ON cm.name = mi.parent
				WHERE mi.container = %s AND cm.docstatus = 1 AND mi.item_code IS NOT NULL AND mi.item_code != ''
				ORDER BY cm.transaction_date DESC, cm.creation DESC
				LIMIT 1
			""", (c.name,), as_dict=True)
			if last_item:
				c["current_item"] = last_item[0].item_code

		if item_code:
			is_item_match = (c.get("current_item") == item_code)
			is_type_match = (valid_container_types and c.get("type") in valid_container_types)
			if not is_item_match and not is_type_match:
				continue
			if container_type and c.get("type") != container_type:
				continue

		c["max_fill"] = c.get("current__qty") or c.get("capacity") or 0
		valid_containers.append(c)

	return valid_containers


@frappe.whitelist()
def create_outbound_movement(doctype, docname, item_code, containers):
	"""Legacy method — delegates to create_movement_generic."""
	if not frappe.has_permission(doctype, "read", docname):
		frappe.throw("No permission")

	container_list = json.loads(containers) if isinstance(containers, str) else containers
	supplier = frappe.db.get_value(doctype, docname, "supplier")
	if not supplier:
		frappe.throw(f"Could not find a Supplier on {doctype} {docname}")

	for c in container_list:
		c["item_code"] = item_code

	return create_movement_generic(
		purpose="Send to Supplier",
		containers_json=json.dumps(container_list),
		party_type="Supplier",
		party=supplier,
		reference_doctype=doctype,
		reference_name=docname,
	)


@frappe.whitelist()
def check_supplier_shipment(po_name, item_code):
	if not po_name:
		return {"found": False}

	if not frappe.has_permission("Purchase Order", "read", po_name):
		frappe.throw("No permission")

	pr_items = frappe.get_all("Purchase Receipt Item",
		filters={"purchase_order": po_name, "item_code": item_code, "docstatus": ("<", 2)},
		fields=["parent", "qty", "received_qty", "docstatus"]
	)

	if not pr_items:
		return {"found": False}

	unique_prs = list(set([pri.parent for pri in pr_items if pri.parent]))
	receipts = []
	for pr_name in unique_prs:
		pr_doc = frappe.get_value("Purchase Receipt", pr_name, ["name", "docstatus", "posting_date", "supplier"], as_dict=True)
		if pr_doc:
			receipts.append({
				"name": pr_doc.name,
				"docstatus": pr_doc.docstatus,
				"posting_date": str(pr_doc.posting_date),
				"supplier": pr_doc.supplier
			})

	return {"found": True, "receipts": receipts}


@frappe.whitelist()
def receive_dispatched_containers(po_name, pr_name, target_location, containers):
	if not frappe.has_permission("Purchase Receipt", "read", pr_name):
		frappe.throw("No permission to read Purchase Receipt")

	container_list = json.loads(containers) if isinstance(containers, str) else containers
	if not container_list:
		frappe.throw("No containers provided")

	pr_doc = frappe.get_cached_doc("Purchase Receipt", pr_name)
	supplier = pr_doc.supplier

	return create_movement_generic(
		purpose="Receive from Supplier",
		containers_json=json.dumps([{
			"name": c["name"],
			"item_code": c.get("item_code"),
		} for c in container_list]),
		party_type="Supplier",
		party=supplier,
		reference_doctype="Purchase Receipt",
		reference_name=pr_name,
	)


@frappe.whitelist()
def get_dispatched_containers(doctype=None, docname=None, party_type=None, party=None):
	if doctype and docname:
		if not frappe.has_permission(doctype, "read", docname):
			frappe.throw("No permission")

	ref_doc_names = [docname] if docname else []
	party_field = None

	if doctype:
		if doctype in ["Purchase Order", "Purchase Receipt"]:
			party_type = "Supplier"
			party_field = "supplier"
			if doctype == "Purchase Order":
				ref_doc_names = [docname]
			elif doctype == "Purchase Receipt" and docname:
				pr_items = frappe.get_all("Purchase Receipt Item", filters={"parent": docname}, fields=["purchase_order"])
				po_names = list(set([i.purchase_order for i in pr_items if i.purchase_order]))
				ref_doc_names = list(set([docname] + po_names))
		elif doctype in ["Sales Order", "Delivery Note", "Sales Invoice"]:
			party_type = "Customer"
			party_field = "customer"
			if doctype == "Sales Order":
				ref_doc_names = [docname]
			elif doctype == "Delivery Note" and docname:
				dn_items = frappe.get_all("Delivery Note Item", filters={"parent": docname}, fields=["against_sales_order"])
				so_names = list(set([i.against_sales_order for i in dn_items if i.against_sales_order]))
				ref_doc_names = list(set([docname] + so_names))
			elif doctype == "Sales Invoice":
				ref_doc_names = [docname]

	# Safely fetch party if party_field is defined for doctype
	if doctype and docname and party_field and not party:
		party = frappe.db.get_value(doctype, docname, party_field)

	# Fetch items present in this document
	doc_item_codes = set()
	if doctype and docname:
		doc_items = frappe.get_all(f"{doctype} Item", filters={"parent": docname}, fields=["item_code"])
		doc_item_codes = set([di.item_code for di in doc_items if di.item_code])

	filters = {"docstatus": 1}
	if ref_doc_names and any(ref_doc_names):
		filters["reference_document_name"] = ("in", ref_doc_names)
	elif party:
		filters["party"] = party

	movements = frappe.get_all("Container Movements",
		filters=filters,
		fields=["name", "transaction_date"],
		order_by="transaction_date desc",
		limit_page_length=50
	)

	dispatched = []
	seen_containers = set()

	if movements:
		movement_names = [m.name for m in movements]
		items = frappe.get_all("Container Movement Items",
			filters={"parent": ("in", movement_names)},
			fields=["parent", "container", "container_type", "item_code"]
		)

		movement_dates = {m.name: m.transaction_date for m in movements}

		for item in items:
			if doc_item_codes and item.item_code and item.item_code not in doc_item_codes:
				continue

			c_info = frappe.db.get_value("Containers", item.container,
				["status", "current_item", "test_due", "return_to_owner", "custodian", "current_location"], as_dict=True) or {}

			res = frappe.db.sql("""
				SELECT cre.name, cre.reserved_until_date
				FROM `tabContainer Reservation Entry` cre
				JOIN `tabContainer Reservation Item` cri ON cri.parent = cre.name
				WHERE cri.container = %s AND cre.docstatus = 1 AND cre.status = 'Active'
				LIMIT 1
			""", (item.container,), as_dict=True)

			is_res = bool(res) or (c_info.get("status") == "Reserved")
			res_until = str(res[0].reserved_until_date) if res and res[0].reserved_until_date else (str(c_info.get("return_to_owner")) if c_info.get("return_to_owner") else None)

			dispatched.append({
				"movement": item.parent,
				"date": str(movement_dates.get(item.parent)) if movement_dates.get(item.parent) else "-",
				"container": item.container,
				"container_type": item.container_type,
				"item_code": item.item_code or c_info.get("current_item"),
				"status": c_info.get("status"),
				"test_due": str(c_info.get("test_due")) if c_info.get("test_due") else None,
				"is_reserved": is_res,
				"return_to_owner": res_until,
				"custodian": c_info.get("custodian"),
				"current_location": c_info.get("current_location")
			})
			seen_containers.add(item.container)

	# Include containers actively reserved specifically for this document
	if docname:
		res_containers = frappe.db.sql("""
			SELECT cri.container, cri.item_code, cre.reserved_until_date, cre.party
			FROM `tabContainer Reservation Entry` cre
			JOIN `tabContainer Reservation Item` cri ON cri.parent = cre.name
			WHERE cre.reference_document_name = %s
			  AND cre.docstatus = 1
			  AND cre.status = 'Active'
		""", (docname,), as_dict=True)

		for rc in res_containers:
			if rc.container in seen_containers:
				continue
			if doc_item_codes and rc.item_code and rc.item_code not in doc_item_codes:
				continue

			c_info = frappe.db.get_value("Containers", rc.container,
				["status", "type", "current_item", "test_due", "dispatch_date", "custodian", "current_location"], as_dict=True) or {}

			dispatched.append({
				"movement": "-",
				"date": str(c_info.get("dispatch_date")) if c_info.get("dispatch_date") else "-",
				"container": rc.container,
				"container_type": c_info.get("type"),
				"item_code": rc.item_code or c_info.get("current_item"),
				"status": c_info.get("status") or "Reserved",
				"test_due": str(c_info.get("test_due")) if c_info.get("test_due") else None,
				"is_reserved": True,
				"return_to_owner": str(rc.reserved_until_date) if rc.reserved_until_date else None,
				"custodian": rc.party or c_info.get("custodian"),
				"current_location": c_info.get("current_location")
			})
			seen_containers.add(rc.container)

	receipts = []
	if doctype == "Purchase Order":
		pr_items = frappe.get_all("Purchase Receipt Item",
			filters={"purchase_order": docname, "docstatus": 1},
			fields=["parent"]
		)
		if pr_items:
			receipts = list(set([pri.parent for pri in pr_items if pri.parent]))
	elif doctype == "Purchase Receipt":
		receipts = [docname]

	return {"dispatched": dispatched, "receipts": receipts}
