import frappe

@frappe.whitelist()
def get_asset_categories():
    categories = frappe.get_all("Asset Category", 
        fields=["name", "is_tracked_container_or_cylinder", "custom_default_container_type", "custom_naming_series"]
    )
    
    # Get counts of linked containers
    containers = frappe.get_all("Containers", fields=["asset_category"])
    counts = {}
    for c in containers:
        cat = c.get("asset_category")
        if cat:
            counts[cat] = counts.get(cat, 0) + 1
            
    for cat in categories:
        cat["linked_containers"] = counts.get(cat.name, 0)
        
    return categories
