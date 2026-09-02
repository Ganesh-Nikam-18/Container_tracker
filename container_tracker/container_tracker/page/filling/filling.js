frappe.pages['filling'] = frappe.pages['filling'] || {};
frappe.pages['filling'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Container Filling Entry',
		single_column: true
	});
	
	$(wrapper).closest('.layout-main-section').css({
		'max-width': '100%',
		'padding': '0 30px'
	});


	// Add Buttons
	let btn_back = page.add_inner_button('Back to list', () => {
		show_list_view();
	});
	let btn_clear = page.add_inner_button('Clear scans', () => {
		if (state.scanned_containers.length > 0) {
			state.scanned_containers = [];
			render_table();
			render_quick_picks();
			frappe.show_alert({ message: "All scans cleared", indicator: "blue" });
		}
	});
	let btn_submit = page.add_inner_button('Submit filling entry', () => submit_entry());
	btn_submit.addClass('btn-primary').css({ 'color': '#fff', 'background-color': 'var(--primary-color)' });
	btn_submit.prop('disabled', true);

	// Inject HTML
	$(page.body).html(`
<style>
	.filling-page-wrapper { max-width: 100%; margin: 0; padding: 15px 30px; }
	.filling-card { background: var(--card-bg, #ffffff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 6px; margin-bottom: 20px; overflow: hidden; }
	.filling-card-header { padding: 12px 20px; background-color: var(--card-bg, #ffffff); border-bottom: 1px solid var(--border-color, #e5e7eb); font-weight: 600; font-size: 14px; color: var(--text-color, #111827); display: flex; justify-content: space-between; align-items: center; }
	.filling-card-body { padding: 20px; }
	.f-row { display: flex; flex-wrap: wrap; margin-left: -10px; margin-right: -10px; margin-bottom: 15px; }
	.f-col { padding: 0 10px; flex: 1; min-width: 250px; }
	.f-col-full { padding: 0 10px; width: 100%; }
	.f-label { display: block; font-size: 12px; color: var(--text-muted, #6b7280); margin-bottom: 6px; font-weight: normal; }
	.f-input { width: 100%; border: 1px solid var(--border-color, #d1d5db); border-radius: 4px; padding: 6px 10px; font-size: 13px; outline: none; background: var(--control-bg, #fff); height: 32px; color: var(--text-color); }
	.f-input:focus { border-color: var(--primary-color, #3b82f6); }
	.f-input:disabled { background-color: var(--control-bg-disabled, #f9fafb); color: var(--text-muted, #9ca3af); cursor: not-allowed; }
	.f-help { font-size: 11px; color: var(--text-muted, #9ca3af); margin-top: 6px; }
	.f-summary-box { background-color: var(--control-bg, #f3f4f6); border-radius: 4px; padding: 15px; margin-top: 5px; display: flex; flex-wrap: wrap; }
	.f-summary-item { flex: 1; min-width: 120px; }
	.f-summary-val { font-size: 14px; font-weight: 600; color: var(--text-color, #111827); margin-top: 4px; }
	.f-summary-footer { width: 100%; margin-top: 15px; font-size: 11px; color: var(--text-muted, #6b7280); }
	.camera-btn { background: var(--card-bg, #ffffff); border: 1px solid var(--border-color, #d1d5db); border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; color: var(--text-color, #374151); font-weight: 500; display: inline-flex; align-items: center; gap: 5px; }
	.quick-pick-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
	.qp-tag { border: 1px solid var(--border-color, #d1d5db); padding: 4px 10px; font-size: 11px; border-radius: 4px; color: var(--text-color, #4b5563); cursor: pointer; background: var(--control-bg, #fff); font-family: monospace; }
	.qp-tag:hover { border-color: var(--primary-color, #3b82f6); color: var(--primary-color, #3b82f6); }
	
	.erp-actions { list-style: none; padding: 0; margin: 0; }
	.erp-actions li { font-size: 12px; color: var(--text-color, #4b5563); margin-bottom: 8px; padding-left: 20px; position: relative; }
	.erp-actions li::before { content: '\\2713'; color: var(--green-500, #10b981); position: absolute; left: 0; border: 1px solid var(--green-500, #10b981); border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; top: 1px; }
	.right-stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color, #f3f4f6); font-size: 13px; color: var(--text-muted, #6b7280); }
	.right-stat-row:last-child { border-bottom: none; padding-bottom: 0; }
	.right-stat-val { font-weight: 600; color: var(--text-color, #111827); }
	.recent-entry { padding: 10px 0; border-bottom: 1px solid var(--border-color, #f3f4f6); display: flex; justify-content: space-between; align-items: center; }
	.recent-entry:last-child { border-bottom: none; padding-bottom: 0; }
	.re-id { font-size: 13px; font-weight: 600; color: var(--text-color, #111827); }
	.re-meta { font-size: 11px; color: var(--text-muted, #6b7280); margin-top: 2px; }
	.re-badge { background: var(--bg-blue-100, #e0f2fe); color: var(--blue-700, #0284c7); font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 12px; }
	
	.camera-box { background: #000; border-radius: 8px; min-height: 200px; color: #9ca3af; font-size: 13px; position: relative; overflow: hidden; text-align: center; }
	.scanner-laser { position: absolute; width: 100%; height: 2px; background: #ef4444; box-shadow: 0 0 8px #ef4444, 0 0 15px #ef4444; top: 0; left: 0; animation: scan-laser 2s infinite linear; z-index: 10; display: none; }
	@keyframes scan-laser { 0% { top: 0%; } 50% { top: 98%; } 100% { top: 0%; } }

	.table-containers { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
	.table-containers th { text-align: left; padding: 8px; border-bottom: 1px solid var(--border-color, #e5e7eb); color: var(--text-muted, #6b7280); font-weight: 500; }
	.table-containers td { padding: 8px; border-bottom: 1px solid var(--border-color, #f3f4f6); color: var(--text-color, #111827); }
	.table-empty { text-align: center; padding: 40px !important; color: var(--text-muted, #9ca3af) !important; background: var(--control-bg, #f9fafb); font-size: 12px; }
	
	.scanner-input-group { display: flex; gap: 10px; }
	.btn-add { background: var(--control-bg, #f3f4f6); border: 1px solid var(--border-color, #d1d5db); padding: 0 15px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-color, #374151); }
	.btn-add:hover { background: var(--bg-light-gray, #e5e7eb); }
	.remove-btn { color: var(--red-500, #ef4444); background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 600; }

	/* List View Styles */
	.ct-header-action { display: flex; justify-content: flex-end; margin-bottom: 20px; }
	.ct-dashboard-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
	.ct-card { background: var(--card-bg, #fff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
	.ct-card.blue { border-left: 4px solid var(--blue-500, #3b82f6); }
	.ct-card.green { border-left: 4px solid var(--green-500, #10b981); }
	.ct-card.purple { border-left: 4px solid var(--purple-500, #8b5cf6); }
	.ct-card-label { font-size: 13px; color: var(--text-muted, #6b7280); margin-bottom: 5px; }
	.ct-card-value { font-size: 24px; font-weight: 700; color: var(--text-color, #111827); }
	.status-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
	.status-badge.submitted { background: var(--bg-green-100, #d1fae5); color: var(--green-700, #047857); }
	.status-badge.draft { background: var(--bg-yellow-100, #fef3c7); color: var(--yellow-700, #b45309); }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background-color: var(--highlight-color, #f9fafb); }
    
    /* Details View Styles */
    .dt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color, #f3f4f6); font-size: 13px; color: var(--text-color, #4b5563); }
    .dt-row:last-child { border-bottom: none; }
    .dt-label { color: var(--text-muted, #6b7280); }
    .dt-val { font-weight: 600; text-align: right; }
</style>

<!-- LIST VIEW -->
<div id="view-list" class="filling-page-wrapper" style="display: none;">
	<div class="ct-header-action" style="text-align: right; margin-bottom: 20px;">
		<button class="btn btn-primary btn-sm" id="btn-new-entry" style="font-weight: 600;">
			<i class="fa fa-plus"></i> New
		</button>
	</div>
	
	<div class="ct-dashboard-cards">
		<div class="ct-card blue">
			<div class="ct-card-label">Filling entries</div>
			<div class="ct-card-value" id="lv-total-entries">0</div>
		</div>
		<div class="ct-card green">
			<div class="ct-card-label">Containers filled</div>
			<div class="ct-card-value" id="lv-total-containers">0</div>
		</div>
		<div class="ct-card purple">
			<div class="ct-card-label">Quantity posted</div>
			<div class="ct-card-value" id="lv-total-qty">0.0</div>
		</div>
	</div>
	
	<div class="filling-card">
		<div class="filling-card-header" style="padding: 8px 20px;">
			<input type="text" id="inp-list-search" class="f-input" style="max-width: 300px;" placeholder="Search ID, delivery note, customer, item, operator">
		</div>
		<div class="filling-card-body" style="padding: 0;">
			<table class="table-containers" style="margin:0;">
				<thead>
					<tr>
						<th style="padding-left: 20px;">ID</th>
						<th>Posting date</th>
						<th>Delivery note</th>
						<th>Customer</th>
						<th>Item</th>
						<th>Containers</th>
						<th>Qty posted</th>
						<th>Operator</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody id="lv-tbody">
					<tr><td colspan="9" class="table-empty">Loading records...</td></tr>
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- DETAIL VIEW -->
<div id="view-detail" class="filling-page-wrapper row" style="display: none;">
    <div class="col-md-5">
        <div class="filling-card">
            <div class="filling-card-header">Details</div>
            <div class="filling-card-body" id="dt-details-body">
                Loading...
            </div>
        </div>
    </div>
    <div class="col-md-7">
        <div class="filling-card">
            <div class="filling-card-header">Containers</div>
            <div class="filling-card-body" style="padding: 0;">
                <table class="table-containers" style="margin:0;">
                    <thead>
                        <tr>
                            <th style="padding-left: 20px;">#</th>
                            <th>Container</th>
                            <th>Type</th>
                            <th>Qty filled</th>
                            <th>Batch</th>
                        </tr>
                    </thead>
                    <tbody id="dt-containers-tbody">
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="filling-card">
            <div class="filling-card-header">Container Ledger Entries posted</div>
            <div class="filling-card-body" style="padding: 0;">
                <table class="table-containers" style="margin:0;">
                    <thead>
                        <tr>
                            <th style="padding-left: 20px;">Ledger entry</th>
                            <th>Datetime</th>
                            <th>Container</th>
                            <th>Filled qty</th>
                            <th>Asset movement</th>
                        </tr>
                    </thead>
                    <tbody id="dt-cle-tbody">
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>


<!-- SCANNER VIEW -->
<div id="view-scanner" class="filling-page-wrapper row" style="display: none;">
    <!-- Left Column: Primary Inputs -->
    <div class="col-md-8">
        <!-- Card 1: Select delivery note and item -->
        <div class="filling-card">
            <div class="filling-card-header">1 · Select delivery note and item</div>
            <div class="filling-card-body">
                <div class="f-row">
                    <div class="f-col">
                        <label class="f-label">Delivery Note (submitted)</label>
                        <select id="sel-delivery-note" class="f-input">
                            <option value="">Loading...</option>
                        </select>
                    </div>
                    <div class="f-col">
                        <label class="f-label">Item (gas)</label>
                        <select id="sel-item" class="f-input" disabled>
                            <option value="">Select Delivery Note first</option>
                        </select>
                    </div>
                </div>
                <div class="f-row" style="margin-bottom: 0;">
                    <div class="f-col">
                        <label class="f-label">Filling operator</label>
                        <input type="text" id="inp-operator" class="f-input" placeholder="e.g. R. Naik">
                    </div>
                    <div class="f-col">
                        <label class="f-label">Gas batch / lot</label>
                        <select id="sel-batch" class="f-input" disabled>
                            <option value="">Select Item first</option>
                        </select>
                    </div>
                </div>
                
                <div class="f-summary-box">
                    <div class="f-summary-item">
                        <div class="f-label">Ordered</div>
                        <div class="f-summary-val" id="val-ordered">0 Cum</div>
                    </div>
                    <div class="f-summary-item">
                        <div class="f-label">Already filled</div>
                        <div class="f-summary-val" id="val-filled">0 Cum</div>
                    </div>
                    <div class="f-summary-item">
                        <div class="f-label">Pending</div>
                        <div class="f-summary-val" id="val-pending">0.0 Cum</div>
                    </div>
                    <div class="f-summary-item">
                        <div class="f-label">Max fill for this item</div>
                        <div class="f-summary-val" id="val-max">Select item</div>
                    </div>
                    <div class="f-summary-footer" id="val-capacity-help">
                        Capacity details will appear here once an item is selected.
                    </div>
                </div>
            </div>
        </div>

        <!-- Card 2: Scan containers -->
        <div class="filling-card">
            <div class="filling-card-header">
                <span>2 · Scan containers</span>
                <button class="camera-btn" id="btn-camera"><i class="fa fa-camera"></i> Camera scan</button>
            </div>
            <div class="filling-card-body">
                <div class="row">
                    <div class="col-md-6">
                        <label class="f-label">Handheld / Bluetooth scanner</label>
                        <div class="scanner-input-group">
                            <input type="text" id="inp-barcode" class="f-input" placeholder="Scan or type CYL-01001">
                            <button class="btn-add" id="btn-add-container">Add</button>
                        </div>
                        
                        <label class="f-label" style="margin-top: 20px;">Quick pick — available items</label>
                        <div class="quick-pick-tags" id="quick-pick-list">
                            <!-- Populated dynamically -->
                            <span style="font-size: 11px; color: #9ca3af;">Select item first to see quick picks</span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <label class="f-label">Camera viewfinder</label>
                        <div class="camera-box" id="camera-reader">
                            Camera off
                            <div class="scanner-laser" id="scanner-laser"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Card 3: Containers in this filling -->
        <div class="filling-card">
            <div class="filling-card-header">
                <span>3 · Containers in this filling (<span id="count-heading">0</span>)</span>
            </div>
            <div class="filling-card-body" style="padding: 0;">
                <table class="table-containers">
                    <thead>
                        <tr>
                            <th style="padding-left: 20px;">Container</th>
                            <th>Type</th>
                            <th>Barcode</th>
                            <th>Capacity</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="tbl-scanned">
                        <tr><td colspan="5" class="table-empty" id="empty-state">Scan a container to begin. Suggested containers for the pending quantity: ~0</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Right Column: Summaries & ERP Data -->
    <div class="col-md-4">
        <!-- Card 4: Filling summary -->
        <div class="filling-card">
            <div class="filling-card-header">Filling summary</div>
            <div class="filling-card-body">
                <div class="right-stat-row">
                    <span>Containers scanned</span>
                    <span class="right-stat-val" id="sum-scanned">0</span>
                </div>
                <div class="right-stat-row">
                    <span>Suggested containers</span>
                    <span class="right-stat-val" id="sum-suggested">0</span>
                </div>
                <div class="right-stat-row">
                    <span>Quantity to post</span>
                    <span class="right-stat-val" id="sum-qty">0.0 Cum</span>
                </div>
                <div class="right-stat-row">
                    <span>Pending after posting</span>
                    <span class="right-stat-val" id="sum-pending">0.0 Cum</span>
                </div>
                <div class="right-stat-row">
                    <span>Customer</span>
                    <span class="right-stat-val" id="sum-customer" style="font-size: 12px; font-weight: normal; text-align: right; max-width: 150px;">-</span>
                </div>
            </div>
        </div>


        <!-- Card 6: Recent Entries -->
        <div class="filling-card">
            <div class="filling-card-header">Recent filling entries</div>
            <div class="filling-card-body" id="recent-entries-list">
                <div style="font-size: 12px; color: #9ca3af; text-align: center;">No recent entries</div>
            </div>
        </div>
    </div>
</div>
	`);

	// Global State
	let state = {
		delivery_note: null,
		item: null,
		batch: null,
		operator: frappe.session.user_fullname || "",
		customer: "-",
		ordered_qty: 0,
		filled_qty: 0,
		pending_qty: 0,
		max_capacity: 0,
		scanned_containers: [],
		quick_picks: [],
		list_entries: []
	};

	// DOM Elements
	const sel_dn = $('#sel-delivery-note');
	const sel_item = $('#sel-item');
	const sel_batch = $('#sel-batch');
	const inp_op = $('#inp-operator');
	const inp_barcode = $('#inp-barcode');
	const tbl_body = $('#tbl-scanned');
	const btn_add = $('#btn-add-container');

	inp_op.val(state.operator);

	// View Toggles
	function show_list_view() {
		$('#view-scanner').hide();
		$('#view-detail').hide();
		$('#view-list').fadeIn();
		btn_back.hide();
		btn_clear.hide();
		btn_submit.hide();
		page.set_title('Container Filling Entries');
		fetch_list_data();
		stop_camera();
	}

	function show_detail_view(id) {
		$('#view-list').hide();
		$('#view-scanner').hide();
		$('#view-detail').fadeIn();
		btn_back.show();
		btn_clear.hide();
		btn_submit.hide();
		page.set_title(id);

		$('#dt-details-body').html('Loading...');
		$('#dt-containers-tbody').html('');
		$('#dt-cle-tbody').html('');

		frappe.call({
			method: 'frappe.client.get',
			args: {
				doctype: 'Container Filling Entry',
				name: id
			},
			callback: (r) => {
				if (r.message) {
					let doc = r.message;

					let details_html = `
						<div class="dt-row"><div class="dt-label">Posting date</div><div class="dt-val">${doc.posting_date || '-'}</div></div>
						<div class="dt-row"><div class="dt-label">Delivery note</div><div class="dt-val"><a href="/app/delivery-note/${doc.delivery_note}" class="dt-link">${doc.delivery_note || '-'}</a></div></div>
						<div class="dt-row"><div class="dt-label">Customer</div><div class="dt-val">${doc.customer || '-'}</div></div>
						<div class="dt-row"><div class="dt-label">Item</div><div class="dt-val">${doc.item || '-'}</div></div>
						<div class="dt-row"><div class="dt-label">Operator</div><div class="dt-val">${doc.operator || '-'}</div></div>
						<div class="dt-row"><div class="dt-label">Batch</div><div class="dt-val">${doc.batch || '-'}</div></div>
						<div class="dt-row"><div class="dt-label">Containers filled</div><div class="dt-val">${doc.containers_filled || 0}</div></div>
						<div class="dt-row"><div class="dt-label">Quantity posted</div><div class="dt-val">${(doc.quantity_posted || 0).toFixed(1)}</div></div>
						<div class="dt-row"><div class="dt-label">Status</div><div class="dt-val">${doc.docstatus === 1 ? 'Submitted' : 'Draft'}</div></div>
					`;
					$('#dt-details-body').html(details_html);

					let containers = doc.container_filling_items || [];
					let c_rows = '';
					containers.forEach((c, idx) => {
						c_rows += `
							<tr>
								<td style="padding-left: 20px;">${idx + 1}</td>
								<td><a href="/app/containers/${c.container}" class="dt-link">${c.container}</a></td>
								<td>${c.container_type || '-'}</td>
								<td>${c.filled_qty || 0}</td>
								<td>${c.batch || '-'}</td>
							</tr>
						`;
					});
					if (containers.length === 0) c_rows = '<tr><td colspan="5" class="table-empty">No containers found</td></tr>';
					$('#dt-containers-tbody').html(c_rows);

					let cle = doc.cle_items || [];
					let cle_rows = '';
					cle.forEach((c) => {
						cle_rows += `
							<tr>
								<td style="padding-left: 20px;"><a href="/app/container-ledger-entry/${c.container_ledger_entry}" class="dt-link">${c.container_ledger_entry}</a></td>
								<td>${c.datetime || '-'}</td>
								<td>${c.container || '-'}</td>
								<td>${c.filled_qty || 0}</td>
								<td>${c.asset_movement || '-'}</td>
							</tr>
						`;
					});
					if (cle.length === 0) cle_rows = '<tr><td colspan="5" class="table-empty">No ledger entries found</td></tr>';
					$('#dt-cle-tbody').html(cle_rows);
				}
			}
		});
	}

	function show_scanner_view() {
		$('#view-list').hide();
		$('#view-scanner').fadeIn();
		btn_back.show();
		btn_clear.show();
		btn_submit.show();
		page.set_title('New Filling Entry');
	}

	$('#btn-new-entry').on('click', () => {
		show_scanner_view();
	});

	$(document).on('click', '.clickable-row', function () {
		let id = $(this).data('id');
		show_detail_view(id);
	});

	$(document).on('input', '#inp-list-search', function () {
		render_list_view();
	});

	// API Helpers
	const call_api = (method, args, callback) => {
		frappe.call({
			method: "container_tracker.container_tracker.page.filling.filling." + method,
			args: args,
			callback: callback
		});
	};

	// List View Logic
	function fetch_list_data() {
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Container Filling Entry',
				fields: ['name', 'posting_date', 'delivery_note', 'customer', 'item', 'containers_filled', 'quantity_posted', 'operator', 'docstatus'],
				limit_page_length: 50,
				order_by: 'creation desc'
			},
			callback: (r) => {
				state.list_entries = r.message || [];
				render_list_view();

				// Render recent entries sidebar
				let recent = state.list_entries.filter(e => e.docstatus === 1).slice(0, 5);
				if (recent.length > 0) {
					let html = '';
					recent.forEach(e => {
						html += `
						<div class="recent-entry">
							<div>
								<div class="re-id">${e.name}</div>
								<div class="re-meta">${e.delivery_note || '-'} · ${e.item || '-'}</div>
							</div>
							<div class="re-badge">${e.containers_filled || 0}</div>
						</div>`;
					});
					$('#recent-entries-list').html(html);
				}
			}
		});
	}

	function render_list_view() {
		let total_entries = state.list_entries.length;
		let total_containers = state.list_entries.reduce((acc, val) => acc + (val.containers_filled || 0), 0);
		let total_qty = state.list_entries.reduce((acc, val) => acc + (val.quantity_posted || 0), 0);

		$('#lv-total-entries').text(total_entries);
		$('#lv-total-containers').text(total_containers);
		$('#lv-total-qty').text(total_qty.toFixed(1));

		let search_term = ($('#inp-list-search').val() || "").toLowerCase();
		let filtered_entries = state.list_entries.filter(e => {
			if (!search_term) return true;
			return (e.name && e.name.toLowerCase().includes(search_term)) ||
				(e.delivery_note && e.delivery_note.toLowerCase().includes(search_term)) ||
				(e.customer && e.customer.toLowerCase().includes(search_term)) ||
				(e.item && e.item.toLowerCase().includes(search_term)) ||
				(e.operator && e.operator.toLowerCase().includes(search_term));
		});

		if (filtered_entries.length === 0) {
			$('#lv-tbody').html('<tr><td colspan="9" class="table-empty">No filling entries found</td></tr>');
			return;
		}

		let rows = '';
		filtered_entries.forEach(e => {
			let status_html = e.docstatus === 1 ? '<span class="status-badge submitted">Submitted</span>' : '<span class="status-badge draft">Draft</span>';
			rows += `
				<tr class="clickable-row" data-id="${e.name}">
					<td style="padding-left: 20px; color: var(--blue-500); font-weight: 500;">${e.name}</td>
					<td>${e.posting_date}</td>
					<td>${e.delivery_note || '-'}</td>
					<td>${e.customer || '-'}</td>
					<td>${e.item || '-'}</td>
					<td>${e.containers_filled || 0}</td>
					<td>${(e.quantity_posted || 0).toFixed(1)}</td>
					<td>${e.operator || '-'}</td>
					<td>${status_html}</td>
				</tr>
			`;
		});
		$('#lv-tbody').html(rows);
	}

	// Load Initial Delivery Notes
	call_api("get_submitted_delivery_notes", {}, (r) => {
		let options = '<option value="">Select Delivery Note...</option>';
		if (r.message) {
			r.message.forEach(dn => { options += `<option value="${dn}">${dn}</option>`; });
		}
		sel_dn.html(options);
	});

	// Events
	sel_dn.on('change', function () {
		state.delivery_note = $(this).val();
		if (!state.delivery_note) {
			sel_item.html('<option value="">Select Delivery Note first</option>').prop('disabled', true);
			reset_stats();
			return;
		}

		// Fetch items
		call_api("get_dn_items", { delivery_note: state.delivery_note }, (r) => {
			let options = '<option value="">Select Item...</option>';
			if (r.message) {
				r.message.forEach(it => { options += `<option value="${it}">${it}</option>`; });
			}
			sel_item.html(options).prop('disabled', false);
		});

		frappe.db.get_value("Delivery Note", state.delivery_note, "customer", (r) => {
			if (r && r.customer) {
				state.customer = r.customer;
				$('#sum-customer').text(r.customer);
			}
		});
	});

	sel_item.on('change', function () {
		state.item = $(this).val();
		if (!state.item) {
			sel_batch.html('<option value="">Select Item first</option>').prop('disabled', true);
			reset_stats();
			return;
		}

		// Fetch Stats
		call_api("get_dn_item_qty", { delivery_note: state.delivery_note, item_code: state.item }, (r) => {
			if (r.message) {
				state.ordered_qty = r.message.ordered;
				state.pending_qty = r.message.pending;
				state.filled_qty = state.ordered_qty - state.pending_qty;

				$('#val-ordered').text(state.ordered_qty + " Cum");
				$('#val-filled').text(state.filled_qty + " Cum");
				$('#val-pending').text(state.pending_qty + " Cum");

				update_summary();
				
				// Fetch Batches
				call_api("get_item_batches", { item_code: state.item }, (batch_r) => {
					let options = '<option value="">Select Batch (Optional)...</option>';
					if (batch_r.message) {
						batch_r.message.forEach(b => { options += `<option value="${b}">${b}</option>`; });
					}
					sel_batch.html(options);
					
					if (state.pending_qty <= 0) {
						frappe.show_alert({ message: "Order is already completely fulfilled! No further containers can be added.", indicator: "orange" });
						inp_barcode.prop('disabled', true);
						btn_add.prop('disabled', true);
						sel_batch.prop('disabled', true);
						$('#btn-camera').prop('disabled', true);
					} else {
						inp_barcode.prop('disabled', false).focus();
						btn_add.prop('disabled', false);
						sel_batch.prop('disabled', false);
						$('#btn-camera').prop('disabled', false);
					}
				});
				
				// Fetch Quick Picks
				call_api("get_quick_pick_containers", { item_code: state.item }, (qp_r) => {
					state.quick_picks = (qp_r.message || []);
					render_quick_picks();
				});
			}
		});

		$('#val-max').text("50L Cylinder - 7 Cum each");
		$('#val-capacity-help').text("Capacity comes from the Container Item Capacity table on the 50L Cylinder master for " + state.item);
	});

	// Add Container
	const add_container = (passed_barcode = null) => {
		let barcode = passed_barcode || inp_barcode.val().trim();
		if (!barcode) return;

		if (!state.item) {
			frappe.show_alert({ message: "Please select an Item first before scanning.", indicator: "orange" });
			return;
		}

		if (state.pending_qty <= 0) {
			frappe.show_alert({ message: "Order is already completely fulfilled!", indicator: "orange" });
			inp_barcode.val('');
			return;
		}

		let total_fill = state.scanned_containers.reduce((acc, c) => acc + (c.actual_fill || 0), 0);
		if (total_fill >= state.pending_qty) {
			frappe.show_alert({ message: "Ordered quantity is completely fulfilled!", indicator: "orange" });
			inp_barcode.val('');
			return;
		}

		inp_barcode.val('').prop('disabled', true);
		btn_add.prop('disabled', true);

		call_api("validate_and_fetch_container", { barcode: barcode, item_code: state.item }, (r) => {
			if (!r.exc && r.message) {
				let c = r.message;

				if (c.error) {
					frappe.show_alert({ message: c.error, indicator: "orange" });
					inp_barcode.prop('disabled', false).focus();
					btn_add.prop('disabled', false);
					return;
				}

				if (state.scanned_containers.find(x => x.name === c.name)) {
					frappe.show_alert({ message: `Container ${c.name} is already in the list.`, indicator: "orange" });
				} else {
					state.scanned_containers.push(c);
					render_table();
					frappe.show_alert({ message: `${c.name} added · ${c.capacity} Cum max for ${state.item}`, indicator: 'green' });
				}
			}
			inp_barcode.prop('disabled', false).focus();
			btn_add.prop('disabled', false);
		});
	};

	inp_barcode.on('keypress', function (e) {
		if (e.which === 13) {
			e.preventDefault();
			add_container();
		}
	});

	btn_add.on('click', () => add_container());

	// Camera Scanner Logic
	let html5QrCode = null;

	function stop_camera() {
		if (html5QrCode) {
			html5QrCode.stop().then(() => {
				html5QrCode.clear();
				html5QrCode = null;
				$('#camera-reader').html('Camera off<div class="scanner-laser" id="scanner-laser"></div>');
				$('#btn-camera').html('<i class="fa fa-camera"></i> Camera scan');
			});
		}
	}

	$('#btn-camera').on('click', function () {
		if (html5QrCode) {
			stop_camera();
			return;
		}

		const beep = (freq, duration, type = "sine") => {
			try {
				let ctx = new (window.AudioContext || window.webkitAudioContext)();
				let osc = ctx.createOscillator();
				let gain = ctx.createGain();
				osc.type = type;
				osc.frequency.value = freq;
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start();
				gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
				setTimeout(() => osc.stop(), duration * 1000);
			} catch (e) { }
		};

		const start_camera = () => {
			$('#camera-reader').html('<div class="scanner-laser" id="scanner-laser" style="display: block;"></div>');
			html5QrCode = new Html5Qrcode("camera-reader");

			window.last_scanned = "";
			window.last_scan_time = 0;

			// Optimization for 1D Barcodes
			let config = {
				fps: 20,
				qrbox: { width: 300, height: 100 },
				aspectRatio: 1.777778,
				disableFlip: false
			};

			if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
				config.formatsToSupport = [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39];
			}

			html5QrCode.start(
				{ facingMode: "environment" },
				config,
				(decodedText, decodedResult) => {
					if (window.last_scanned === decodedText && (Date.now() - window.last_scan_time < 1500)) {
						return;
					}
					window.last_scanned = decodedText;
					window.last_scan_time = Date.now();

					beep(880, 0.1);
					add_container(decodedText);
				},
				(errorMessage) => { }
			).catch((err) => {
				frappe.msgprint("Error starting camera: " + err);
				stop_camera();
			});
			$('#btn-camera').html('<i class="fa fa-stop"></i> Stop camera');
		};

		if (typeof Html5Qrcode === 'undefined') {
			frappe.require("/assets/frappe/node_modules/html5-qrcode/html5-qrcode.min.js", function () {
				start_camera();
			});
		} else {
			start_camera();
		}
	});

	// Remove Container
	$(document).on('click', '.remove-btn', function () {
		let id = $(this).data('id');
		state.scanned_containers = state.scanned_containers.filter(c => c.name !== id);
		render_table();
	});

	// Render Table & Summaries
	function render_table() {
		let suggested = state.pending_qty > 0 ? Math.ceil(state.pending_qty / 7.0) : 0;

		if (state.scanned_containers.length === 0) {
			tbl_body.html(`<tr><td colspan="5" class="table-empty" id="empty-state">Scan a container to begin. Suggested containers for the pending quantity: ~${suggested}</td></tr>`);
			btn_submit.prop('disabled', true);
			update_summary();
			return;
		}

		// Calculate actual fill
		let temp_pending = state.pending_qty;
		state.scanned_containers.forEach(c => {
			let cap = parseFloat(c.capacity || 0);
			c.actual_fill = temp_pending > 0 ? Math.min(cap, temp_pending) : 0;
			temp_pending -= c.actual_fill;
		});

		let rows = '';
		state.scanned_containers.forEach(c => {
			rows += `
				<tr>
					<td style="padding-left: 20px; font-weight: 600;">${c.name}</td>
					<td>${c.type}</td>
					<td>${c.barcode || '-'}</td>
					<td>${c.actual_fill.toFixed(2)} Cum <span style="font-size:10px;color:#9ca3af;">(Cap: ${c.capacity})</span></td>
					<td><button class="remove-btn" data-id="${c.name}">Remove</button></td>
				</tr>
			`;
		});

		tbl_body.html(rows);
		btn_submit.prop('disabled', false);
		update_summary();
		render_quick_picks();
	}

	function render_quick_picks() {
		if (state.pending_qty <= 0) {
			$('#quick-pick-list').html('<span style="font-size: 11px; color: #9ca3af;">Order completely fulfilled</span>');
			return;
		}
		let total_fill = state.scanned_containers.reduce((acc, c) => acc + (c.actual_fill || 0), 0);
		if (total_fill >= state.pending_qty) {
			$('#quick-pick-list').html('<span style="font-size: 11px; color: #9ca3af;">Ordered quantity completely fulfilled</span>');
			return;
		}

		if (!state.quick_picks || state.quick_picks.length === 0) {
			$('#quick-pick-list').html('<span style="font-size: 11px; color: #9ca3af;">No available containers for this item</span>');
			return;
		}
		let html = "";
		state.quick_picks.forEach(c => {
			if (!state.scanned_containers.find(sc => sc.name === c)) {
				html += `<div class="qp-tag" onclick="$('#inp-barcode').val('${c}'); $('#btn-add-container').click();">${c}</div>`;
			}
		});
		if (html === "") {
			html = '<span style="font-size: 11px; color: #9ca3af;">All suggested containers scanned</span>';
		}
		$('#quick-pick-list').html(html);
	}

	function update_summary() {
		let total_fill = state.scanned_containers.reduce((acc, c) => acc + (c.actual_fill || 0), 0);
		let suggested = state.pending_qty > 0 ? Math.ceil(state.pending_qty / 7.0) : 0;
		let pending_after = state.pending_qty - total_fill;
		if (pending_after < 0) pending_after = 0;

		$('#count-heading').text(state.scanned_containers.length);
		$('#sum-scanned').text(state.scanned_containers.length);
		$('#sum-suggested').text(suggested);
		$('#sum-qty').text(total_fill.toFixed(2) + " Cum");
		$('#sum-pending').text(pending_after.toFixed(2) + " Cum");
		
		// Update top summary bar live
		$('#val-pending').text(pending_after.toFixed(2) + " Cum");
		let new_filled = (state.filled_qty || 0) + total_fill;
		$('#val-filled').text(new_filled.toFixed(2) + " Cum");

		if (state.pending_qty > 0 && total_fill >= state.pending_qty) {
			$('#val-pending, #sum-pending, #sum-qty, #val-filled').css('color', 'var(--green-600, #059669)');
		} else {
			$('#val-pending, #sum-pending, #sum-qty, #val-filled').css('color', '');
		}
	}

	function reset_stats() {
		state.ordered_qty = 0; state.filled_qty = 0; state.pending_qty = 0;
		$('#val-ordered').text("0 Cum"); $('#val-filled').text("0 Cum"); $('#val-pending').text("0 Cum");
		$('#val-max').text("Select item"); $('#val-capacity-help').text("Capacity details will appear here once an item is selected.");
		$('#quick-pick-list').html('<span style="font-size: 11px; color: #9ca3af;">Select item first to see quick picks</span>');
		update_summary();
	}

	// Submit Logic
	function submit_entry() {
		let payload = {
			delivery_note: state.delivery_note,
			item: state.item,
			operator: inp_op.val().trim(),
			batch: sel_batch.val(),
			containers: state.scanned_containers.map(c => c.name)
		};

		frappe.confirm('Are you sure you want to submit this Filling Entry?', () => {
			btn_submit.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Submitting...');

			call_api("submit_filling_entry", { payload: JSON.stringify(payload) }, (r) => {
				if (!r.exc) {
					frappe.show_alert({ message: `Container Filling Entry ${r.message} submitted successfully!`, indicator: 'green' });

					// Reset
					state.scanned_containers = [];
					render_table();
					sel_item.trigger('change');

					// Go back to list view and refresh
					show_list_view();
				}
				btn_submit.prop('disabled', false).html('Submit filling entry');
			});
		});
	}

	// Init
	show_list_view();
}