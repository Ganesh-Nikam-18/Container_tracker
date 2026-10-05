frappe.pages['movement-entry'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Container Movements & Operations',
		single_column: true
	});

	page.set_primary_action('Refresh', () => {
		load_command_center(wrapper);
	});

	wrapper.page = page;
	wrapper.command_center = $(`<div class="command-center-container" style="padding: 10px 15px;"></div>`).appendTo(page.main);
	load_command_center(wrapper);
};

function load_command_center(wrapper) {
	const $container = wrapper.command_center;
	$container.empty();

	$container.html(`
		<style>
			.nav-tabs .nav-link { font-weight: 600; color: var(--text-muted, #6b7280); border: none; padding: 10px 18px; border-bottom: 3px solid transparent; }
			.nav-tabs .nav-link.active { color: var(--primary, #2563eb); border-bottom-color: var(--primary, #2563eb); background: transparent; }

			.board-column {
				background: var(--bg-gray-100, #f3f4f6);
				border-radius: 8px;
				padding: 12px;
				min-height: 480px;
			}
			.board-card {
				background: var(--card-bg, #fff);
				border: 1px solid var(--border-color, #e5e7eb);
				border-radius: 6px;
				padding: 10px;
				margin-bottom: 10px;
				cursor: pointer;
				box-shadow: 0 1px 2px rgba(0,0,0,0.05);
				transition: border-color 0.2s;
			}
			.board-card:hover { border-color: var(--primary, #2563eb); }

			.days-badge-ok { background: #dcfce7; color: #15803d; }
			.days-badge-warning { background: #fef9c3; color: #a16207; }
			.days-badge-overdue { background: #fee2e2; color: #b91c1c; font-weight: 700; }

			.drawer-overlay {
				position: fixed; top: 0; right: -450px; width: 420px; height: 100vh;
				background: #fff; z-index: 1050; box-shadow: -4px 0 15px rgba(0,0,0,0.15);
				transition: right 0.3s ease; padding: 20px; overflow-y: auto;
			}
			.drawer-overlay.open { right: 0; }
			.drawer-backdrop {
				position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
				background: rgba(0,0,0,0.3); z-index: 1040; display: none;
			}

			.container-grid-box {
				border: 1.5px solid var(--border-color, #e5e7eb);
				border-radius: 6px;
				padding: 10px;
				background: #fff;
				cursor: pointer;
				transition: all 0.15s ease;
			}
			.container-grid-box.selected-box {
				border-color: var(--primary, #2563eb);
				background: var(--bg-blue-50, #eff6ff);
			}
		</style>

		<!-- Main Navigation Tabs -->
		<ul class="nav nav-tabs mb-3" id="cc-main-tabs">
			<li class="nav-item"><a class="nav-link active" data-toggle="tab" href="#tab-new-movement">🔄 New Movement</a></li>
			<li class="nav-item"><a class="nav-link" data-toggle="tab" href="#tab-filling">⚗ Filling Entry</a></li>
			<li class="nav-item"><a class="nav-link" data-toggle="tab" href="#tab-holdings">💰 Party Holdings & Days</a></li>
		</ul>

		<!-- Tab Contents -->
		<div class="tab-content" id="cc-tab-contents">

			<!-- TAB 1: NEW MOVEMENT -->
			<div class="tab-pane fade show active" id="tab-new-movement">
				<!-- Step 1: Selection Controls -->
				<div class="card p-3 mb-3" style="border-radius: 8px;">
					<h6 class="font-weight-bold mb-3 text-uppercase text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Step 1: Movement & Document Configuration</h6>
					
					<div class="row">
						<div class="col-md-4" id="ctrl-purpose-wrapper"></div>
						<div class="col-md-4" id="ctrl-party-wrapper"></div>
						<div class="col-md-4" id="ctrl-docname-wrapper"></div>
					</div>

					<div class="row mt-2" id="party-and-return-row">
						<div class="col-md-4" id="ctrl-exp-return-wrapper"></div>
						<div class="col-md-4" id="ctrl-target-loc-wrapper"></div>
						<div style="display:none;" id="ctrl-doctype-wrapper"></div>
						<div style="display:none;" id="ctrl-party-type-wrapper"></div>
					</div>

					<div id="doc-info-banner" class="mt-2" style="display:none;"></div>
				</div>

				<!-- Step 2A: Document Items Table -->
				<div class="card p-3 mb-3" id="doc-items-card" style="display:none; border-radius: 8px;">
					<h6 class="font-weight-bold mb-3 border-bottom pb-2">Required Gas Items for Document</h6>
					<div id="doc-items-area"></div>
				</div>

				<!-- Step 2B: Dispatched Containers Table (for Supplier PO/PR) -->
				<div class="card p-3 mb-3" id="dispatched-card" style="display:none; border-radius: 8px;">
					<h6 class="font-weight-bold mb-3 border-bottom pb-2">Containers Currently at Supplier</h6>
					<div id="dispatched-area"></div>
				</div>

				<!-- Step 3: Container Operations & Selection Grid -->
				<div class="card p-3" id="ops-card" style="border-radius: 8px;">
					<div id="hydro-alert-area" class="mb-3" style="display:none;"></div>

					<div id="ops-header-area" class="mb-3">
						<h6 class="font-weight-bold m-0" id="grid-header-title">Step 2: Container Operations</h6>
					</div>

					<div id="ops-subcontent-area">
						<p class="text-muted m-0 p-3 text-center border rounded bg-light">Select a Movement Purpose or Document above to begin container operations.</p>
					</div>
				</div>
			</div>

			<!-- TAB 2: FILLING ENTRY -->
			<div class="tab-pane fade" id="tab-filling">
				<div class="card p-3 mb-3" style="border-radius: 8px;">
					<h5 class="font-weight-bold mb-3">Create Container Filling Entry</h5>
					<div class="row mb-2">
						<div class="col-md-6" id="filling-dn-wrapper"></div>
						<div class="col-md-6" id="filling-cust-wrapper"></div>
					</div>

					<!-- DN Gas Items Card -->
					<div class="card p-3 mb-3 border-light bg-light" id="filling-dn-items-card" style="display:none; border-radius:6px;">
						<h6 class="font-weight-bold mb-2 border-bottom pb-2">Required Gas Items from Delivery Note</h6>
						<div id="filling-dn-items-area"></div>
					</div>

					<!-- Active Filling Banner -->
					<div id="filling-active-banner" class="alert alert-info py-2 px-3 mb-3 d-flex justify-content-between align-items-center" style="display:none; border-radius:6px;">
						<div>
							<strong id="active-item-title">Gas Item: -</strong>
							<span class="badge badge-secondary ml-2" id="active-item-batch">Batch: -</span>
						</div>
						<span class="font-weight-bold text-primary" id="active-item-target">Target: 0 Vol</span>
					</div>

					<!-- Live Filling Header Summary Bar -->
					<div id="filling-summary-bar" class="p-3 mb-3 border rounded bg-white" style="display:none; border-radius:8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
						<div class="row align-items-center">
							<div class="col-md-3 border-right text-center">
								<small class="text-muted text-uppercase d-block font-weight-bold" style="font-size:10px; letter-spacing:0.5px;">Requested Volume</small>
								<span class="h5 font-weight-bold mb-0 text-dark" id="summary-req-vol">0 Vol</span>
							</div>
							<div class="col-md-3 border-right text-center">
								<small class="text-muted text-uppercase d-block font-weight-bold" style="font-size:10px; letter-spacing:0.5px;">Selected Fill Volume</small>
								<span class="h5 font-weight-bold mb-0 text-primary" id="summary-fill-vol">0 Vol</span>
								<small class="text-muted d-block" id="summary-cont-count" style="font-size:11px;">(0 Containers)</small>
							</div>
							<div class="col-md-3 border-right text-center">
								<small class="text-muted text-uppercase d-block font-weight-bold" style="font-size:10px; letter-spacing:0.5px;">Pending Volume</small>
								<span class="h5 font-weight-bold mb-0 text-warning" id="summary-pending-vol">0 Vol</span>
							</div>
							<div class="col-md-3 text-center">
								<small class="text-muted text-uppercase d-block font-weight-bold" style="font-size:10px; letter-spacing:0.5px;">Filling Status</small>
								<div id="summary-status-badge" class="mt-1"><span class="badge badge-secondary" style="font-size:12px; padding:6px 12px;">Pending</span></div>
							</div>
						</div>
					</div>

					<!-- Container Cards Selection Section -->
					<div class="d-flex justify-content-between align-items-center mt-3 mb-2">
						<h6 class="font-weight-bold m-0" id="filling-containers-header-title">Select Compatible Empty Containers to Fill</h6>
						<div id="filling-auto-distribute-btn-wrapper"></div>
					</div>
					<div id="filling-containers-area" class="border rounded p-3 bg-light mb-3" style="min-height: 180px;">
						<p class="text-muted m-0 p-2 text-center">Select a Delivery Note above to view required gas items and compatible empty containers.</p>
					</div>

					<div class="text-right">
						<button class="btn btn-success font-weight-bold px-4" onclick="window.execute_filling_submission()">Post Filling Entry & Update Status to Filled</button>
					</div>
				</div>
			</div>

			<!-- TAB 3: HOLDINGS & DAYS HELD -->
			<div class="tab-pane fade" id="tab-holdings">
				<div class="card p-3 mb-3">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h5 class="font-weight-bold m-0">External Holdings & Days Held Tracking</h5>
						<div class="d-flex gap-2">
							<select id="holdings-type-filter" class="form-control form-control-sm" onchange="window.load_holdings_data()">
								<option value="">All External Parties</option>
								<option value="Customer">Customers</option>
								<option value="Supplier">Suppliers</option>
							</select>
						</div>
					</div>
					<div id="holdings-table-area" class="table-responsive">
						<p class="text-muted">Loading holdings...</p>
					</div>
				</div>
			</div>

		</div>

		<!-- 360° Slide-in Drawer -->
		<div class="drawer-backdrop" id="drawer-backdrop" onclick="window.close_drawer()"></div>
		<div class="drawer-overlay" id="drawer-360">
			<div class="d-flex justify-content-between align-items-center mb-3">
				<h5 class="font-weight-bold m-0" id="drawer-container-id">Container 360°</h5>
				<button class="btn btn-sm btn-light" onclick="window.close_drawer()">✕</button>
			</div>
			<div id="drawer-content">
				<p class="text-muted">Loading 360° details...</p>
			</div>
		</div>
	`);

	// Setup All Controls Safely
	window.init_form_controls(wrapper);

	// Tab Switch Event Listener
	$('#cc-main-tabs a').on('click', function (e) {
		e.preventDefault();
		$(this).tab('show');
		let href = $(this).attr('href');
		if (href === '#tab-holdings') window.load_holdings_data();
	});
}

// ---------------------------------------------------------------------------
// Cascade Flush Helper
// ---------------------------------------------------------------------------
window.flush_dependent_fields = function (level) {
	if (level <= 2 && window.f_docname) {
		window.f_docname.set_value('');
	}

	if (level <= 3) {
		if (window.f_party) {
			if (level <= 2) {
				window.f_party.set_value('');
			}
			window.f_party.df.read_only = 0;
			if (window.f_party.refresh_input) window.f_party.refresh_input();
		}
		$('#doc-info-banner').hide().empty();
		$('#doc-items-card').hide();
		$('#doc-items-area').empty();
		$('#dispatched-card').hide();
		$('#dispatched-area').empty();
		window.reset_ops_area();
	}
};

// ---------------------------------------------------------------------------
// Form Controls Setup (Safe Guarded Initialization)
// ---------------------------------------------------------------------------
window.init_form_controls = function (wrapper) {
	// 1. Movement Purpose Select Control
	window.f_purpose = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Select',
			fieldname: 'purpose',
			label: 'Movement Purpose',
			options: [
				'Send to Supplier',
				'Receive from Supplier',
				'Return to Supplier',
				'Send to Customer',
				'Receive from Customer',
				'Internal Transfer',
				'Move to Filling',
				'Return from Filling',
				'Move to Maintenance',
				'Return from Maintenance',
				'Scrap / Decommission'
			].join('\n'),
			reqd: 1,
			onchange: function () {
				if (window.f_purpose) window.on_purpose_change();
			}
		},
		parent: $('#ctrl-purpose-wrapper'),
		render_input: true
	});

	// Virtual Controls for backward compatibility with backend API callers
	window.f_doctype = {
		df: { options: 'Purchase Order' },
		get_value: function () {
			let purpose = window.f_purpose ? window.f_purpose.get_value() : '';
			if (purpose === 'Send to Supplier') return 'Purchase Order';
			if (purpose === 'Receive from Supplier' || purpose === 'Return to Supplier') return 'Purchase Receipt';
			if (purpose === 'Send to Customer' || purpose === 'Receive from Customer') return 'Delivery Note';
			return '';
		},
		set_value: function () { },
		refresh_input: function () { }
	};

	window.f_party_type = {
		df: { options: 'Supplier' },
		get_value: function () {
			let purpose = window.f_purpose ? window.f_purpose.get_value() : '';
			if (purpose && purpose.includes('Supplier')) return 'Supplier';
			if (purpose && purpose.includes('Customer')) return 'Customer';
			return '';
		},
		set_value: function () { },
		refresh_input: function () { }
	};

	// 2. Party Link Control (positioned in Step 1 top row)
	window.f_party = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Link',
			fieldname: 'party',
			label: 'Supplier',
			options: 'Supplier',
			onchange: function () {
				if (window.f_party) window.on_party_change();
			}
		},
		parent: $('#ctrl-party-wrapper'),
		render_input: true
	});

	// 3. Linked Document Name Link Control
	window.f_docname = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Link',
			fieldname: 'doc_name',
			label: 'Purchase Order',
			options: 'Purchase Order',
			onchange: function () {
				if (window.f_docname) window.on_docname_change();
			}
		},
		parent: $('#ctrl-docname-wrapper'),
		render_input: true
	});

	// 4. Expected Return Date Control (for hydro validation)
	window.f_exp_return = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Date',
			fieldname: 'expected_return_date',
			label: 'Expected Return Date',
			description: 'Hydro test MUST remain valid through this date.',
			onchange: function () { window.validate_hydro_test_frontend(); }
		},
		parent: $('#ctrl-exp-return-wrapper'),
		render_input: true
	});

	// 5. Target Location Control
	window.f_target_loc = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Link',
			fieldname: 'target_location',
			label: 'Target Location',
			options: 'Location'
		},
		parent: $('#ctrl-target-loc-wrapper'),
		render_input: true
	});

	// Filling Form Controls
	window.f_fill_dn = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Link', fieldname: 'delivery_note', label: 'Delivery Note (Select Order)', options: 'Delivery Note',
			get_query: () => ({ filters: { docstatus: 1 } }),
			onchange: function () { window.on_filling_dn_change(); }
		},
		parent: $('#filling-dn-wrapper'), render_input: true
	});

	window.f_fill_cust = frappe.ui.form.make_control({
		df: { fieldtype: 'Link', fieldname: 'customer', label: 'Customer', options: 'Customer', read_only: 1 },
		parent: $('#filling-cust-wrapper'), render_input: true
	});

	// Initial default purpose trigger
	window.f_purpose.set_value('Send to Supplier');
	window.on_purpose_change();
};

// Helper to update control label dynamically
window.set_control_label = function (control, new_label) {
	if (!control || !control.df) return;
	control.df.label = new_label;
	if (control.$label) {
		control.$label.text(new_label);
	} else if (control.$wrapper) {
		control.$wrapper.find('.control-label, label').text(new_label);
	}
};

// ---------------------------------------------------------------------------
// Purpose & Document Selection Logic (with Cascade Flushing)
// ---------------------------------------------------------------------------
window.on_purpose_change = function () {
	if (!window.f_purpose) return;
	let purpose = window.f_purpose.get_value() || 'Send to Supplier';

	window.flush_dependent_fields(1);

	// Automatically map Purpose to dynamic labels and target options
	if (purpose === 'Send to Supplier') {
		window.f_party.df.options = 'Supplier';
		window.set_control_label(window.f_party, 'Supplier');

		window.f_docname.df.options = 'Purchase Order';
		window.set_control_label(window.f_docname, 'Purchase Order');

		$('#ctrl-party-wrapper, #ctrl-docname-wrapper').show();
	} else if (purpose === 'Receive from Supplier' || purpose === 'Return to Supplier') {
		window.f_party.df.options = 'Supplier';
		window.set_control_label(window.f_party, 'Supplier');

		window.f_docname.df.options = 'Purchase Receipt';
		window.set_control_label(window.f_docname, 'Purchase Receipt');

		$('#ctrl-party-wrapper, #ctrl-docname-wrapper').show();
	} else if (purpose === 'Send to Customer') {
		window.f_party.df.options = 'Customer';
		window.set_control_label(window.f_party, 'Customer');

		window.f_docname.df.options = 'Delivery Note';
		window.set_control_label(window.f_docname, 'Delivery Note');

		$('#ctrl-party-wrapper, #ctrl-docname-wrapper').show();
	} else if (purpose === 'Receive from Customer') {
		window.f_party.df.options = 'Customer';
		window.set_control_label(window.f_party, 'Customer');

		window.f_docname.df.options = 'Delivery Note';
		window.set_control_label(window.f_docname, 'Delivery Note');

		$('#ctrl-party-wrapper, #ctrl-docname-wrapper').show();
	} else {
		// Internal movements have no reference document or party
		$('#ctrl-party-wrapper, #ctrl-docname-wrapper').hide();
	}

	window.on_doctype_change();
};

window.on_doctype_change = function () {
	if (!window.f_doctype || !window.f_party_type || !window.f_party) return;
	let dt = window.f_doctype.get_value();
	let purpose = window.f_purpose ? window.f_purpose.get_value() : 'Send to Supplier';

	window.flush_dependent_fields(2);

	if (dt && window.f_docname) {
		window.update_docname_query_filter();
		$('#ctrl-docname-wrapper').show();
	} else {
		if ($('#ctrl-docname-wrapper').length) $('#ctrl-docname-wrapper').hide();
		window.reset_ops_area();
	}

	// Party selection row visibility for party movements
	const party_req = ['Send to Customer', 'Receive from Customer', 'Send to Supplier', 'Receive from Supplier', 'Return to Supplier'];
	if (party_req.includes(purpose)) {
		$('#ctrl-party-wrapper').show();
	} else {
		$('#ctrl-party-wrapper').hide();
	}

	// Return date visibility for outbound purposes
	const outbound = ['Send to Customer', 'Send to Supplier', 'Return to Supplier'];
	if (outbound.includes(purpose) && window.f_exp_return) {
		$('#ctrl-exp-return-wrapper').show();
		if (!window.f_exp_return.get_value()) {
			window.f_exp_return.set_value(frappe.datetime.add_days(frappe.datetime.get_today(), 30));
		}
	} else {
		$('#ctrl-exp-return-wrapper').hide();
	}

	if (purpose === 'Internal Transfer' || purpose === 'Move to Maintenance') {
		$('#ctrl-target-loc-wrapper').show();
	} else {
		$('#ctrl-target-loc-wrapper').hide();
	}
};

window.update_docname_query_filter = function () {
	if (!window.f_doctype || !window.f_docname) return;
	let dt = window.f_doctype.get_value();
	let party = window.f_party ? window.f_party.get_value() : null;

	if (!dt) return;

	let party_field = (dt === 'Purchase Order' || dt === 'Purchase Receipt') ? 'supplier' : 'customer';

	window.f_docname.df.get_query = () => {
		let filters = { docstatus: 1 };
		if (party) {
			filters[party_field] = party;
		}
		return { filters: filters };
	};
	if (window.f_docname.refresh_input) window.f_docname.refresh_input();
};

window.on_docname_change = function () {
	if (!window.f_doctype || !window.f_docname) return;
	let doctype = window.f_doctype.get_value();
	let docname = window.f_docname.get_value();

	window.flush_dependent_fields(3);

	if (!docname) return;

	let field_to_fetch = (doctype === 'Purchase Order' || doctype === 'Purchase Receipt') ? 'supplier' : 'customer';
	frappe.call({
		method: 'frappe.client.get_value',
		args: {
			doctype: doctype,
			filters: { name: docname },
			fieldname: field_to_fetch
		},
		callback: function (r) {
			if (r.message && r.message[field_to_fetch]) {
				let party = r.message[field_to_fetch];
				if (window.f_party) {
					window.f_party.set_value(party);
					window.f_party.df.read_only = 1;
					if (window.f_party.refresh_input) window.f_party.refresh_input();
				}
				window.update_docname_query_filter();
				$('#doc-info-banner').html(`
					<div class="alert alert-info py-2 px-3 m-0" style="font-size:12px;">
						ℹ️ Document <b>${docname}</b> linked to ${field_to_fetch.toUpperCase()}: <b>${party}</b>
					</div>
				`).slideDown();
			}
		}
	});

	// Fetch Document Required Items
	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_document_items',
		args: { doctype: doctype, docname: docname },
		callback: function (r) {
			if (r.message) {
				window.render_doc_items(doctype, docname, r.message);
			}
		}
	});

	// Check if containers have already been sent/linked to this document:
	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_dispatched_containers',
		args: { doctype: doctype, docname: docname },
		callback: function (r) {
			if (r.message && r.message.dispatched && r.message.dispatched.length > 0) {
				window.render_dispatched_cards_in_ops(r.message.dispatched);
			}
		}
	});

	$('#dispatched-card').hide();
};

window.on_party_change = function () {
	let party = window.f_party ? window.f_party.get_value() : null;

	// When Party is selected or changed first, update Document Name filter so it shows ONLY that party's documents!
	window.update_docname_query_filter();

	// If Document Name was already selected and does not belong to the newly selected Party, clear Document Name
	if (window.f_docname && window.f_docname.get_value() && party) {
		let dt = window.f_doctype ? window.f_doctype.get_value() : null;
		if (dt) {
			let party_field = (dt === 'Purchase Order' || dt === 'Purchase Receipt') ? 'supplier' : 'customer';
			frappe.db.get_value(dt, window.f_docname.get_value(), party_field, (r) => {
				if (r && r[party_field] && r[party_field] !== party) {
					window.f_docname.set_value('');
				}
			});
		}
	}
};

// ---------------------------------------------------------------------------
// Step 2A: Render Document Items Table
// ---------------------------------------------------------------------------
window.render_doc_items = function (doctype, docname, items) {
	if (!items || items.length === 0) {
		$('#doc-items-area').html('<p class="text-muted m-0">No gas items requiring containers found in this document.</p>');
		$('#doc-items-card').slideDown();
		return;
	}

	let purpose = window.f_purpose ? window.f_purpose.get_value() : 'Send to Supplier';
	let btn_label = 'Process Container';
	if (purpose === 'Send to Supplier') btn_label = 'Allocate Empty Containers';
	else if (purpose === 'Receive from Supplier') btn_label = 'Receive Arriving Containers';
	else if (purpose === 'Send to Customer') btn_label = 'Dispatch Filled Containers';
	else if (purpose === 'Receive from Customer') btn_label = 'Receive Returned Containers';

	let html = `
		<table class="table table-bordered table-sm m-0" style="font-size: 13px;">
			<thead style="background-color: var(--control-bg, #f3f4f6);">
				<tr>
					<th>Item Code</th>
					<th>Container Type</th>
					<th>Requested Qty</th>
					<th>Containers Handled</th>
					<th>Status</th>
					<th style="width: 170px;" class="text-center">Action</th>
				</tr>
			</thead>
			<tbody>
	`;

	items.forEach(item => {
		let is_completed = item.handled_qty >= item.qty;

		html += `
			<tr>
				<td><strong>${item.item_code}</strong></td>
				<td><span class="badge badge-info">${item.default_container_type || 'Unspecified'}</span></td>
				<td>${item.qty} Vol</td>
				<td>${item.handled_containers || 0} conts (${item.handled_qty || 0} Vol)</td>
				<td><span class="badge ${is_completed ? 'badge-success' : 'badge-warning'}">${is_completed ? '✓ Fulfilled' : 'Pending'}</span></td>
				<td class="text-center">
					${is_completed ?
						`<button class="btn btn-outline-info btn-xs" onclick="window.select_item_for_ops('${item.item_code}', '${item.default_container_type || ''}', ${item.qty}, ${item.handled_qty || 0})"><i class="fa fa-eye"></i> Show Allocated Containers</button>` :
						`<button class="btn btn-primary btn-xs" onclick="window.select_item_for_ops('${item.item_code}', '${item.default_container_type || ''}', ${item.qty}, ${item.handled_qty || 0})">${btn_label}</button>`
					}
				</td>
			</tr>
		`;
	});

	html += `</tbody></table>`;
	$('#doc-items-area').html(html);
	$('#doc-items-card').slideDown();

	if (items && items.length > 0) {
		let first = items[0];
		setTimeout(() => {
			window.select_item_for_ops(first.item_code, first.default_container_type || '', first.qty, first.handled_qty || 0);
		}, 150);
	}
};

window.render_dispatched_containers = function (doctype, docname, dispatched) {
	let html = `
		<div class="alert alert-success py-2 px-3 mb-2 d-flex justify-content-between align-items-center" style="font-size: 12px;">
			<div>
				<strong>📦 Containers Sent / Linked to ${doctype}: ${docname}</strong> — Found <b>${dispatched.length}</b> container(s).
			</div>
			<button class="btn btn-sm btn-primary" onclick="window.receive_dispatched_batch('${docname}')">
				<i class="fa fa-download"></i> Receive Selected Back to Plant
			</button>
		</div>
		<table class="table table-bordered table-sm m-0" style="font-size:12px;" id="dispatched-table">
			<thead style="background-color: #eff6ff;">
				<tr>
					<th style="width:30px;" class="text-center"><input type="checkbox" onchange="$('.disp-cb').prop('checked', $(this).prop('checked'))"></th>
					<th>Container</th>
					<th>Type</th>
					<th>Item Code</th>
					<th>Status</th>
					<th>Sent Date</th>
					<th>Movement Ref</th>
					<th class="text-center">Action</th>
				</tr>
			</thead>
			<tbody>
	`;

	dispatched.forEach(row => {
		let is_res = row.is_reserved || row.status === "Reserved";
		let status_badge = is_res ?
			`<span class="badge badge-warning" style="background-color: #f59e0b; color: #fff;">📌 Reserved until ${row.return_to_owner || ''}</span>` :
			`<span class="badge badge-info">${row.status || 'With Supplier'}</span>`;

		let reserve_btn = is_res ?
			`<span class="text-muted" style="font-size:11px;"><i class="fa fa-check-circle text-success"></i> Reserved</span>` :
			`<button class="btn btn-warning btn-xs" onclick="window.reserve_single_container('${row.container}', '${row.item_code || ''}')"><i class="fa fa-bookmark"></i> Reserve</button>`;

		html += `
			<tr>
				<td class="text-center"><input type="checkbox" class="disp-cb" data-id="${row.container}" data-item="${row.item_code}" data-type="${row.container_type}"></td>
				<td><strong>${row.container}</strong></td>
				<td>${row.container_type || ''}</td>
				<td>${row.item_code || ''}</td>
				<td>${status_badge}</td>
				<td>${row.date || ''}</td>
				<td><a href="/app/container-movements/${row.movement}" target="_blank">${row.movement}</a></td>
				<td class="text-center">${reserve_btn}</td>
			</tr>
		`;
	});

	html += `</tbody></table>`;
	$('#dispatched-area').html(html);
	$('#dispatched-card').slideDown();

	// Also populate Step 2 with container cards for these dispatched containers
	window.render_dispatched_cards_in_ops(dispatched);
};

window.render_dispatched_cards_in_ops = function(dispatched, item_code, allow_more_allocation, on_more_click) {
	let target = $('#ops-subcontent-area');
	if (!dispatched || dispatched.length === 0) return;

	let boxes = dispatched.map(c => {
		let is_res = c.is_reserved || c.status === "Reserved";
		let status_badge = is_res ?
			`<span class="badge badge-warning" style="background-color: #f59e0b; color: #fff;">📌 Reserved until ${c.return_to_owner || ''}</span>` :
			`<span class="badge badge-info">${c.status || 'Dispatched'}</span>`;

		let reserve_btn = is_res ?
			`<span class="text-muted" style="font-size:11px;"><i class="fa fa-check-circle text-success"></i> Reserved</span>` :
			`<button class="btn btn-warning btn-xs mt-1" onclick="window.reserve_single_container('${c.container}', '${c.item_code || item_code || ''}')"><i class="fa fa-bookmark"></i> Reserve</button>`;

		return `
			<div class="container-grid-box border rounded p-2 bg-white" data-id="${c.container}" style="min-width:200px;">
				<div class="d-flex justify-content-between align-items-center">
					<strong style="font-size:13px;">${c.container}</strong>
					${status_badge}
				</div>
				<div class="text-muted mt-1" style="font-size:11px;">
					${c.container_type || 'Cylinder'} &bull; ${c.item_code || item_code || ''}
				</div>
				<div class="text-muted mt-1" style="font-size:10px;">
					📅 Sent: ${c.date || '-'} | Hydro: ${c.test_due || 'N/A'}
				</div>
				<div class="mt-2 text-right">
					${reserve_btn}
				</div>
			</div>
		`;
	}).join('');

	let header_title = item_code ?
		`📦 Allocated / Dispatched Containers for <u>${item_code}</u> (${dispatched.length})` :
		`📦 Containers Sent / Linked to Document (${dispatched.length})`;

	let more_btn_html = allow_more_allocation ?
		`<button class="btn btn-primary btn-sm ml-2" id="btn-allocate-more-for-item"><i class="fa fa-plus"></i> Allocate Remaining Containers</button>` : '';

	target.html(`
		<div class="border rounded p-3 bg-white mb-3">
			<div class="d-flex justify-content-between align-items-center mb-2">
				<div class="font-weight-bold" style="font-size:13px;">${header_title}</div>
				<div class="d-flex align-items-center" style="width: 50%;">
					<input type="text" id="grid-search-input" class="form-control form-control-sm" placeholder="🔍 Search Container ID..." onkeyup="window.filter_container_grid()">
					${more_btn_html}
				</div>
			</div>

			<div id="eligible-containers-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; max-height: 320px; overflow-y: auto;" class="p-2 border rounded bg-light">
				${boxes}
			</div>
			<div id="allocation-more-area" class="mt-3"></div>
		</div>
	`);

	if (allow_more_allocation && on_more_click) {
		$('#btn-allocate-more-for-item').on('click', function() {
			$(this).prop('disabled', true);
			on_more_click();
		});
	}
};

window.reserve_single_container = function (container_id, item_code) {
	let default_party_type = window.f_party_type ? window.f_party_type.get_value() : '';
	let default_party = window.f_party ? window.f_party.get_value() : '';
	let doc_type = window.f_doctype ? window.f_doctype.get_value() : null;
	let doc_name = window.f_docname ? window.f_docname.get_value() : null;

	let dialog = new frappe.ui.Dialog({
		title: __('Reserve Container {0}', [container_id]),
		fields: [
			{
				label: __('Party Type'),
				fieldname: 'party_type',
				fieldtype: 'Link',
				options: 'DocType',
				default: default_party_type || 'Supplier',
				get_query: function () {
					return { filters: { name: ['in', ['Customer', 'Supplier']] } };
				},
				reqd: 1,
				onchange: function () {
					dialog.set_df_property('party', 'options', dialog.get_value('party_type'));
				}
			},
			{
				label: __('Party'),
				fieldname: 'party',
				fieldtype: 'Dynamic Link',
				options: default_party_type || 'Supplier',
				default: default_party,
				reqd: 1
			},
			{
				fieldname: 'column_break_dates',
				fieldtype: 'Column Break'
			},
			{
				label: __('Reservation From Date'),
				fieldname: 'from_date',
				fieldtype: 'Date',
				default: frappe.datetime.get_today(),
				reqd: 1
			},
			{
				label: __('Reserved Until Date (Return to Owner)'),
				fieldname: 'return_to_owner',
				fieldtype: 'Date',
				default: frappe.datetime.add_days(frappe.datetime.get_today(), 14),
				reqd: 1,
				description: __('Container status will be updated to Reserved until this date.')
			},
			{
				fieldname: 'section_break_info',
				fieldtype: 'Section Break',
				label: __('Container Details')
			},
			{
				fieldname: 'info_html',
				fieldtype: 'HTML',
				options: `
					<div class="p-2 border rounded bg-light" style="font-size:12px;">
						<strong>Container ID:</strong> ${container_id}<br>
						<strong>Document Ref:</strong> ${doc_type || ''} ${doc_name || ''}
					</div>
				`
			}
		],
		primary_action_label: __('Confirm Reservation'),
		primary_action: function (values) {
			if (!values.return_to_owner) {
				frappe.msgprint(__('Please specify the Reserved Until Date.'));
				return;
			}
			dialog.get_primary_btn().prop('disabled', true);

			frappe.call({
				method: 'container_tracker.container_tracker.doctype.container_reservation_entry.container_reservation_entry.create_reservation_entry',
				args: {
					company: frappe.defaults.get_user_default("Company"),
					party_type: values.party_type,
					party: values.party,
					reference_doctype: doc_type,
					reference_name: doc_name,
					from_date: values.from_date,
					to_date: values.return_to_owner,
					containers: JSON.stringify([{ name: container_id, item_code: item_code }])
				},
				callback: function (r) {
					dialog.hide();
					if (r && r.message) {
						frappe.show_alert({ message: r.message.message, indicator: 'green' }, 7);
						if (doc_name) window.on_docname_change();
					}
				},
				always: function () {
					dialog.get_primary_btn().prop('disabled', false);
				}
			});
		}
	});

	dialog.show();
};

window.receive_dispatched_batch = function (docname) {
	let selected = [];
	$('.disp-cb:checked').each(function () {
		selected.push({
			name: $(this).data('id'),
			item_code: $(this).data('item'),
			container_type: $(this).data('type')
		});
	});

	if (selected.length === 0) {
		frappe.msgprint("Please select at least one container to receive.");
		return;
	}

	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.create_movement_generic',
		args: {
			purpose: "Receive from Supplier",
			party_type: "Supplier",
			party: window.f_party.get_value(),
			reference_doctype: window.f_doctype.get_value(),
			reference_name: docname,
			containers_json: JSON.stringify(selected)
		},
		callback: function (r) {
			if (r.message && r.message.name) {
				frappe.show_alert({ message: `Containers Received successfully via Movement ${r.message.name}!`, indicator: 'green' });
				window.on_docname_change();
			}
		}
	});
};

// ---------------------------------------------------------------------------
// Step 3: Container Operations & Selection Grid
// ---------------------------------------------------------------------------
window.reset_ops_area = function () {
	$('#grid-header-title').text('Step 2: Container Operations');
	$('#ops-subcontent-area').html('<p class="text-muted m-0 p-3 text-center border rounded bg-light">Select a Movement Purpose or Document above to begin container operations.</p>');
};

window.select_item_for_ops = function (item_code, container_type, req_qty, handled_qty) {
	let pending_qty = req_qty - handled_qty;
	let purpose = window.f_purpose ? window.f_purpose.get_value() : 'Send to Supplier';
	let doctype = window.f_doctype ? window.f_doctype.get_value() : null;
	let docname = window.f_docname ? window.f_docname.get_value() : null;

	$('#grid-header-title').html(`Step 2: Container Operations for <span class="text-primary">${item_code}</span>`);

	if (docname) {
		frappe.call({
			method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_dispatched_containers',
			args: { doctype: doctype, docname: docname },
			callback: function (r) {
				let dispatched_all = (r.message && r.message.dispatched) ? r.message.dispatched : [];
				let item_dispatched = dispatched_all.filter(c => !c.item_code || c.item_code === item_code);

				if (item_dispatched.length > 0) {
					window.render_dispatched_cards_in_ops(item_dispatched, item_code, pending_qty > 0, function() {
						window.render_allocation_options_for_item_in_target('#allocation-more-area', purpose, item_code, container_type, pending_qty);
					});
				} else {
					window.render_allocation_options_for_item(purpose, item_code, container_type, pending_qty);
				}
			}
		});
	} else {
		window.render_allocation_options_for_item(purpose, item_code, container_type, pending_qty);
	}
};

window.render_allocation_options_for_item_in_target = function (target_selector, purpose, item_code, container_type, pending_qty) {
	let target = $(target_selector);
	if (!target.length) target = $('#ops-subcontent-area');

	if (purpose === "Send to Supplier") {
		target.html(`
			<div class="mb-3">
				<span class="text-muted" style="font-size:12px;">Pending Dispatch Qty: <b>${pending_qty} Vol</b> | Container Type: <b>${container_type || 'Any'}</b></span>
			</div>
			
			<div class="row">
				<div class="col-md-6 mb-2">
					<div class="border rounded p-3 bg-light">
						<h6 class="font-weight-bold m-0">Option A: Our Empty Containers</h6>
						<small class="text-muted d-block mb-2">Dispatch our company empty containers to supplier to be filled.</small>
						<button class="btn btn-primary btn-sm" onclick="window.fetch_our_containers_for_item('${item_code}', '${container_type}', ${pending_qty})">Fetch Company Containers</button>
					</div>
				</div>
				<div class="col-md-6 mb-2">
					<div class="border rounded p-3 bg-light">
						<h6 class="font-weight-bold m-0">Option B: Supplier's Containers</h6>
						<small class="text-muted d-block mb-2">Supplier is providing gas in their own containers.</small>
						<button class="btn btn-outline-secondary btn-sm" onclick="frappe.msgprint('Supplier containers will be received when Purchase Receipt arrives.')">Check Supplier Shipment</button>
					</div>
				</div>
			</div>

			<div id="allocation-grid-results" class="mt-3"></div>
		`);
	} else if (purpose === "Send to Customer") {
		target.html('<p class="text-muted p-2"><i class="fa fa-spinner fa-spin"></i> Fetching filled containers ready for customer dispatch for item <b>' + item_code + '</b>...</p>');
		let party = window.f_party ? window.f_party.get_value() : null;

		frappe.call({
			method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_filled_containers_for_item',
			args: {
				item_code: item_code,
				container_type: (container_type === 'null' || container_type === 'undefined') ? null : container_type,
				party: party,
				limit: 300
			},
			callback: function (r) {
				if (!r.message || r.message.length === 0) {
					target.html(`
						<div class="alert alert-warning m-0">
							No <b>Filled</b> containers found in stock for gas item <b>${item_code}</b>. 
							<br><small class="text-muted">Please perform a <b>Filling Entry</b> for containers before dispatching to customer.</small>
						</div>
					`);
					return;
				}
				window.render_allocated_containers_grid(target, r.message, item_code, pending_qty);
			}
		});
	}
};

window.render_allocation_options_for_item = function (purpose, item_code, container_type, pending_qty) {
	if (purpose === "Send to Supplier") {
		$('#ops-subcontent-area').html(`
			<div class="mb-3">
				<span class="text-muted" style="font-size:12px;">Pending Dispatch Qty: <b>${pending_qty} Vol</b> | Container Type: <b>${container_type || 'Any'}</b></span>
			</div>
			
			<div class="row">
				<div class="col-md-6 mb-2">
					<div class="border rounded p-3 bg-light">
						<h6 class="font-weight-bold m-0">Option A: Our Empty Containers</h6>
						<small class="text-muted d-block mb-2">Dispatch our company empty containers to supplier to be filled.</small>
						<button class="btn btn-primary btn-sm" onclick="window.fetch_our_containers_for_item('${item_code}', '${container_type}', ${pending_qty})">Fetch Company Containers</button>
					</div>
				</div>
				<div class="col-md-6 mb-2">
					<div class="border rounded p-3 bg-light">
						<h6 class="font-weight-bold m-0">Option B: Supplier's Containers</h6>
						<small class="text-muted d-block mb-2">Supplier is providing gas in their own containers.</small>
						<button class="btn btn-outline-secondary btn-sm" onclick="frappe.msgprint('Supplier containers will be received when Purchase Receipt arrives.')">Check Supplier Shipment</button>
					</div>
				</div>
			</div>

			<div id="allocation-grid-results" class="mt-3"></div>
		`);
	} else if (purpose === "Send to Customer") {
		let target = $('#ops-subcontent-area');
		target.html('<p class="text-muted p-2"><i class="fa fa-spinner fa-spin"></i> Fetching filled containers ready for customer dispatch for item <b>' + item_code + '</b>...</p>');

		let party = window.f_party ? window.f_party.get_value() : null;

		frappe.call({
			method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_filled_containers_for_item',
			args: {
				item_code: item_code,
				container_type: (container_type === 'null' || container_type === 'undefined') ? null : container_type,
				party: party,
				limit: 300
			},
			callback: function (r) {
				if (!r.message || r.message.length === 0) {
					target.html(`
						<div class="alert alert-warning m-0">
							No <b>Filled</b> containers found in stock for gas item <b>${item_code}</b>. 
							<br><small class="text-muted">Please perform a <b>Filling Entry</b> for containers before dispatching to customer.</small>
						</div>
					`);
					return;
				}

				window.render_allocated_containers_grid(target, r.message, item_code, pending_qty);
			}
		});
	} else if (purpose === "Receive from Supplier" || purpose === "Receive from Customer") {
		let target = $('#ops-subcontent-area');
		target.html('<p class="text-muted p-2"><i class="fa fa-spinner fa-spin"></i> Fetching containers currently with party for this item...</p>');

		let party = window.f_party ? window.f_party.get_value() : null;
		let target_status = (purpose === "Receive from Supplier") ? "With Supplier" : "With Customer";

		frappe.call({
			method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_containers_for_board',
			args: {
				status: target_status,
				custodian: party,
				item_code: item_code,
				limit: 300
			},
			callback: function (r) {
				if (r.message) {
					let list = r.message;
					if (list.length === 0) {
						target.html(`
							<div class="alert alert-warning m-0">
								No containers currently <b>${target_status}</b> found for item <b>${item_code}</b>. 
							</div>
						`);
						return;
					}

					window.render_allocated_containers_grid(target, list, item_code, pending_qty);
				}
			}
		});
	} else {
		window.fetch_our_containers_for_item(item_code, container_type, pending_qty);
	}
};

window.fetch_our_containers_for_item = function (item_code, container_type, pending_qty) {
	let target = $('#allocation-grid-results').length > 0 ? $('#allocation-grid-results') : $('#ops-subcontent-area');
	target.html('<p class="text-muted p-2"><i class="fa fa-spinner fa-spin"></i> Fetching available containers matching criteria...</p>');

	let docname = window.f_docname ? window.f_docname.get_value() : null;

	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_available_company_containers',
		args: {
			item_code: item_code,
			container_type: (container_type === 'null' || container_type === 'undefined') ? null : container_type,
			reference_name: docname,
			limit: Math.max(1, pending_qty * 3)
		},
		callback: function (r) {
			if (!r.message || r.message.length === 0) {
				target.html(`
					<div class="alert alert-warning m-0">
						No available empty company containers found for <b>${item_code}</b>. 
						Please ensure containers are in plant, emptied, have valid hydro test dates, and match the Item Capacity Matrix.
					</div>
				`);
				return;
			}

			window.render_allocated_containers_grid(target, r.message, item_code, pending_qty);
		}
	});
};

window.fetch_direct_containers = function () {
	let purpose = window.f_purpose ? window.f_purpose.get_value() : 'Send to Supplier';
	let party = window.f_party ? window.f_party.get_value() : null;
	const party_req = ['Send to Customer', 'Receive from Customer', 'Send to Supplier', 'Receive from Supplier', 'Return to Supplier'];

	$('#grid-header-title').text(`Eligible Containers for: ${purpose}`);
	let target = $('#ops-subcontent-area');

	if (party_req.includes(purpose) && !party) {
		let p_type = purpose.includes('Supplier') ? 'Supplier' : 'Customer';
		target.html(`
			<div class="alert alert-warning p-3 m-0 text-center" style="font-size: 13px;">
				⚠️ <b>Party Required:</b> Please select a <b>${p_type}</b> in Step 1 to view and select eligible containers for <b>${purpose}</b>.
			</div>
		`);
		return;
	}

	target.html('<p class="text-muted p-2 m-0"><i class="fa fa-spinner fa-spin"></i> Loading eligible containers...</p>');

	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_containers_for_board',
		args: { limit: 300 },
		callback: function (r) {
			if (r.message) {
				let list = r.message.filter(c => window.is_container_eligible(c, purpose, party));
				window.render_direct_containers_grid(target, list);
			}
		}
	});
};

window.is_container_eligible = function (c, purpose, party) {
	if (purpose === "Send to Customer") {
		let is_filled = (c.status === "Filled" || c.status === "Available") && (c.fill_status !== "Empty");
		let is_owner_valid = (c.owner_type === "Company") || (c.owner_type === "Customer" && (!party || c.owner_ === party));
		return is_filled && is_owner_valid;
	}
	if (purpose === "Receive from Customer") return c.status === "With Customer" && (!party || c.custodian === party);
	if (purpose === "Send to Supplier") return c.status === "Available" && c.fill_status === "Empty" && c.owner_type === "Company";
	if (purpose === "Receive from Supplier") return c.status === "With Supplier" && (!party || c.custodian === party);
	if (purpose === "Return to Supplier") return (c.status === "With Supplier" || c.owner_type === "Supplier") && (!party || c.custodian === party || c.owner_ === party);
	if (purpose === "Move to Filling") return c.status === "Available" && c.fill_status === "Empty" && c.owner_type === "Company";
	if (purpose === "Return from Filling") return c.status === "In Filling";
	if (purpose === "Move to Maintenance") return c.status !== "Under Maintenance" && c.status !== "Damaged" && c.status !== "Scrapped";
	if (purpose === "Return from Maintenance") return c.status === "Under Maintenance" || c.status === "Damaged";
	if (purpose === "Scrap / Decommission") return c.status !== "Scrapped";
	return c.status !== "Scrapped";
};

window.render_allocated_containers_grid = function (container_el, containers, item_code, pending_qty) {
	let purpose = window.f_purpose ? window.f_purpose.get_value() : 'Send to Supplier';
	let title_text = `Select Company Containers for ${item_code}`;
	let btn_text = 'Submit Container Movement';
	const outbound = ['Send to Customer', 'Send to Supplier', 'Return to Supplier'];
	let exp_return = window.f_exp_return ? window.f_exp_return.get_value() : null;

	if (purpose === "Receive from Supplier") {
		title_text = `Select Containers Currently at Supplier to Receive for ${item_code}`;
		btn_text = 'Submit Receive Movement';
	} else if (purpose === "Receive from Customer") {
		title_text = `Select Containers Currently at Customer to Receive for ${item_code}`;
		btn_text = 'Submit Return Movement';
	} else if (purpose === "Return to Supplier") {
		title_text = `Select Containers to Return to Supplier for ${item_code}`;
		btn_text = 'Submit Return Movement';
	}

	let boxes = containers.map(c => {
		let max_val = parseFloat(c.max_fill || c.capacity) || 1;
		let is_hydro_invalid = false;
		let hydro_badge_html = `<span class="${c.test_status === 'expired' ? 'text-danger font-weight-bold' : 'text-muted'}">${c.test_due || 'N/A'}</span>`;

		if (outbound.includes(purpose) && exp_return && c.test_due) {
			if (frappe.datetime.get_diff(c.test_due, exp_return) < 0) {
				is_hydro_invalid = true;
				hydro_badge_html = `<span class="badge badge-danger">⚠️ Hydro Expired for Trip (${c.test_due})</span>`;
			}
		}

		let box_style = is_hydro_invalid ? 'opacity: 0.45; cursor: not-allowed; background-color: #fff5f5;' : '';
		let cb_disabled = is_hydro_invalid ? 'disabled' : '';

		return `
			<div class="container-grid-box" data-id="${c.name}" data-max="${max_val}" style="${box_style}" onclick="window.toggle_container_box('${c.name}', ${pending_qty})">
				<div class="d-flex justify-content-between align-items-center">
					<strong style="font-size:13px;">${c.name}</strong>
					<input type="checkbox" class="c-cb" data-id="${c.name}" data-item="${item_code}" data-max="${max_val}" data-loc="${c.current_location || ''}" data-test="${c.test_due || ''}" ${cb_disabled} onclick="event.stopPropagation(); window.on_checkbox_toggled(${pending_qty});">
				</div>
				<div class="text-muted" style="font-size:11px; margin-top:2px;">
					${c.type || 'Cylinder'} &bull; <span class="badge badge-light">${c.status}</span>
				</div>
				<div style="font-size:10px;" class="mt-1">
					📍 ${c.current_location || 'Plant'} | Hydro: ${hydro_badge_html}
				</div>
			</div>
		`;
	}).join('');

	container_el.html(`
		<div class="border rounded p-3 bg-white">
			<div class="d-flex justify-content-between align-items-center mb-2">
				<div class="font-weight-bold" style="font-size:13px;">${title_text}</div>
				<div class="w-50">
					<input type="text" id="grid-search-input" class="form-control form-control-sm" placeholder="🔍 Search Container ID..." onkeyup="window.filter_container_grid()">
				</div>
			</div>

			<div class="progress mb-3" style="height: 22px;">
				<div id="alloc-progress-bar" class="progress-bar bg-primary" role="progressbar" style="width: 0%; font-size:11px; font-weight:bold;">0 / ${pending_qty} Vol Selected</div>
			</div>

			<div id="eligible-containers-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; max-height: 320px; overflow-y: auto;" class="p-2 border rounded bg-light mb-3">
				${boxes}
			</div>

			<div class="d-flex justify-content-between align-items-center">
				<div class="font-weight-bold text-primary" id="selected-count-msg" style="font-size: 13px;">0 container(s) selected</div>
				<div>
					<button class="btn btn-secondary mr-2" id="btn-reserve-containers" onclick="window.open_reserve_containers_dialog()"><i class="fa fa-bookmark"></i> Reserve Containers</button>
					<button class="btn btn-primary" id="btn-submit-movement" onclick="window.execute_movement_submission()">${btn_text}</button>
				</div>
			</div>
		</div>
	`);

	window.on_checkbox_toggled(pending_qty);
};

window.render_direct_containers_grid = function (container_el, containers) {
	if (!containers || containers.length === 0) {
		container_el.html('<p class="text-muted p-3 m-0 text-center border rounded bg-light">No eligible containers found for this criteria.</p>');
		return;
	}

	let purpose = window.f_purpose ? window.f_purpose.get_value() : 'Send to Supplier';
	const outbound = ['Send to Customer', 'Send to Supplier', 'Return to Supplier'];
	let exp_return = window.f_exp_return ? window.f_exp_return.get_value() : null;

	let boxes = containers.map(c => {
		let is_hydro_invalid = false;
		let hydro_badge_html = `<span class="${c.test_status === 'expired' ? 'text-danger font-weight-bold' : 'text-muted'}">${c.test_due || 'N/A'}</span>`;

		if (outbound.includes(purpose) && exp_return && c.test_due) {
			if (frappe.datetime.get_diff(c.test_due, exp_return) < 0) {
				is_hydro_invalid = true;
				hydro_badge_html = `<span class="badge badge-danger">⚠️ Hydro Expired for Trip (${c.test_due})</span>`;
			}
		}

		let box_style = is_hydro_invalid ? 'opacity: 0.45; cursor: not-allowed; background-color: #fff5f5;' : '';
		let cb_disabled = is_hydro_invalid ? 'disabled' : '';

		return `
			<div class="container-grid-box" data-id="${c.name}" style="${box_style}" onclick="window.toggle_container_box('${c.name}', 0)">
				<div class="d-flex justify-content-between align-items-center">
					<strong style="font-size:13px;">${c.name}</strong>
					<input type="checkbox" class="c-cb" data-id="${c.name}" data-item="${c.current_item || ''}" data-loc="${c.current_location || ''}" data-test="${c.test_due || ''}" ${cb_disabled} onclick="event.stopPropagation(); window.on_checkbox_toggled(0);">
				</div>
				<div class="text-muted" style="font-size:11px; margin-top:2px;">
					${c.type || 'Cylinder'} &bull; <span class="badge badge-light">${c.status}</span>
				</div>
				<div style="font-size:10px;" class="mt-1">
					📍 ${c.current_location || 'Plant'} | Hydro: ${hydro_badge_html}
				</div>
			</div>
		`;
	}).join('');

	container_el.html(`
		<div class="border rounded p-3 bg-white">
			<div class="d-flex justify-content-between align-items-center mb-3">
				<div class="font-weight-bold" style="font-size:13px;">Select Containers to Move</div>
				<div class="w-50">
					<input type="text" id="grid-search-input" class="form-control form-control-sm" placeholder="🔍 Search Container ID..." onkeyup="window.filter_container_grid()">
				</div>
			</div>

			<div id="eligible-containers-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; max-height: 320px; overflow-y: auto;" class="p-2 border rounded bg-light mb-3">
				${boxes}
			</div>

			<div class="d-flex justify-content-between align-items-center">
				<div class="font-weight-bold text-primary" id="selected-count-msg" style="font-size: 13px;">0 container(s) selected</div>
				<div>
					<button class="btn btn-secondary mr-2" id="btn-reserve-containers" onclick="window.open_reserve_containers_dialog()"><i class="fa fa-bookmark"></i> Reserve Containers</button>
					<button class="btn btn-primary" id="btn-submit-movement" onclick="window.execute_movement_submission()">Submit Container Movement</button>
				</div>
			</div>
		</div>
	`);

	window.on_checkbox_toggled(0);
};

window.toggle_container_box = function (id, pending_qty) {
	let $cb = $(`.c-cb[data-id="${id}"]`);
	if ($cb.prop('disabled')) return;
	$cb.prop('checked', !$cb.prop('checked'));
	window.on_checkbox_toggled(pending_qty);
};

window.on_checkbox_toggled = function (pending_qty) {
	let selected_count = 0;
	let selected_volume = 0;

	// First Pass: Calculate total selected count & volume
	$('.c-cb').each(function () {
		let max_fill = parseFloat($(this).data('max')) || 0;
		if ($(this).prop('checked')) {
			selected_count++;
			selected_volume += max_fill;
		}
	});

	let is_fulfilled = (pending_qty > 0) && (selected_volume >= pending_qty || selected_count >= pending_qty);

	// Second Pass: Update styling and disable unselected boxes if requirement is fulfilled
	$('.c-cb').each(function () {
		let id = $(this).data('id');
		let $box = $(`.container-grid-box[data-id="${id}"]`);
		let is_checked = $(this).prop('checked');

		if (is_checked) {
			$box.addClass('selected-box').css({ 'opacity': '1', 'cursor': 'pointer' });
			$(this).prop('disabled', false);
		} else {
			$box.removeClass('selected-box');
			if (is_fulfilled) {
				$box.css({ 'opacity': '0.4', 'cursor': 'not-allowed' });
				$(this).prop('disabled', true);
			} else {
				$box.css({ 'opacity': '1', 'cursor': 'pointer' });
				$(this).prop('disabled', false);
			}
		}
	});

	let msg = `${selected_count} container(s) selected (${selected_volume} Vol)`;
	if (is_fulfilled) {
		msg += ` &bull; <span class="badge badge-success">Target Qty Fulfilled ✓</span>`;
	}
	$('#selected-count-msg').html(msg);

	if (pending_qty > 0 && $('#alloc-progress-bar').length > 0) {
		let pct = Math.min(100, Math.round((selected_volume / pending_qty) * 100));
		let status_txt = is_fulfilled ? `${selected_volume} / ${pending_qty} Vol Selected (${selected_count} Conts) - Fulfilled ✓` : `${selected_volume} / ${pending_qty} Vol Selected (${selected_count} Conts)`;
		$('#alloc-progress-bar').css('width', Math.max(5, pct) + '%').text(status_txt);
		if (is_fulfilled) {
			$('#alloc-progress-bar').removeClass('bg-primary').addClass('bg-success');
		} else {
			$('#alloc-progress-bar').removeClass('bg-success').addClass('bg-primary');
		}
	}

	window.validate_hydro_test_frontend();
};

window.filter_container_grid = function () {
	let val = $('#grid-search-input').val().toLowerCase().trim();
	$('.container-grid-box').each(function () {
		let id = $(this).data('id').toLowerCase();
		if (id.includes(val)) {
			$(this).show();
		} else {
			$(this).hide();
		}
	});
};

window.validate_hydro_test_frontend = function () {
	if (!window.f_purpose) return;
	let purpose = window.f_purpose.get_value();
	const outbound = ["Send to Customer", "Send to Supplier", "Return to Supplier"];
	if (!outbound.includes(purpose)) {
		$('#hydro-alert-area').hide();
		$('#btn-submit-movement').prop('disabled', false);
		return;
	}

	let exp_return = window.f_exp_return ? window.f_exp_return.get_value() : null;
	if (!exp_return) return;

	let invalid_containers = [];
	let checked_boxes = $('.c-cb:checked');

	checked_boxes.each(function () {
		let cid = $(this).data('id');
		let test_due = $(this).data('test');
		if (test_due && frappe.datetime.get_diff(test_due, exp_return) < 0) {
			invalid_containers.push({ id: cid, test: test_due });
		}
	});

	if (invalid_containers.length > 0) {
		let list = invalid_containers.map(i => `<b>${i.id}</b> (expires ${i.test})`).join(', ');
		$('#hydro-alert-area').html(`
			<div class="alert alert-danger mb-0 py-2" style="font-size:12px;">
				⚠️ <b>HYDRO TEST EXPIRED FOR TRIP:</b> The following selected containers have hydro tests expiring BEFORE the Expected Return Date (${exp_return}): ${list}. <b>Dispatching is blocked by policy!</b>
			</div>
		`).slideDown();
		$('#btn-submit-movement').prop('disabled', true);
	} else {
		$('#hydro-alert-area').slideUp();
		$('#btn-submit-movement').prop('disabled', false);
	}
};

window.execute_movement_submission = function () {
	let purpose = window.f_purpose ? window.f_purpose.get_value() : null;
	let party = window.f_party ? window.f_party.get_value() : null;
	const party_req = ['Send to Customer', 'Receive from Customer', 'Send to Supplier', 'Receive from Supplier', 'Return to Supplier'];

	if (party_req.includes(purpose) && !party) {
		let p_type = (purpose && purpose.includes('Supplier')) ? 'Supplier' : 'Customer';
		frappe.msgprint(`Please select a <b>${p_type}</b> in Step 1 before submitting this container movement.`);
		return;
	}

	let selected = [];

	$('.c-cb:checked').each(function () {
		selected.push({
			name: $(this).data('id'),
			source_location: $(this).data('loc'),
			item_code: $(this).data('item')
		});
	});

	if (selected.length === 0) {
		frappe.msgprint("Please select at least one container.");
		return;
	}

	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.create_movement_generic',
		args: {
			purpose: purpose,
			party_type: window.f_party_type ? window.f_party_type.get_value() : null,
			party: window.f_party ? window.f_party.get_value() : null,
			expected_return_date: window.f_exp_return ? window.f_exp_return.get_value() : null,
			target_location: window.f_target_loc ? window.f_target_loc.get_value() : null,
			reference_doctype: (window.f_doctype && window.f_doctype.get_value() !== 'Direct / No Document') ? window.f_doctype.get_value() : null,
			reference_name: window.f_docname ? window.f_docname.get_value() : null,
			containers_json: JSON.stringify(selected)
		},
		callback: function (r) {
			if (r.message && r.message.name) {
				frappe.show_alert({ message: `Movement ${r.message.name} Submitted Successfully!`, indicator: 'green' });
				let docname = window.f_docname ? window.f_docname.get_value() : null;
				if (docname) {
					window.on_docname_change();
				} else {
					window.fetch_direct_containers();
				}
			}
		}
	});
};

// ---------------------------------------------------------------------------
// TAB 2: Container Board & 360° Drawer
// ---------------------------------------------------------------------------
window.load_board_data = function () {
	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_containers_for_board',
		args: { limit: 200 },
		callback: function (r) {
			if (r.message) {
				window.board_containers_all = r.message;
				window.render_board();
			}
		}
	});
};

window.render_board = function () {
	let search = $('#board-search').val() ? $('#board-search').val().toLowerCase() : '';
	let owner_filter = $('#board-owner-filter').val();

	let list = (window.board_containers_all || []).filter(c => {
		if (search && !c.name.toLowerCase().includes(search)) return false;
		if (owner_filter && c.owner_type !== owner_filter) return false;
		return true;
	});

	const statuses = ["Available", "Filled", "With Customer", "With Supplier", "In Filling", "Under Maintenance"];
	let html = '';

	statuses.forEach(status => {
		let col_items = list.filter(c => c.status === status);
		html += `
			<div class="col-md-2 col-sm-6 mb-3">
				<div class="board-column">
					<div class="d-flex justify-content-between align-items-center mb-2">
						<strong style="font-size:12px; text-transform:uppercase;">${status}</strong>
						<span class="badge badge-pill badge-secondary">${col_items.length}</span>
					</div>
					<div style="max-height: 500px; overflow-y: auto;">
						${col_items.map(c => window.render_board_card(c)).join('')}
					</div>
				</div>
			</div>
		`;
	});

	$('#board-columns-area').html(html);
};

window.render_board_card = function (c) {
	let badge_class = c.days_held >= 30 ? 'days-badge-overdue' : c.days_held >= 15 ? 'days-badge-warning' : 'days-badge-ok';
	return `
		<div class="board-card" onclick="window.open_360_drawer('${c.name}')">
			<div class="d-flex justify-content-between font-weight-bold" style="font-size:13px;">
				<span>${c.name}</span>
				<span class="badge badge-light" style="font-size:10px;">${c.type || 'Cyl'}</span>
			</div>
			<div class="text-muted" style="font-size:11px; margin-top:3px;">
				📍 ${c.current_location || 'Plant'}
			</div>
			${c.days_held > 0 ? `<div class="mt-2"><span class="badge ${badge_class}" style="font-size:10px;">⏱ ${c.days_held} Days Held</span></div>` : ''}
		</div>
	`;
};

window.open_360_drawer = function (container_id) {
	$('#drawer-container-id').text(`Container ${container_id}`);
	$('#drawer-content').html('<p class="text-muted p-3"><i class="fa fa-spinner fa-spin"></i> Loading 360° Record...</p>');
	$('#drawer-backdrop').show();
	$('#drawer-360').addClass('open');

	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_container_360',
		args: { container: container_id },
		callback: function (r) {
			if (r.message) {
				let d = r.message;
				let ledger_rows = (d.ledger || []).map(l => `
					<tr>
						<td><small>${frappe.datetime.str_to_user(l.datetime)}</small></td>
						<td><span class="badge ${l.entry_type === 'Outward' ? 'badge-warning' : 'badge-success'}">${l.movement_type}</span></td>
						<td><small>${l.target_location || '-'}</small></td>
					</tr>
				`).join('');

				$('#drawer-content').html(`
					<div class="mb-3 d-flex justify-content-between align-items-center">
						<div>
							<span class="badge badge-primary" style="font-size:12px;">${d.status}</span>
							<span class="badge badge-info" style="font-size:12px;">${d.fill_status}</span>
							<span class="badge badge-secondary" style="font-size:12px;">Owner: ${d.owner_type}</span>
						</div>
						<button class="btn btn-xs btn-outline-danger font-weight-bold" onclick="window.open_mark_damage_dialog('${d.name}', () => window.open_360_drawer('${d.name}'))">
							⚠️ Mark Damage
						</button>
					</div>

					<table class="table table-sm table-bordered" style="font-size:12px;">
						<tr><th>Location</th><td>${d.current_location || '-'}</td></tr>
						<tr><th>Custodian</th><td>${d.custodian || 'Company'}</td></tr>
						<tr><th>Hydro Test Due</th><td class="${d.test_due_days < 0 ? 'text-danger font-weight-bold' : ''}">${d.test_due || 'N/A'}</td></tr>
						<tr><th>Holder Since</th><td>${d.holder_since || '-'} (${d.days_held} days)</td></tr>
						<tr><th>Current Item</th><td>${d.current_item || 'None'}</td></tr>
					</table>

					<h6 class="font-weight-bold mt-4 mb-2">Recent Ledger Trail</h6>
					<table class="table table-sm table-striped" style="font-size:11px;">
						<thead><tr><th>Date</th><th>Movement</th><th>Target</th></tr></thead>
						<tbody>${ledger_rows || '<tr><td colspan="3" class="text-muted">No ledger trail found</td></tr>'}</tbody>
					</table>
				`);
			}
		}
	});
};

window.close_drawer = function () {
	$('#drawer-360').removeClass('open');
	$('#drawer-backdrop').hide();
};

// ---------------------------------------------------------------------------
// TAB 2: Filling Entry Logic
// ---------------------------------------------------------------------------
window.on_filling_dn_change = function () {
	if (!window.f_fill_dn) return;
	let dn = window.f_fill_dn.get_value();
	if (!dn) {
		$('#filling-dn-items-card').hide();
		$('#filling-active-banner').hide();
		$('#filling-summary-bar').hide();
		$('#filling-containers-area').html('<p class="text-muted m-0 p-2 text-center">Select a Delivery Note above to view required gas items and compatible empty containers.</p>');
		window.filling_dn_items = [];
		window.filling_item_code = null;
		window.filling_batch_no = null;
		window.filling_target_qty = 0;
		return;
	}

	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_dn_filling_items',
		args: { delivery_note: dn },
		callback: function (r) {
			if (r.message) {
				if (r.message.customer && window.f_fill_cust) {
					window.f_fill_cust.set_value(r.message.customer);
				}
				window.render_filling_dn_items(r.message.items);
			}
		}
	});
};

window.render_filling_dn_items = function (items) {
	if (!items || items.length === 0) {
		$('#filling-dn-items-area').html('<p class="text-muted p-2 m-0">No gas items found in this Delivery Note.</p>');
		$('#filling-dn-items-card').slideDown();
		return;
	}

	window.filling_dn_items = items;

	let rows = items.map((item, idx) => {
		let is_done = item.pending_filling_qty <= 0;
		let batch_display = item.batch_no ? `<span class="badge badge-secondary" style="font-size:11px;">${item.batch_no}</span>` : '<span class="text-muted font-italic">None</span>';
		return `
			<tr id="dn-item-row-${idx}">
				<td>
					<strong>${item.item_code}</strong>
					${item.item_name && item.item_name !== item.item_code ? `<br><small class="text-muted">${item.item_name}</small>` : ''}
				</td>
				<td>${batch_display}</td>
				<td><span class="badge badge-info">${item.default_container_type || 'Any Compatible'}</span></td>
				<td>${item.qty} Vol</td>
				<td>${item.filled_qty} Vol (${item.filled_conts} conts)</td>
				<td><strong>${item.pending_filling_qty} Vol</strong></td>
				<td><span class="badge ${is_done ? 'badge-success' : 'badge-warning'}">${is_done ? '✓ Filled' : 'Pending Filling'}</span></td>
				<td class="text-center">
					<button class="btn btn-sm ${is_done ? 'btn-outline-success' : 'btn-primary'} btn-fill-select" data-idx="${idx}" onclick="window.select_dn_item_for_filling(${idx})">
						${is_done ? 'Re-Fill Additional' : 'Select Containers to Fill'}
					</button>
				</td>
			</tr>
		`;
	}).join('');

	let html = `
		<table class="table table-bordered table-sm m-0" style="font-size:12px;">
			<thead style="background-color: var(--control-bg, #f3f4f6);">
				<tr>
					<th>Gas Item</th>
					<th>Batch No</th>
					<th>Container Spec</th>
					<th>Requested Qty</th>
					<th>Filled Vol</th>
					<th>Pending Filling</th>
					<th>Status</th>
					<th class="text-center">Action</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>
	`;

	$('#filling-dn-items-area').html(html);
	$('#filling-dn-items-card').slideDown();

	// Auto-select first item with pending volume, or first item if all filled
	let target_idx = items.findIndex(i => i.pending_filling_qty > 0);
	if (target_idx === -1) target_idx = 0;
	window.select_dn_item_for_filling(target_idx);
};

window.select_dn_item_for_filling = function (idx) {
	let item = (window.filling_dn_items || [])[idx];
	if (!item) return;

	window.filling_item_code = item.item_code;
	window.filling_batch_no = item.batch_no || '';
	window.filling_serial_bundle = item.serial_and_batch_bundle || '';
	window.filling_target_qty = item.pending_filling_qty || item.qty || 0;

	// Highlight selected row button
	$('.btn-fill-select').removeClass('btn-success font-weight-bold').addClass('btn-primary');
	$(`.btn-fill-select[data-idx="${idx}"]`).removeClass('btn-primary').addClass('btn-success font-weight-bold');

	// Display Active Banner
	$('#active-item-title').text(`Gas Item: ${item.item_code}`);
	$('#active-item-batch').html(item.batch_no ? `Batch No: <b>${item.batch_no}</b>` : `<span class="text-muted">Batch: Auto / None</span>`);
	$('#active-item-target').text(`Target Pending: ${window.filling_target_qty} Vol`);
	$('#filling-active-banner').slideDown();

	window.fetch_containers_for_filling();
};

window.fetch_containers_for_filling = function () {
	let item_code = window.filling_item_code;
	if (!item_code) return;

	let target_qty = window.filling_target_qty || 0;
	let area = $('#filling-containers-area');
	$('#filling-summary-bar').slideDown();
	area.html('<p class="text-muted p-4 text-center"><i class="fa fa-spinner fa-spin"></i> Fetching compatible empty containers for <b>' + item_code + '</b>...</p>');

	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_containers_for_board',
		args: { status: 'Available', item_code: item_code, limit: 100 },
		callback: function (r) {
			if (r.message) {
				let list = r.message.filter(c => c.fill_status === "Empty");
				if (list.length === 0) {
					area.html(`
						<div class="alert alert-warning m-0 text-center" style="border-radius:6px;">
							⚠️ No compatible empty containers found in store for gas item <b>${item_code}</b>.
							<br><small class="text-muted">Containers must be in <b>Available</b> status, <b>Empty</b> fill status, and match allowed Container Types (configured in Item Capacity Matrix or Item default container type).</small>
						</div>
					`);
					$('#filling-auto-distribute-btn-wrapper').empty();
					window.update_filling_summary();
					return;
				}

				if (target_qty > 0) {
					$('#filling-auto-distribute-btn-wrapper').html(`
						<button class="btn btn-xs btn-outline-primary font-weight-bold" onclick="window.auto_distribute_filling_vol(${target_qty})">⚡ Auto-Distribute ${target_qty} Vol</button>
					`);
				} else {
					$('#filling-auto-distribute-btn-wrapper').empty();
				}

				$('#filling-containers-header-title').html(`Select Compatible Empty Containers for <b>${item_code}</b> (${list.length} Compatible Found)`);

				let cards_html = list.map(c => window.render_filling_container_card(c)).join('');

				area.html(`
					<div class="row">
						${cards_html}
					</div>
				`);

				window.update_filling_summary();
			}
		}
	});
};

window.render_filling_container_card = function (c) {
	let cap = parseFloat(c.capacity) || 400;
	return `
		<div class="col-md-4 col-lg-3 col-sm-6 mb-3">
			<div class="container-grid-box fill-grid-box" data-id="${c.name}" data-cap="${cap}" onclick="window.toggle_fill_card('${c.name}', event)">
				<div class="d-flex justify-content-between align-items-center mb-1">
					<div class="font-weight-bold" style="font-size:14px; color: var(--text-color, #1f2937);">
						<input type="checkbox" class="fill-cb mr-1" data-id="${c.name}" onclick="event.stopPropagation(); window.on_fill_card_check('${c.name}');">
						${c.name}
					</div>
					<span class="badge badge-light" style="font-size:10px;">${c.type || 'Cyl'}</span>
				</div>
				<div class="text-muted mb-2" style="font-size:11px;">
					<span>📍 ${c.current_location || 'Plant Store'}</span> &bull; 
					<span>Cap: <b>${cap} Vol</b></span>
				</div>
				${c.test_due ? `
					<div class="mb-2" style="font-size:11px;">
						<span class="badge ${c.test_status === 'expired' ? 'badge-danger' : c.test_status === 'warning' ? 'badge-warning' : 'badge-success'}" style="font-size:10px;">
							${c.test_status === 'expired' ? '⚠️ Hydro Expired' : `Hydro: ${c.test_due}`}
						</span>
					</div>
				` : ''}
				<div class="d-flex align-items-center gap-2 mt-2 pt-2 border-top" onclick="event.stopPropagation();">
					<label class="m-0 text-muted" style="font-size:11px; white-space:nowrap;">Fill Vol:</label>
					<input type="number" class="form-control form-control-sm fill-qty-input" data-id="${c.name}" value="${cap}" style="font-weight:600;" min="0" max="${cap}" onchange="window.update_filling_summary()" onkeyup="window.update_filling_summary()">
				</div>
			</div>
		</div>
	`;
};

window.toggle_fill_card = function (cname, event) {
	let cb = $(`.fill-cb[data-id="${cname}"]`);
	if (!cb.length || cb.prop('disabled')) return;
	let new_state = !cb.prop('checked');
	cb.prop('checked', new_state);
	window.on_fill_card_check(cname);
};

window.on_fill_card_check = function (cname) {
	let cb = $(`.fill-cb[data-id="${cname}"]`);
	let is_checked = cb.prop('checked');
	let box = cb.closest('.fill-grid-box');
	let input = box.find('.fill-qty-input');
	let cap = parseFloat(box.data('cap')) || 400;

	if (is_checked) {
		box.addClass('selected-box');
		// Calculate current filled volume BEFORE checking this card
		let current_filled = 0;
		$('.fill-cb:checked').not(cb).each(function () {
			let cid = $(this).data('id');
			current_filled += parseFloat($(`.fill-qty-input[data-id="${cid}"]`).val()) || 0;
		});

		let req_vol = parseFloat(window.filling_target_qty) || 0;
		if (req_vol > 0) {
			let remaining_need = Math.max(0, req_vol - current_filled);
			let fill_val = Math.min(cap, remaining_need);
			input.val(fill_val > 0 ? fill_val : cap);
		}
	} else {
		box.removeClass('selected-box');
	}
	window.update_filling_summary();
};

window.auto_distribute_filling_vol = function (target_qty) {
	let remaining = target_qty;
	let allocated_count = 0;
	let summary = [];

	$('.fill-grid-box').each(function () {
		let cid = $(this).data('id');
		let cap = parseFloat($(this).data('cap')) || 400;
		let cb = $(this).find('.fill-cb');

		if (remaining <= 0) {
			cb.prop('checked', false);
			$(this).removeClass('selected-box');
			return;
		}

		let fill_val = Math.min(remaining, cap);
		$(this).find('.fill-qty-input').val(fill_val);
		cb.prop('checked', true);
		$(this).addClass('selected-box');

		summary.push(`${cid}: ${fill_val} Vol`);
		remaining -= fill_val;
		allocated_count++;
	});

	window.update_filling_summary();

	if (summary.length > 0) {
		frappe.show_alert({
			message: `Auto-distributed ${target_qty} Vol across ${allocated_count} container(s): ${summary.join(', ')}`,
			indicator: 'green'
		});
	}
};

window.update_filling_summary = function () {
	let req_vol = parseFloat(window.filling_target_qty) || 0;
	let fill_vol = 0;
	let cont_count = 0;

	$('.fill-cb:checked').each(function () {
		let cid = $(this).data('id');
		let qty = parseFloat($(`.fill-qty-input[data-id="${cid}"]`).val()) || 0;
		cont_count++;
		fill_vol += qty;
	});

	let pending_vol = Math.max(0, req_vol - fill_vol);

	$('#summary-req-vol').text(`${req_vol} Vol`);
	$('#summary-fill-vol').text(`${fill_vol} Vol`);
	$('#summary-cont-count').text(`(${cont_count} Container${cont_count !== 1 ? 's' : ''})`);
	$('#summary-pending-vol').text(`${pending_vol} Vol`);

	let badge_html = '';
	if (fill_vol === 0) {
		badge_html = '<span class="badge badge-secondary" style="font-size:12px; padding:6px 12px;">Pending</span>';
	} else if (req_vol > 0 && fill_vol < req_vol) {
		badge_html = `<span class="badge badge-warning" style="font-size:12px; padding:6px 12px;">Partially Filled (${fill_vol} / ${req_vol} Vol)</span>`;
	} else {
		badge_html = `<span class="badge badge-success" style="font-size:12px; padding:6px 12px;">✓ Fully Filled (${fill_vol}${req_vol ? ' / ' + req_vol : ''} Vol)</span>`;
	}
	$('#summary-status-badge').html(badge_html);

	// Fulfillment locking: If requested volume is fulfilled (req_vol > 0 and fill_vol >= req_vol),
	// lock unselected container cards so user cannot over-select extra containers!
	if (req_vol > 0 && fill_vol >= req_vol) {
		$('.fill-grid-box:not(.selected-box)').each(function () {
			$(this).css({ opacity: '0.45', 'pointer-events': 'none', cursor: 'not-allowed' });
			$(this).find('.fill-cb').prop('disabled', true);
			if (!$(this).find('.fulfilled-lock-badge').length) {
				$(this).append('<div class="fulfilled-lock-badge text-center mt-1"><span class="badge badge-secondary" style="font-size:10px;">🔒 Volume Fulfilled</span></div>');
			}
		});
	} else {
		// Re-enable unselected container cards if fill_vol < req_vol
		$('.fill-grid-box:not(.selected-box)').each(function () {
			$(this).css({ opacity: '1', 'pointer-events': 'auto', cursor: 'pointer' });
			$(this).find('.fill-cb').prop('disabled', false);
			$(this).find('.fulfilled-lock-badge').remove();
		});
	}
};

window.execute_filling_submission = function () {
	let dn = window.f_fill_dn ? window.f_fill_dn.get_value() : null;
	if (!dn) { frappe.msgprint("Please select a Delivery Note."); return; }

	let item = window.filling_item_code;
	if (!item) { frappe.msgprint("Please select a Gas Item to fill from the Delivery Note items table."); return; }

	let batch = window.filling_batch_no || '';

	let selected = [];
	$('.fill-cb:checked').each(function () {
		let cid = $(this).data('id');
		let qty = parseFloat($(`.fill-qty-input[data-id="${cid}"]`).val()) || 0;
		selected.push({ name: cid, qty_filled: qty, batch: batch });
	});

	if (selected.length === 0) { frappe.msgprint("Please select at least one container to fill."); return; }

	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.create_filling_entry',
		args: {
			item: item,
			customer: window.f_fill_cust ? window.f_fill_cust.get_value() : null,
			delivery_note: dn,
			containers_json: JSON.stringify(selected)
		},
		callback: function (r) {
			if (r.message && r.message.name) {
				frappe.show_alert({ message: `Container Filling Entry ${r.message.name} Submitted! Containers updated to Filled status.`, indicator: 'green' });
				window.on_filling_dn_change();
			}
		}
	});
};

// ---------------------------------------------------------------------------
// TAB 4: Holdings & Days Table
// ---------------------------------------------------------------------------
window.load_holdings_data = function () {
	$('#holdings-table-area').html('<p class="text-muted p-2"><i class="fa fa-spinner fa-spin"></i> Calculating party holdings & days...</p>');
	frappe.call({
		method: 'container_tracker.container_tracker.page.movement_entry.movement_entry.get_holdings',
		args: { party_type: $('#holdings-type-filter').val() },
		callback: function (r) {
			if (r.message) {
				let rows = r.message.map(h => {
					let badge_class = h.urgency === 'overdue' ? 'days-badge-overdue' : h.urgency === 'warning' ? 'days-badge-warning' : 'days-badge-ok';
					return `
						<tr>
							<td><strong>${h.name}</strong></td>
							<td><span class="badge badge-light">${h.status}</span></td>
							<td>${h.custodian || '-'}</td>
							<td>${h.holder_since || '-'}</td>
							<td><span class="badge ${badge_class}">${h.days_held} Days</span></td>
							<td>${h.test_due || '-'}</td>
							<td>
								<button class="btn btn-xs btn-outline-primary" onclick="window.quick_receive_from_party('${h.name}', '${h.custodian_type}', '${h.custodian}')">Receive Back</button>
							</td>
						</tr>
					`;
				}).join('');

				$('#holdings-table-area').html(`
					<table class="table table-sm table-bordered" style="font-size:12px;">
						<thead><tr><th>Container</th><th>Status</th><th>Custodian / Party</th><th>Dispatched Date</th><th>Days Held</th><th>Hydro Expiry</th><th>Action</th></tr></thead>
						<tbody>${rows || '<tr><td colspan="7" class="text-muted text-center">No containers currently held by external parties</td></tr>'}</tbody>
					</table>
				`);
			}
		}
	});
};

window.quick_receive_from_party = function (container_id, party_type, party) {
	let purpose = party_type === "Customer" ? "Receive from Customer" : "Receive from Supplier";
	$('#cc-main-tabs a[href="#tab-new-movement"]').tab('show');
	if (window.f_purpose) window.f_purpose.set_value(purpose);

	setTimeout(() => {
		if (window.f_party_type) window.f_party_type.set_value(party_type);
		if (window.f_party) window.f_party.set_value(party);
		setTimeout(() => {
			$(`.c-cb[data-id="${container_id}"]`).prop('checked', true);
			window.on_checkbox_toggled(0);
		}, 300);
	}, 200);
};

window.open_reserve_containers_dialog = function () {
	let selected = $('.c-cb:checked').map(function () {
		return $(this).attr('data-id');
	}).get();

	if (selected.length === 0) {
		frappe.msgprint({
			title: __('No Containers Selected'),
			indicator: 'orange',
			message: __('Please select at least one container to reserve.')
		});
		return;
	}

	let default_party_type = window.f_party_type ? window.f_party_type.get_value() : '';
	let default_party = window.f_party ? window.f_party.get_value() : '';
	let purpose = window.f_purpose ? window.f_purpose.get_value() : '';

	if (!default_party_type && purpose) {
		if (purpose.includes('Customer')) default_party_type = 'Customer';
		else if (purpose.includes('Supplier')) default_party_type = 'Supplier';
		else default_party_type = 'Customer';
	}

	let dialog = new frappe.ui.Dialog({
		title: __('Reserve Containers'),
		fields: [
			{
				label: __('Party Type'),
				fieldname: 'party_type',
				fieldtype: 'Link',
				options: 'DocType',
				default: default_party_type || 'Customer',
				get_query: function () {
					return { filters: { name: ['in', ['Customer', 'Supplier']] } };
				},
				reqd: 1,
				onchange: function () {
					dialog.set_df_property('party', 'options', dialog.get_value('party_type'));
				}
			},
			{
				label: __('Party (Customer / Supplier)'),
				fieldname: 'party',
				fieldtype: 'Dynamic Link',
				options: default_party_type || 'Customer',
				default: default_party,
				reqd: 1
			},
			{
				fieldname: 'column_break_dates',
				fieldtype: 'Column Break'
			},
			{
				label: __('Reservation From Date'),
				fieldname: 'from_date',
				fieldtype: 'Date',
				default: frappe.datetime.get_today(),
				reqd: 1
			},
			{
				label: __('Reserved Until Date (Return to Owner)'),
				fieldname: 'return_to_owner',
				fieldtype: 'Date',
				default: frappe.datetime.add_days(frappe.datetime.get_today(), 14),
				reqd: 1,
				description: __('Container status will be updated to Reserved until this date.')
			},
			{
				fieldname: 'section_break_selected',
				fieldtype: 'Section Break',
				label: __('Selected Containers')
			},
			{
				fieldname: 'selected_containers_html',
				fieldtype: 'HTML',
				options: `
					<div class="p-2 border rounded bg-light" style="max-height: 120px; overflow-y: auto;">
						${selected.map(id => `<span class="badge badge-info mr-1 mb-1" style="font-size:12px;">📌 ${id}</span>`).join('')}
					</div>
				`
			}
		],
		primary_action_label: __('Confirm Reservation'),
		primary_action: function (values) {
			if (!values.return_to_owner) {
				frappe.msgprint(__('Please specify the Reserved Until Date.'));
				return;
			}

			dialog.get_primary_btn().prop('disabled', true);

			let doc_type = window.f_doctype ? window.f_doctype.get_value() : null;
			let doc_name = window.f_docname ? window.f_docname.get_value() : null;

			frappe.call({
				method: 'container_tracker.container_tracker.doctype.container_reservation_entry.container_reservation_entry.create_reservation_entry',
				args: {
					company: frappe.defaults.get_user_default("Company"),
					party_type: values.party_type,
					party: values.party,
					reference_doctype: doc_type,
					reference_name: doc_name,
					from_date: values.from_date,
					to_date: values.return_to_owner,
					containers: JSON.stringify(selected)
				},
				callback: function (r) {
					dialog.hide();
					if (r && r.message) {
						frappe.show_alert({
							message: r.message.message,
							indicator: 'green'
						}, 7);

						let docname = window.f_docname ? window.f_docname.get_value() : null;
						if (docname) {
							window.on_docname_change();
						} else {
							window.fetch_direct_containers();
						}
					}
				},
				always: function () {
					dialog.get_primary_btn().prop('disabled', false);
				}
			});
		}
	});

	dialog.show();
};
