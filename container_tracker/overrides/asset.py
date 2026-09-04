import frappe
from frappe import _

def create_container_on_submit(doc, method):
	if not doc.asset_category:
		return
		
	# Check if this asset category is configured for container tracking
	asset_category = frappe.get_doc("Asset Category", doc.asset_category)
	
	if asset_category.get("is_tracked_container_or_cylinder"):
		# Ensure we have the required custom fields configured
		container_type_name = asset_category.get("custom_default_container_type")
		naming_series = asset_category.get("custom_naming_series")
		
		if not container_type_name:
			frappe.msgprint(_("Asset Category {0} is marked as a tracked container but missing 'Default Container Type'").format(doc.asset_category))
			return
			
		container_type = frappe.get_doc("Container Types", container_type_name)
		
		# Create exactly one Container record per Asset
		container = frappe.new_doc("Containers")
		container.asset = doc.name
		container.type = container_type.name
		container.gas_item = container_type.default_gas_item
		container.status = "Available"
		container.fit_to_fill = "Empty : ready"
		container.custodian = "Plant"
		
		if naming_series:
			container.naming_series = naming_series
			
		# Insert the container. It is a submittable doctype, so we submit it
		container.insert(ignore_permissions=True)
		container.submit()
		
		frappe.msgprint(_("Successfully created Container {0} linked to Asset {1}").format(container.name, doc.name), alert=True)
