import frappe
from frappe.utils import add_days, getdate, today

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    return [
        {"fieldname": "record_type", "label": "Record Type", "fieldtype": "Data", "width": 140},
        {"fieldname": "day_of_week", "label": "Day of Week", "fieldtype": "Data", "width": 100},
        {"fieldname": "status", "label": "Status", "fieldtype": "Data", "width": 120},
        {"fieldname": "filled_qty", "label": "Filled Qty", "fieldtype": "Float", "width": 100},
        {"fieldname": "returned_qty", "label": "Returned Qty", "fieldtype": "Float", "width": 100},
        {"fieldname": "container_type", "label": "Container Type", "fieldtype": "Link", "options": "Container Types", "width": 140},
        {"fieldname": "at_customer", "label": "At Customer", "fieldtype": "Int", "width": 100},
        {"fieldname": "in_plant", "label": "In Plant", "fieldtype": "Int", "width": 100},
        {"fieldname": "aging_bucket", "label": "Aging Bucket", "fieldtype": "Data", "width": 120},
        {"fieldname": "container_count", "label": "Container Count", "fieldtype": "Int", "width": 120}
    ]

def get_data(filters):
    data = []
    target = filters.get("target_chart") if filters else None
    
    # 1. Fillings & Returns (Daily Transactions for current week or selected dates)
    if not target or target == "Filling vs Returns":
        current_date = getdate(today())
        
        if filters and filters.get("from_date"):
            start_date = filters.get("from_date")
        else:
            start_date = add_days(current_date, -current_date.weekday())
            
        if filters and filters.get("to_date"):
            end_date = filters.get("to_date")
        else:
            end_date = add_days(start_date, 6)
        
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
        
        days = {2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat", 1: "Sun"}
        
        filling_map = {d.day_num: d.qty for d in fillings}
        returns_map = {d.day_num: d.qty for d in returns}
        
        day_nums = [2, 3, 4, 5, 6, 7, 1]
        
        for day_num in day_nums:
            day_str = days[day_num]
            f_qty = filling_map.get(day_num, 0)
            r_qty = returns_map.get(day_num, 0)
            
            data.append({
                "record_type": "Weekly Trend",
                "day_of_week": day_str,
                "status": "",
                "filled_qty": f_qty,
                "returned_qty": r_qty,
                "container_type": "",
                "at_customer": 0,
                "in_plant": 0,
                "aging_bucket": "",
                "container_count": 0
            })
            
    # 2. Container States (For Fleet Status, Utilisation & Aging)
    if not target or target in ["Fleet Status", "Utilisation", "Aging"]:
        containers = frappe.db.sql("""
            SELECT 
                type as container_type,
                status,
                CASE 
                    WHEN DATEDIFF(CURDATE(), modified) <= 15 THEN '0-15 days'
                    WHEN DATEDIFF(CURDATE(), modified) <= 30 THEN '16-30 days'
                    WHEN DATEDIFF(CURDATE(), modified) <= 60 THEN '31-60 days'
                    WHEN DATEDIFF(CURDATE(), modified) <= 90 THEN '61-90 days'
                    ELSE '90+ days'
                END as age_bucket,
                COUNT(name) as qty
            FROM `tabContainers`
            GROUP BY type, status, age_bucket
        """, as_dict=True)
        
        for c in containers:
            # If the dashboard chart is Aging, we ONLY want 'With Customer' containers
            # otherwise it plots blank aging_buckets for in-plant containers!
            if target == "Aging" and c.status != 'With Customer':
                continue
                
            at_cust = c.qty if c.status == 'With Customer' else 0
            in_pl = c.qty if c.status != 'With Customer' else 0
            age_buck = c.age_bucket if c.status == 'With Customer' else ""
            
            data.append({
                "record_type": "Container Snapshot",
                "day_of_week": "",
                "status": c.status,
                "filled_qty": 0,
                "returned_qty": 0,
                "container_type": c.container_type,
                "at_customer": at_cust,
                "in_plant": in_pl,
                "aging_bucket": age_buck,
                "container_count": c.qty
            })
        
    return data
