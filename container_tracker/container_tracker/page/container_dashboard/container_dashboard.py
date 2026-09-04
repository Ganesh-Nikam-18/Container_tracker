import frappe
from frappe.utils import add_days, today

@frappe.whitelist()
def get_dashboard_data():
    data = {}
    
    # 1. Number Cards Data
    data['number_cards'] = get_number_cards_data()
    
    # 2. Fleet status split
    data['fleet_status_split'] = get_fleet_status_split()
    
    # 3. Filling vs Returns
    data['filling_vs_returns'] = get_filling_vs_returns()
    
    # 4. Utilisation by type
    data['utilisation_by_type'] = get_utilisation_by_type()
    
    # 5. Aging of containers
    data['aging_of_containers'] = get_aging_of_containers()
    
    # 6. Customer holding summary
    data['customer_holding_summary'] = get_customer_holding_summary()
    
    # 7. Recent filling entries
    data['recent_filling_entries'] = get_recent_filling_entries()
    
    # 8. Damage & loss flagged on receipt
    data['damage_and_loss'] = get_damage_and_loss()
    
    return data

def get_number_cards_data():
    total_containers = frappe.db.count('Containers')
    available_to_fill = frappe.db.count('Containers', {'status': 'Available'})
    with_customers = frappe.db.count('Containers', {'status': 'With Customer'})
    damaged_under_repair = frappe.db.count('Containers', {'status': ['in', ['Damaged', 'Under Maintenance']]})
    filled_awaiting_dispatch = frappe.db.count('Containers', {'status': 'Filled'})
    open_chargebacks = frappe.db.count('Chargebacks', {'docstatus': 1, 'amount': ['>', 0]}) # Assuming outstanding
    
    # Hydro test due in 90 days
    hydro_due = frappe.db.count('Containers', {'test_due': ['between', [today(), add_days(today(), 90)]]})
    
    # Deposit exposure
    # Let's aggregate based on unreturned containers (With Customer) x estimated deposit
    # If no explicit deposit amount, we will use a dummy total for now or calculate if possible.
    deposit_exposure = frappe.db.sql("""
        SELECT SUM(c.capacity * 1000) as total 
        FROM `tabContainers` c 
        WHERE c.status = 'With Customer'
    """, as_dict=True)[0].get('total') or 0
    
    return {
        'total_containers': total_containers,
        'available_to_fill': available_to_fill,
        'with_customers': with_customers,
        'damaged_under_repair': damaged_under_repair,
        'filled_awaiting_dispatch': filled_awaiting_dispatch,
        'open_chargebacks': open_chargebacks,
        'hydro_test_due': hydro_due,
        'deposit_exposure': deposit_exposure
    }

def get_fleet_status_split():
    counts = frappe.db.sql("""
        SELECT status, count(*) as count
        FROM `tabContainers`
        GROUP BY status
    """, as_dict=True)
    return counts

def get_filling_vs_returns():
    # Last 7 days
    start_date = add_days(today(), -7)
    
    # Filling
    filled = frappe.db.sql("""
        SELECT posting_date, sum(used_containers_count) as count
        FROM `tabContainer Filling Entry`
        WHERE docstatus = 1 AND posting_date >= %s
        GROUP BY posting_date
    """, (start_date,), as_dict=True)
    
    # Returns (Reconciliation)
    returned = frappe.db.sql("""
        SELECT posting_date, sum(containers_received) as count
        FROM `tabReconciliation`
        WHERE docstatus = 1 AND posting_date >= %s
        GROUP BY posting_date
    """, (start_date,), as_dict=True)
    
    return {'filled': filled, 'returned': returned}

def get_utilisation_by_type():
    data = frappe.db.sql("""
        SELECT type, status, count(*) as count
        FROM `tabContainers`
        GROUP BY type, status
    """, as_dict=True)
    
    # Grouping in plant vs in customer
    # In plant = Available, Filled, Under Maintenance, Damaged
    # In customer = With Customer, In Transit
    result = {}
    for row in data:
        ctype = row.type or "Unknown"
        if ctype not in result:
            result[ctype] = {'in_plant': 0, 'in_customer': 0}
        if row.status in ['With Customer', 'In Transit']:
            result[ctype]['in_customer'] += row.count
        else:
            result[ctype]['in_plant'] += row.count
            
    return result

def get_aging_of_containers():
    data = frappe.db.sql("""
        SELECT DATEDIFF(CURDATE(), last_filled) as days
        FROM `tabContainers`
        WHERE status = 'With Customer' AND last_filled IS NOT NULL
    """, as_dict=True)
    
    bins = {'0-15 days': 0, '16-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0}
    for row in data:
        d = row.days
        if d <= 15: bins['0-15 days'] += 1
        elif d <= 30: bins['16-30 days'] += 1
        elif d <= 60: bins['31-60 days'] += 1
        elif d <= 90: bins['61-90 days'] += 1
        else: bins['90+ days'] += 1
        
    return bins

def get_customer_holding_summary():
    data = frappe.db.sql("""
        SELECT 
            custodian as customer, 
            count(name) as outstanding,
            COUNT(DISTINCT type) as types,
            MAX(DATEDIFF(CURDATE(), last_filled)) as oldest,
            SUM(capacity * 1000) as deposit
        FROM `tabContainers`
        WHERE status = 'With Customer' AND custodian IS NOT NULL
        GROUP BY custodian
        ORDER BY outstanding DESC
        LIMIT 10
    """, as_dict=True)
    return data

def get_recent_filling_entries():
    return frappe.db.get_all('Container Filling Entry', 
        filters={'docstatus': 1}, 
        fields=['name', 'posting_date'],
        order_by='posting_date desc', limit=5
    )

def get_damage_and_loss():
    # This could be from chargebacks or reconciliation items
    return frappe.db.get_all('Reconciliation Items',
        filters={'condition': ['in', ['Damaged', 'Lost']]},
        fields=['parent as docname', 'condition', 'amount'],
        limit=5
    )
