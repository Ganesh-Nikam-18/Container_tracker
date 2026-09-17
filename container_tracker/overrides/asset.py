import frappe
from frappe import _

def create_container_on_submit(doc, method):
	if not doc.asset_category:
		return
		
	asset_category = frappe.get_doc("Asset Category", doc.asset_category)
	
	if asset_category.get("is_tracked_container_or_cylinder"):
		container_type_name = asset_category.get("custom_default_container_type")
		naming_series = asset_category.get("custom_naming_series")
		
		if not container_type_name:
			frappe.msgprint(_("Asset Category {0} is marked as a tracked container but missing 'Default Container Type'").format(doc.asset_category))
			return
			
		container_type = frappe.get_doc("Container Types", container_type_name)
		
		qty = int(doc.asset_quantity) if getattr(doc, "asset_quantity", None) else 1
		
		created_containers = []
		try:
			for i in range(qty):
				container = frappe.new_doc("Containers")
				container.asset = doc.name
				container.type = container_type.name
				container.gas_item = container_type.default_gas_item
				container.status = "Available"
				container.fit_to_fill = "Empty : ready"
				container.custodian = "Plant"
				
				if container_type.get("hydro_test_interval"):
					from frappe.utils import add_months, getdate, today
					start_date = doc.get("available_for_use_date") or doc.get("purchase_date") or getdate(today())
					container.test_due = add_months(start_date, int(container_type.hydro_test_interval))
				
				if naming_series:
					container.naming_series = naming_series
					
				container.insert(ignore_permissions=True)
				container.submit()
				created_containers.append(container.name)
				
			if created_containers:
				frappe.msgprint(_("Successfully created {0} Container(s) linked to Asset {1}").format(qty, doc.name), alert=True)
		except Exception as e:
			frappe.log_error(message=frappe.get_traceback(), title="Container Creation Failed from Asset")
			frappe.msgprint(_("Failed to create containers for Asset {0}. Check the Error Log for details.").format(doc.name), indicator="red", alert=True)
			raise
