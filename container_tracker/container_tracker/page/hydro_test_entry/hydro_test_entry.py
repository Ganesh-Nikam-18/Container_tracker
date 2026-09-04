import frappe
from frappe.utils import today, add_days, add_months, getdate, cint
import json

@frappe.whitelist()
def get_dashboard_data():
    current_date = today()
    sixty_days_from_now = add_days(current_date, 60)
    
    # Overdue
    overdue_count = frappe.db.count("Containers", filters={
        "docstatus": 1,
        "test_due": ["<", current_date],
        "status": ["in", ["Available", "Under Maintenance"]]
    })
    
    # Due in 60 days
    due_in_60_count = frappe.db.count("Containers", filters={
        "docstatus": 1,
        "test_due": ["between", [current_date, sixty_days_from_now]],
        "status": ["in", ["Available", "Under Maintenance"]]
    })
    
    # Recent test entries
    recent_tests = frappe.get_all("Hydro Test", 
        fields=["name", "creation", "test_agency_bay", "certificate_no"],
        order_by="creation desc",
        limit_page_length=5
    )
    
    # Enrich recent tests with container count and pass/fail summary
    for test in recent_tests:
        items = frappe.get_all("CHT Items", filters={"parent": test.name}, fields=["result"])
        test["containers_count"] = len(items)
        if items:
            failed = any(i.result != "Pass" for i in items)
            test["result_mix"] = "Fail" if failed else "Pass"
        else:
            test["result_mix"] = "N/A"
            
    return {
        "overdue": overdue_count,
        "due_in_60": due_in_60_count,
        "recent_tests": recent_tests
    }

@frappe.whitelist()
def get_pending_containers(container_type=None):
    current_date = today()
    sixty_days_from_now = add_days(current_date, 60)
    
    filters = {
        "docstatus": 1,
        "test_due": ["<=", sixty_days_from_now],
        "status": ["in", ["Available", "Under Maintenance"]]
    }
    
    if container_type and container_type != "All container types":
        filters["type"] = container_type
        
    containers = frappe.get_all("Containers", 
        filters=filters,
        fields=["name", "type", "test_due"],
        order_by="test_due asc"
    )
    
    for c in containers:
        due_date = getdate(c.test_due)
        today_date = getdate(current_date)
        delta = (due_date - today_date).days
        if delta < 0:
            c["due_status"] = f"overdue by {abs(delta)}d"
            c["due_class"] = "text-danger"
        else:
            c["due_status"] = f"in {delta}d"
            c["due_class"] = "text-warning"
            
    return containers

@frappe.whitelist()
def get_container_details(container_id):
    if not frappe.db.exists("Containers", {"name": container_id, "docstatus": 1, "status": ["in", ["Available", "Under Maintenance"]]}):
        frappe.throw(f"Container {container_id} is either invalid, cancelled, or not in a valid status for testing.")
        
    container = frappe.get_doc("Containers", container_id)
    container_type = frappe.get_doc("Container Types", container.type)
    
    return {
        "name": container.name,
        "type": container.type,
        "tare_weight": container_type.tare_weight,
        "hydro_test_interval": container_type.hydro_test_interval
    }

@frappe.whitelist()
def submit_hydro_test(payload):
    data = json.loads(payload)
    
    # 1. Create Hydro Test document
    hydro_test = frappe.new_doc("Hydro Test")
    hydro_test.test_agency_bay = data.get("test_agency_bay")
    hydro_test.inspector = data.get("inspector")
    hydro_test.certificate_no = data.get("certificate_no")
    
    for item in data.get("items", []):
        hydro_test.append("containers_under_test", {
            "containers": item.get("container"),
            "type": item.get("type"),
            "test_pressure": item.get("test_pressure"),
            "tare_before": item.get("tare_before"),
            "tare_after": item.get("tare_after"),
            "perm_expansion": item.get("perm_expansion"),
            "result": item.get("result"),
            "next_test_due": item.get("next_test_due"),
            "test_remark": item.get("remarks")
        })
        
    hydro_test.insert(ignore_permissions=True)
    hydro_test.submit()
    
    # 2. Update individual Containers based on results
    current_date = today()
    for row in hydro_test.containers_under_test:
        container = frappe.get_doc("Containers", row.containers)
        
        if row.result == "Pass":
            container.test_due = row.next_test_due
        elif row.result == "Fail - Repair":
            container.status = "Under Maintenance"
        elif row.result == "Fail - Condemn":
            container.status = "Scrapped"
            
        container.save(ignore_permissions=True)
        
    return hydro_test.name
