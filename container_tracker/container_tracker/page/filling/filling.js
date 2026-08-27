frappe.pages['filling'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Filling',
		single_column: true
	});

	// Wrapper for our custom Vue/JS app
	$(wrapper).find('.layout-main-section').append('<div id="filling-app"></div>');

	// Add custom CSS
	frappe.require('/assets/container_tracker/css/filling.css');
	
	// Add custom JS logic
	frappe.require('/assets/container_tracker/js/filling.js', function() {
		new FillingApp('#filling-app');
	});
}