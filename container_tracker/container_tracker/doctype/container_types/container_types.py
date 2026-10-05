# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class ContainerTypes(Document):
    def on_update(self):
        # Sync the updated fill_capacity to all linked Containers
        if self.has_value_changed("fill_capacity"):
            frappe.db.sql("""
                UPDATE `tabContainers` 
                SET capacity = %s 
                WHERE type = %s
            """, (self.fill_capacity, self.name))
            
            # Log it for clarity
            count = frappe.db.sql("SELECT ROW_COUNT()")[0][0]
            if count > 0:
                frappe.msgprint(f"Successfully updated capacity for {count} linked containers.")

@frappe.whitelist()
def get_linked_containers_count(container_type):
    return frappe.db.count("Containers", {"type": container_type})
