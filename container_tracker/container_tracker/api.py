import frappe
from frappe.utils import get_first_day, get_last_day, today

@frappe.whitelist()
def get_filling_vs_returns(*args, **kwargs):
    start_date = get_first_day(today(), "week")
    end_date = get_last_day(today(), "week")
    
    fillings = frappe.db.sql("""
        SELECT DAYOFWEEK(posting_date) as day_num, SUM(used_containers_count) as qty
        FROM `tabContainer Filling Entry`
        WHERE posting_date BETWEEN %s AND %s AND docstatus = 1
        GROUP BY DAYOFWEEK(posting_date)
    """, (start_date, end_date), as_dict=True)
    
    returns = frappe.db.sql("""
        SELECT DAYOFWEEK(posting_date) as day_num, SUM(containers_received) as qty
        FROM `tabReconciliation`
        WHERE posting_date BETWEEN %s AND %s AND docstatus = 1
        GROUP BY DAYOFWEEK(posting_date)
    """, (start_date, end_date), as_dict=True)
    
    filling_map = {d.day_num: d.qty for d in fillings}
    returns_map = {d.day_num: d.qty for d in returns}
    
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_nums = [2, 3, 4, 5, 6, 7, 1]
    
    filling_values = [filling_map.get(day, 0) for day in day_nums]
    returns_values = [returns_map.get(day, 0) for day in day_nums]
    
    return {
        "labels": labels,
        "datasets": [
            {"name": "Containers filled", "values": filling_values},
            {"name": "Containers returned", "values": returns_values}
        ]
    }

@frappe.whitelist()
def get_utilisation_by_type(*args, **kwargs):
    data = frappe.db.sql("""
        SELECT type as container_type,
               SUM(CASE WHEN status = 'With Customer' THEN 1 ELSE 0 END) as at_customer,
               SUM(CASE WHEN status != 'With Customer' THEN 1 ELSE 0 END) as in_plant
        FROM `tabContainers`
        GROUP BY type
    """, as_dict=True)
    
    labels = [d.container_type for d in data]
    at_customer_values = [d.at_customer for d in data]
    in_plant_values = [d.in_plant for d in data]
    
    return {
        "labels": labels,
        "datasets": [
            {"name": "At customer", "values": at_customer_values},
            {"name": "In plant", "values": in_plant_values}
        ]
    }

@frappe.whitelist()
def get_aging_of_containers(*args, **kwargs):
    data = frappe.db.sql("""
        SELECT 
            CASE 
                WHEN DATEDIFF(CURDATE(), modified) <= 15 THEN '0-15 days'
                WHEN DATEDIFF(CURDATE(), modified) <= 30 THEN '16-30 days'
                WHEN DATEDIFF(CURDATE(), modified) <= 60 THEN '31-60 days'
                WHEN DATEDIFF(CURDATE(), modified) <= 90 THEN '61-90 days'
                ELSE '90+ days'
            END as age_bucket,
            count(name) as value
        FROM `tabContainers`
        WHERE status = 'With Customer'
        GROUP BY age_bucket
    """, as_dict=True)
    
    buckets = ["0-15 days", "16-30 days", "31-60 days", "61-90 days", "90+ days"]
    data_map = {d.age_bucket: d.value for d in data}
    values = [data_map.get(b, 0) for b in buckets]
    
    return {
        "labels": buckets,
        "datasets": [
            {"name": "Containers", "values": values}
        ]
    }
