// Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Container Utilization & Reconciliation Report"] = {
	filters: [
		{
			"fieldname": "target_chart",
			"label": __("Target Chart (For Dashboards)"),
			"fieldtype": "Select",
			"options": "\nFleet Status\nFilling vs Returns\nUtilisation\nAging",
			"default": "",
		},
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.week_start(),
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.week_end(),
		}
	],
};
