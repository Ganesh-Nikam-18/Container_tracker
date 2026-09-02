frappe.listview_settings['Containers'] = {
	get_indicator: function(doc) {
		let status = doc.status || "Unknown";
		let color = "gray";
		
		if (status === "Available") {
			color = "green";
		} else if (status === "Filled") {
			color = "blue";
		} else if (status === "Out with Customer") {
			color = "orange";
		} else if (status === "In Maintenance") {
			color = "red";
		} else if (status === "Scrapped") {
			color = "darkgrey";
		}

		return [__(status), color, "status,=," + status];
	}
};
