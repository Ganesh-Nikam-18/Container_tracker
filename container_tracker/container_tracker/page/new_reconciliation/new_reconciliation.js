frappe.pages['new-reconciliation'] = frappe.pages['new-reconciliation'] || {};
frappe.pages['new-reconciliation'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Container Reconciliation',
		single_column: true
	});

	$(wrapper).closest('.layout-main-section').css({
		'max-width': '100%',
		'padding': '0 30px'
	});



	let btn_back = page.add_inner_button('Back to list', () => {
		frappe.set_route('List', 'Reconciliation');
	});
	let btn_reset = page.add_inner_button('Reset', () => {
		reset_all();
	});
	let btn_submit = page.add_inner_button('Submit reconciliation', () => submit_entry());
	btn_submit.addClass('btn-primary').css({ 'color': '#fff', 'background-color': 'var(--primary-color)', 'font-weight': '600' });
	btn_submit.prop('disabled', true);

	// Inject HTML
	$(page.body).html(`
<style>
	.recon-wrapper { max-width: 100%; margin: 0; padding: 15px 30px; display: flex; gap: 20px; }
	.recon-left { flex: 1; min-width: 0; }
	.recon-right { width: 320px; flex-shrink: 0; }
	
	.rc-card { background: var(--card-bg, #ffffff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 6px; margin-bottom: 20px; overflow: visible; }
	.rc-card-header { padding: 12px 20px; background-color: var(--card-bg, #f9fafb); border-bottom: 1px solid var(--border-color, #e5e7eb); font-weight: 600; font-size: 13px; color: var(--text-color, #374151); border-top-left-radius: 5px; border-top-right-radius: 5px; }
	.rc-card-body { padding: 20px; }
	
	.f-row { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px; }
	.f-col { flex: 1; min-width: 150px; }
	.f-col .frappe-control { margin-bottom: 0 !important; }
	.f-col .form-group { margin-bottom: 0 !important; }
	.f-label { display: block; font-size: 12px; color: var(--text-muted, #6b7280); margin-bottom: 6px; }
	.f-input, .f-select { width: 100%; border: 1px solid var(--border-color, #d1d5db); border-radius: 4px; padding: 6px 10px; font-size: 13px; outline: none; background: var(--control-bg, #fff); color: var(--text-color); height: 32px; box-sizing: border-box; }
	.f-input:focus, .f-select:focus { border-color: var(--primary-color, #3b82f6); }
	
	/* Tag Area */
	.outstanding-area { margin-top: 20px; }
	.tag-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
	.ct-tag { border: 1px solid var(--border-color, #d1d5db); padding: 4px 10px; font-size: 11px; border-radius: 4px; color: var(--text-color, #4b5563); cursor: pointer; background: var(--control-bg, #fff); font-family: monospace; font-weight: 600; }
	.ct-tag:hover { border-color: var(--primary-color, #3b82f6); color: var(--primary-color, #3b82f6); }
	
	/* Table */
	.table-containers { width: 100%; border-collapse: collapse; font-size: 12px; }
	.table-containers th { text-align: left; padding: 10px; border-bottom: 1px solid var(--border-color, #e5e7eb); color: var(--text-muted, #6b7280); font-weight: 500; }
	.table-containers td { padding: 10px; border-bottom: 1px solid var(--border-color, #f3f4f6); color: var(--text-color, #111827); vertical-align: middle; }
	.table-empty { text-align: center; padding: 40px !important; color: var(--text-muted, #9ca3af) !important; background: var(--control-bg, #f9fafb); }
	
	/* Inline Inputs */
	.inline-input { width: 100%; border: 1px solid var(--border-color, #d1d5db); border-radius: 4px; padding: 4px 8px; font-size: 12px; background: var(--control-bg, #fff); color: var(--text-color); }
	.inline-select { border: 1px solid var(--border-color, #d1d5db); border-radius: 4px; padding: 4px 8px; font-size: 12px; background: var(--control-bg, #fff); color: var(--text-color); }
	.remove-btn { color: var(--red-500, #ef4444); background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 600; padding: 4px; }
	
	/* Right Sidebar Balances */
	.bal-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color, #f3f4f6); font-size: 12px; color: var(--text-color, #4b5563); }
	.bal-row:last-child { border-bottom: none; font-weight: 600; color: var(--text-color, #111827); margin-top: 5px; padding-top: 10px; border-top: 1px solid var(--border-color, #e5e7eb); }
	.bal-val { font-weight: 600; color: var(--text-color, #111827); }
	
	.info-text { font-size: 11px; color: var(--text-muted, #6b7280); line-height: 1.6; }
	.info-text strong { color: var(--text-color, #374151); font-weight: 600; }
	
	/* Scanner Group */
	.scanner-group { display: flex; gap: 5px; }
	.btn-icon { background: var(--control-bg, #f3f4f6); border: 1px solid var(--border-color, #d1d5db); padding: 0 12px; border-radius: 4px; color: var(--text-color, #4b5563); cursor: pointer; white-space: nowrap; }
	.btn-icon:hover { background: var(--bg-light-gray, #e5e7eb); }
	/* Camera Box Inline */
	.camera-box { background: #000; border-radius: 8px; min-height: 200px; color: #9ca3af; font-size: 13px; position: relative; overflow: hidden; text-align: center; }
	.scanner-laser { position: absolute; width: 100%; height: 2px; background: #ef4444; box-shadow: 0 0 8px #ef4444, 0 0 15px #ef4444; top: 0; left: 0; animation: scan-laser 2s infinite linear; z-index: 10; display: none; }
	.camera-status { min-height: 20px; margin-top: 8px; font-size: 12px; color: var(--text-muted, #6b7280); }
	.camera-status.scanning { color: var(--blue-600, #2563eb); }
	.camera-status.warning { color: var(--orange-600, #c2410c); }
	.camera-status.success { color: var(--green-600, #059669); }
	@keyframes scan-laser { 0% { top: 0%; } 50% { top: 98%; } 100% { top: 0%; } }
	
	/* Recent List */
	.recent-row { display: flex; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--border-color, #f3f4f6); }
	.recent-row:last-child { border-bottom: none; }
	.rr-id { font-size: 13px; font-weight: 600; color: var(--text-color, #111827); }
	.rr-meta { font-size: 11px; color: var(--text-muted, #9ca3af); margin-top: 3px; }
	.rr-badge { background: var(--bg-green-100, #d1fae5); color: var(--green-700, #047857); font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 12px; }
	.rr-badge.damaged { background: var(--bg-red-100, #fee2e2); color: var(--red-700, #b91c1c); }
</style>

<div class="recon-wrapper">
	<div class="recon-left">
		
		<!-- Card 1: Details -->
		<div class="rc-card">
			<div class="rc-card-header">1 · Customer and inward details</div>
			<div class="rc-card-body">
				<div class="f-row">
					<div class="f-col" id="cust-wrapper">
						<label class="f-label">Customer</label>
						<!-- Frappe Control will mount here -->
					</div>
					<div class="f-col" id="trans-wrapper">
						<label class="f-label">Transporter</label>
						<!-- Frappe Control will mount here -->
					</div>
					<div class="f-col" style="flex: 2;">
						<label class="f-label">Scan returned container</label>
						<div class="scanner-group">
							<input type="text" id="inp-barcode" class="f-input" placeholder="Scan or type container ID / barcode" disabled>
							<button class="btn-icon" id="btn-add" disabled>Add</button>
							<button class="btn-icon" id="btn-camera" style="display:flex; align-items:center; gap:5px;"><i class="fa fa-camera"></i> Scan</button>
						</div>
						<div class="camera-box" id="camera-reader" style="display:none; margin-top:10px;">
							<div class="scanner-laser" id="scanner-laser"></div>
						</div>
						<div class="camera-status" id="camera-status">Select a customer, then start the camera.</div>
					</div>
				</div>
				
				<div class="outstanding-area">
					<label class="f-label">Outstanding with <span id="lbl-cust-name">-</span> — tap to receive</label>
					<div class="tag-list" id="quick-pick-list">
						<span style="font-size:11px; color:#9ca3af;">Select customer to view outstanding containers</span>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Card 2: Received -->
		<div class="rc-card">
			<div class="rc-card-header">2 · Received containers (<span id="lbl-count">0</span>)</div>
			<div class="rc-card-body" style="padding: 0; max-height: 400px; overflow-y: auto;">
				<table class="table-containers">
					<thead>
						<tr>
							<th style="padding-left: 20px;">Container</th>
							<th>Type</th>
							<th>Original DN</th>
							<th>Heel req.</th>
							<th>Heel ret.</th>
							<th>Penalty (₹)</th>
							<th>Condition</th>
							<th>Charge to</th>
							<th>Amount (₹)</th>
							<th>Remarks</th>
							<th></th>
						</tr>
					</thead>
					<tbody id="tbl-scanned">
						<tr><td colspan="11" class="table-empty">No containers scanned yet.</td></tr>
					</tbody>
				</table>
			</div>
		</div>
		
		<!-- Card 3: Recent -->
		<div class="rc-card">
			<div class="rc-card-header">Recent reconciliations</div>
			<div class="rc-card-body" style="padding: 0;" id="recent-list">
				<div style="padding: 20px; font-size: 12px; color: #9ca3af; text-align: center;">Loading...</div>
			</div>
		</div>

	</div>
	
	<div class="recon-right">
		<!-- Sidebar 1: Balances -->
		<div class="rc-card">
			<div class="rc-card-header">Reconciliation balance</div>
			<div class="rc-card-body">
				<div class="bal-row">
					<span>Delivered & outstanding</span>
					<span class="bal-val" id="bal-out">0</span>
				</div>
				<div class="bal-row">
					<span>Received now</span>
					<span class="bal-val" id="bal-rec">0</span>
				</div>
				<div class="bal-row">
					<span>Still with customer</span>
					<span class="bal-val" id="bal-still">0</span>
				</div>
				<div class="bal-row">
					<span>Damaged / lost</span>
					<span class="bal-val" id="bal-dmg">0</span>
				</div>
				<div class="bal-row">
					<span>Damage / loss charges</span>
					<span class="bal-val" id="bal-charges">₹0</span>
				</div>
				<div class="bal-row">
					<span>Heel shortfall penalty</span>
					<span class="bal-val" id="bal-penalty">₹0</span>
				</div>
				<div class="bal-row">
					<span>Total recovery</span>
					<span class="bal-val" id="bal-total">₹0</span>
				</div>
			</div>
		</div>
		
		<!-- Sidebar 2: Charge Defaults -->
		<div class="rc-card">
			<div class="rc-card-header">Charge defaults (from Container Settings)</div>
			<div class="rc-card-body info-text" id="settings-panel">
				<div>Loading settings...</div>
			</div>
		</div>
	</div>
</div>
	`);

	// Global State
	let state = {
		customer: null,
		transporter: null,
		outstanding_containers: [],
		scanned_containers: [],
		settings: {}
	};

	const tbl_body = $('#tbl-scanned');
	const inp_barcode = $('#inp-barcode');
	const btn_add = $('#btn-add');
	const btn_cam = $('#btn-camera');
	const camera_status = $('#camera-status');

	// Frappe Controls
	let customer_field = frappe.ui.form.make_control({
		parent: $('#cust-wrapper'),
		df: { 
			fieldtype: 'Link', 
			options: 'Customer', 
			fieldname: 'customer',
			onchange: function() {
				let val = this.get_value() || null;
				if (state.customer !== val) {
					let previous_customer = state.customer;
					state.customer = val;
					$('#lbl-cust-name').text(state.customer || '-');
					inp_barcode.val('');

					if (!state.customer) {
						reset_all();
						return;
					}

					if (previous_customer && state.scanned_containers.length) {
						clear_received_containers();
						frappe.show_alert({
							message: 'Received containers were cleared because the customer changed.',
							indicator: 'orange'
						});
					}

					set_scanner_enabled(true);
					$('#quick-pick-list').html('<span style="font-size:11px; color:#9ca3af;">Loading outstanding containers...</span>');
					let selected_customer = state.customer;

					call_api("get_reconciliation_data", { customer: state.customer }, (r) => {
						if (state.customer === selected_customer && r.message) {
							state.outstanding_containers = r.message.containers || [];
							render_quick_picks();
							update_balances();
						}
					});
				}
			}
		},
		render_input: true,
		only_input: true
	});

	let transporter_field = frappe.ui.form.make_control({
		parent: $('#trans-wrapper'),
		df: {
			fieldtype: 'Link',
			options: 'Supplier',
			fieldname: 'transporter',
			get_query: function () {
				return { filters: { is_transporter: 1, disabled: 0 } };
			}
		},
		render_input: true,
		only_input: true
	});

	// API Helpers
	const call_api = (method, args, callback, always) => {
		frappe.call({
			method: "container_tracker.container_tracker.page.new_reconciliation.new_reconciliation." + method,
			args: args,
			callback: callback,
			always: always
		});
	};

	// Transporter Change Handling (if any)
	transporter_field.$input.on('change', () => {
		state.transporter = transporter_field.get_value();
	});

	set_scanner_enabled(false);

	function set_scanner_enabled(enabled) {
		inp_barcode.prop('disabled', !enabled);
		btn_add.prop('disabled', !enabled);
		btn_cam.prop('disabled', !enabled);
		if (!enabled) {
			set_camera_status('Select a customer, then start the camera.');
		}
	}

	function clear_received_containers() {
		state.scanned_containers = [];
		render_table();
	}

	// Add Container
	const add_container = (passed_barcode = null) => {
		if (!state.customer) {
			frappe.show_alert({ message: 'Select a customer before adding a returned container.', indicator: 'orange' });
			return;
		}

		let barcode = passed_barcode || inp_barcode.val().trim();
		if (!barcode) return;

		let selected_customer = state.customer;
		inp_barcode.val('').prop('disabled', true);
		btn_add.prop('disabled', true);
		btn_cam.prop('disabled', true);

		call_api("validate_and_fetch_container", { barcode: barcode, customer: selected_customer }, (r) => {
			if (state.customer !== selected_customer) {
				return;
			}

			if (!r.exc && r.message) {
				let c = r.message;

				if (c.error) {
					frappe.show_alert({ message: c.error, indicator: "orange" });
				} else {
					if (state.scanned_containers.find(x => x.name === c.name)) {
						frappe.show_alert({ message: `Container ${c.name} already scanned.`, indicator: "orange" });
					} else {
						// Add defaults
						c.condition = "Good";
						c.charge_to = "None";
						c.amount = 0;
						c.penalty = 0;
						c.heel_req = c.heel_req || 0;
						c.heel_back = 0;
						c.remarks = "";

						state.scanned_containers.push(c);
						render_table();
						frappe.show_alert({ message: `${c.name} received!`, indicator: 'green' });
					}
				}
			}
			set_scanner_enabled(Boolean(state.customer));
			if (state.customer) inp_barcode.focus();
		});
	};

	inp_barcode.on('keypress', function (e) {
		if (e.which === 13) {
			e.preventDefault();
			add_container();
		}
	});

	btn_add.on('click', () => add_container());

	// Quick Pick
	function render_quick_picks() {
		if (!state.outstanding_containers || state.outstanding_containers.length === 0) {
			$('#quick-pick-list').html('<span style="font-size: 11px; color: #9ca3af;">No outstanding containers found.</span>');
			return;
		}
		let available_containers = state.outstanding_containers.filter(
			c => !state.scanned_containers.find(sc => sc.name === c.name)
		);
		let html = `<span style="font-size:11px; color:#6b7280; width:100%;">${available_containers.length} container(s) outstanding. You can also scan or type any returned container.</span>`;
		available_containers.forEach(c => {
			let title = `Type: ${c.type} | DN: ${c.original_dn || '-'}`;
			html += `<div class="ct-tag" title="${title}" onclick="$('#inp-barcode').val('${c.name}'); $(this).css({'opacity':'0.5', 'pointer-events':'none'}); $('#btn-add').click();">${c.name}</div>`;
		});
		if (available_containers.length === 0) {
			html = '<span style="font-size: 11px; color: #10b981;">All outstanding containers received!</span>';
		}
		$('#quick-pick-list').html(html);
	}

	// Dynamic Table
	function render_table() {
		if (state.scanned_containers.length === 0) {
			tbl_body.html(`<tr><td colspan="11" class="table-empty">No containers scanned yet.</td></tr>`);
			btn_submit.prop('disabled', true);
			update_balances();
			render_quick_picks();
			return;
		}

		let rows = '';
		state.scanned_containers.forEach((c, idx) => {
			rows += `
				<tr data-idx="${idx}">
					<td style="padding-left: 20px; font-weight: 600;">${c.name}</td>
					<td>${c.type}</td>
					<td style="color:#6b7280; font-size: 11px;">${c.original_dn || '-'}</td>
					<td><input type="number" class="inline-input bind-input" data-field="heel_req" value="${c.heel_req}" readonly style="background-color: var(--control-bg-disabled, #f9fafb); color: var(--text-muted, #9ca3af); cursor: not-allowed;"></td>
					<td><input type="number" class="inline-input bind-input" data-field="heel_back" value="${c.heel_back}"></td>
					<td><input type="number" class="inline-input" value="${c.penalty}" readonly style="background-color: var(--control-bg-disabled, #f9fafb); color: var(--text-muted, #9ca3af); cursor: not-allowed;"></td>
					<td>
						<select class="inline-select bind-input" data-field="condition">
							<option value="Good" ${c.condition === 'Good' ? 'selected' : ''}>Good</option>
							<option value="Damaged" ${c.condition === 'Damaged' ? 'selected' : ''}>Damaged</option>
							<option value="Lost" ${c.condition === 'Lost' ? 'selected' : ''}>Lost</option>
						</select>
					</td>
					<td>
						<select class="inline-select bind-input" data-field="charge_to">
							<option value="None" ${c.charge_to === 'None' ? 'selected' : ''}>None</option>
							<option value="Customer" ${c.charge_to === 'Customer' ? 'selected' : ''}>Customer</option>
							<option value="Supplier" ${c.charge_to === 'Supplier' ? 'selected' : ''}>Transporter</option>
						</select>
					</td>
					<td><input type="number" class="inline-input bind-input" data-field="amount" value="${c.amount}"></td>
					<td><input type="text" class="inline-input bind-input" data-field="remarks" placeholder="Notes..." value="${c.remarks}"></td>
					<td><button class="remove-btn"><i class="fa fa-times"></i></button></td>
				</tr>
			`;
		});

		tbl_body.html(rows);
		btn_submit.prop('disabled', false);
		update_balances();
		render_quick_picks();
	}

	// Two-way bindings for table inputs
	$(document).on('change keyup', '.bind-input', function () {
		let idx = $(this).closest('tr').data('idx');
		let field = $(this).data('field');
		let val = $(this).val();

		if (field === 'amount' || field === 'penalty' || field === 'heel_req' || field === 'heel_back') {
			val = parseFloat(val) || 0;
		}

		let c = state.scanned_containers[idx];
		c[field] = val;

		// Auto calculate amounts if condition or heel changes
		if (field === 'condition') {
			if (val === 'Damaged') {
				c.charge_to = 'Supplier';
				c.amount = (c.security_deposit || 0) * ((state.settings.damaged_container_charge || 0) / 100);
			} else if (val === 'Lost') {
				c.charge_to = 'Customer';
				c.amount = (c.security_deposit || 0) * ((state.settings.lost_container_charge || 0) / 100);
			} else {
				c.charge_to = 'None';
				c.amount = 0;
			}
			render_table();
			return;
		}

		if (field === 'heel_back') {
			let shortfall = Math.max(0, c.heel_req - c.heel_back);
			c.penalty = shortfall * (state.settings.penalty_rate_per_unit_short || 0);
			if (shortfall > 0) {
				if (c.condition === 'Good') c.charge_to = 'Customer';
			} else {
				if (c.condition === 'Good' && c.amount === 0) c.charge_to = 'None';
			}
			$(this).closest('tr').find('[data-field="penalty"]').val(c.penalty);
			$(this).closest('tr').find('[data-field="charge_to"]').val(c.charge_to);
		}

		update_balances();
	});

	// Remove row
	$(document).on('click', '.remove-btn', function () {
		let idx = $(this).closest('tr').data('idx');
		state.scanned_containers.splice(idx, 1);
		render_table();
	});

	// Calculators
	function update_balances() {
		$('#lbl-count').text(state.scanned_containers.length);

		let total_out = state.outstanding_containers.length;
		let rec = state.scanned_containers.length;
		let dmg_count = 0;
		let total_dmg_chg = 0;
		let total_pen = 0;

		state.scanned_containers.forEach(c => {
			if (c.condition === 'Damaged' || c.condition === 'Lost') dmg_count++;
			total_dmg_chg += parseFloat(c.amount || 0);
			total_pen += parseFloat(c.penalty || 0);
		});

		$('#bal-out').text(total_out);
		$('#bal-rec').text(rec);
		$('#bal-still').text(Math.max(0, total_out - rec));
		$('#bal-dmg').text(dmg_count);
		$('#bal-charges').text('₹' + total_dmg_chg);
		$('#bal-penalty').text('₹' + total_pen);
		$('#bal-total').text('₹' + (total_dmg_chg + total_pen));
	}

	// Camera Logic
	let html5QrCode = null;
	let last_scan_status_at = 0;

	function set_camera_status(message, status = '') {
		camera_status.text(message).removeClass('scanning warning success').addClass(status);
	}

	function stop_camera(message = 'Camera stopped. You can type the barcode or scan again.') {
		if (html5QrCode) {
			html5QrCode.stop().catch(() => {}).finally(() => {
				Promise.resolve(html5QrCode.clear()).catch(() => {});
				html5QrCode = null;
				$('#camera-reader').hide();
				$('#btn-camera').html('<i class="fa fa-camera"></i> Scan').removeClass('active');
				set_camera_status(message);
			});
		} else {
			$('#camera-reader').hide();
			$('#btn-camera').html('<i class="fa fa-camera"></i> Scan').removeClass('active');
			set_camera_status(message);
		}
	}

	btn_cam.on('click', function () {
		if (html5QrCode) {
			stop_camera();
			return;
		}

		if (typeof Html5Qrcode === 'undefined') {
			frappe.require("/assets/frappe/node_modules/html5-qrcode/html5-qrcode.min.js", function () {
				start_camera();
			});
		} else {
			start_camera();
		}
	});

	const beep = () => {
		try {
			let ctx = new (window.AudioContext || window.webkitAudioContext)();
			let osc = ctx.createOscillator();
			let gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = 880;
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start();
			gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
			setTimeout(() => osc.stop(), 100);
		} catch (e) { }
	};

	function start_camera() {
		$('#camera-reader').show();
		$('#camera-reader').html('<div class="scanner-laser" id="scanner-laser" style="display: block;"></div>');
		$('#btn-camera').html('<i class="fa fa-times"></i> Close').addClass('active');
		set_camera_status('Starting rear camera…', 'scanning');
		html5QrCode = new Html5Qrcode("camera-reader");

		window.last_scanned = "";
		window.last_scan_time = 0;

		let config = {
			fps: 20,
			qrbox: { width: 300, height: 100 },
			aspectRatio: 1.777778,
			disableFlip: true,
			experimentalFeatures: { useBarCodeDetectorIfSupported: true },
		};

		if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
			config.formatsToSupport = [
				Html5QrcodeSupportedFormats.CODE_128,
				Html5QrcodeSupportedFormats.CODE_39,
			];
		}

		html5QrCode.start(
			{ facingMode: "environment" },
			config,
			(decodedText, decodedResult) => {
				if (window.last_scanned === decodedText && (Date.now() - window.last_scan_time < 1500)) return;
				window.last_scanned = decodedText;
				window.last_scan_time = Date.now();
				beep();
				stop_camera('');
				add_container(decodedText);
			},
			() => {
				if (Date.now() - last_scan_status_at > 1200) {
					set_camera_status('Looking for a barcode. Keep it inside the white frame and reduce glare.', 'warning');
					last_scan_status_at = Date.now();
				}
			}
		).catch((err) => {
			set_camera_status(`Camera could not start: ${err}`, 'warning');
			stop_camera('Camera could not start. Check camera permission, then try again.');
		});

		set_camera_status('Looking for a Code 128 barcode. Keep it inside the white frame.', 'scanning');
	}

	// Fetch Recents
	function load_recents() {
		call_api("get_recent_reconciliations", {}, (r) => {
			if (r.message && r.message.length > 0) {
				let html = "";
				r.message.forEach(e => {
					let badges = `<span class="rr-badge">${e.containers_received || 0} good</span>`;
					if (e.damage_and_loss_charges > 0) {
						badges += ` <span class="rr-badge damaged">charges app.</span>`;
					}
					html += `
					<div class="recent-row">
						<div>
							<div class="rr-id">${e.name}</div>
							<div class="rr-meta">${e.posting_date} · ${e.customer} - ${e.transporter || '-'}</div>
						</div>
						<div>${badges}</div>
					</div>`;
				});
				$('#recent-list').html(html);
			} else {
				$('#recent-list').html('<div style="padding: 20px; font-size: 12px; color: #9ca3af; text-align: center;">No recent entries</div>');
			}
		});
	}

	// Submit
	function submit_entry() {
		if (!state.customer) {
			frappe.show_alert({ message: 'Select a customer before submitting.', indicator: 'orange' });
			return;
		}
		if (!state.scanned_containers.length) {
			frappe.show_alert({ message: 'Add at least one returned container before submitting.', indicator: 'orange' });
			return;
		}

		let payload = {
			customer: state.customer,
			transporter: state.transporter,
			containers: state.scanned_containers,
			total_charges: state.scanned_containers.reduce((a, c) => a + (c.amount || 0), 0),
			total_penalty: state.scanned_containers.reduce((a, c) => a + (c.penalty || 0), 0)
		};
		payload.total_recovery = payload.total_charges + payload.total_penalty;

		frappe.confirm('Are you sure you want to submit this Reconciliation?', () => {
			btn_submit.prop('disabled', true).text('Submitting...');

			call_api("submit_reconciliation", { payload: JSON.stringify(payload) }, (r) => {
				if (!r.exc) {
					frappe.show_alert({ message: `Reconciliation ${r.message} submitted successfully!`, indicator: 'green' });
					reset_all();
					load_recents();
				}
			}, () => {
				btn_submit.prop('disabled', false).html('Submit reconciliation');
			});
		});
	}

	function reset_all() {
		stop_camera();
		clear_received_containers();
		state.outstanding_containers = [];
		state.customer = null;
		state.transporter = null;

		customer_field.set_value('');
		transporter_field.set_value('');
		$('#lbl-cust-name').text('-');
		inp_barcode.val('');
		set_scanner_enabled(false);
		$('#quick-pick-list').html('<span style="font-size:11px; color:#9ca3af;">Select customer to view outstanding containers</span>');
	}

	function load_settings() {
		call_api("get_container_settings", {}, (r) => {
			if (r.message) {
				state.settings = r.message;
				let s = state.settings;
				let html = `
					<div><strong>Damaged</strong> — ${s.damaged_container_charge || 0}% of the container security deposit, charged to the transporter by default.</div>
					<div style="margin-top:8px;"><strong>Lost</strong> — ${s.lost_container_charge || 0}% of the security deposit, charged to the customer.</div>
					<div style="margin-top:8px;"><strong>Heel shortfall</strong> — ₹${s.penalty_rate_per_unit_short || 0} for each unit below the required heel.</div>
					<div style="margin-top:8px; color: #10b981;">Good returns move the asset back to the filling plant and free it for the next fill.</div>
					<div style="margin-top:8px; color: #ef4444;">Damaged containers land in the Repair Bay and are blocked from filling.</div>
				`;
				$('#settings-panel').html(html);
			}
		});
	}

	// Init
	load_recents();
	load_settings();
}
