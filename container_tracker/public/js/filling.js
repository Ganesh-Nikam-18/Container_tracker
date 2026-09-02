class FillingApp {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.scanned_containers = [];
		this.total_capacity = 0;
		
		this.init();
	}
	
	init() {
		// Load template
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: 'Page',
				filters: { name: 'filling' },
				fieldname: 'name'
			},
			callback: (r) => {
				// Due to frappe caching we fetch the HTML manually via ajax or standard page load
				$.get('/assets/container_tracker/js/filling.html', (html) => {
					this.wrapper.html(html);
					this.setup_events();
					this.load_initial_data();
				}).fail(() => {
					// Fallback to fetch from api if custom routing
					frappe.call({
						method: "frappe.client.get_value",
						args: { doctype: "File", filters: { file_url: "/assets/container_tracker/page/filling/filling.html" }, fieldname: "file_url" }
					});
				});
			}
		});
		
		// Fallback for simple template loading if needed
		$.ajax({
			url: '/api/method/frappe.utils.file_manager.get_file',
			data: { fname: 'filling.html', folder: 'Home/Attachments' }
		});
	}
}
