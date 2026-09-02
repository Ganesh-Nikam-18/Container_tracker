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

	page.set_indicator("Receive containers back and settle the customer's container balance", 'blue');

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
	.recon-wrapper { max-width: 1100px; margin: 0 auto; padding: 15px; display: flex; gap: 20px; }
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
	.btn-icon { background: var(--control-bg, #f3f4f6); border: 1px solid var(--border-color, #d1d5db); padding: 0 12px; border-radius: 4px; color: var(--text-color, #4b5563); cursor: pointer; }
	.btn-icon:hover { background: var(--bg-light-gray, #e5e7eb); }
	.camera-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: none; align-items: center; justify-content: center; flex-direction: column; }
	.camera-box { background: #000; border-radius: 8px; width: 90%; max-width: 500px; height: 300px; overflow: hidden; position: relative; }
	.close-camera { margin-top: 20px; background: var(--control-bg, #fff); color: var(--text-color); border: none; padding: 8px 20px; border-radius: 4px; font-weight: 600; cursor: pointer; }
	
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
					<div class="f-col">
						<label class="f-label">Scan returned container</label>
						<div class="scanner-group">
							<input type="text" id="inp-barcode" class="f-input" placeholder="Camera or handheld scanner; Enter to add" disabled>
							<button class="btn-icon" id="btn-camera" disabled><i class="fa fa-qrcode"></i></button>
						</div>
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
			<div class="rc-card-body" style="padding: 0;">
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
			<div class="rc-card-body info-text">
				<div><strong>Damaged</strong> — 35% of the container security deposit, charged to the transporter by default.</div>
				<div style="margin-top:8px;"><strong>Lost</strong> — 100% of the security deposit, charged to the customer.</div>
				<div style="margin-top:8px;"><strong>Heel shortfall</strong> — ₹850 per unit short (tolerance 2) plus a flat re-cooling charge of ₹18,000.</div>
				<div style="margin-top:8px; color: #10b981;">Good returns move the asset back to the filling plant and free it for the next fill.</div>
				<div style="margin-top:8px; color: #ef4444;">Damaged containers land in the Repair Bay and are blocked from filling.</div>
			</div>
		</div>
	</div>
</div>

<!-- Camera Overlay -->
<div class="camera-overlay" id="cam-overlay">
	<div style="color: #fff; margin-bottom: 10px; font-size: 14px; font-weight: 600;">Scan Barcode</div>
	<div class="camera-box" id="camera-reader"></div>
	<button class="close-camera" id="btn-close-cam">Cancel</button>
</div>
	`);

	// Global State
	let state = {
		customer: null,
		transporter: null,
		outstanding_containers: [],
		scanned_containers: []
	};

	const tbl_body = $('#tbl-scanned');
	const inp_barcode = $('#inp-barcode');
	const btn_cam = $('#btn-camera');

	// Frappe Controls
	let customer_field = frappe.ui.form.make_control({
		parent: $('#cust-wrapper'),
		df: { fieldtype: 'Link', options: 'Customer', fieldname: 'customer' },
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
	const call_api = (method, args, callback) => {
		frappe.call({
			method: "container_tracker.container_tracker.page.new_reconciliation.new_reconciliation." + method,
			args: args,
			callback: callback
		});
	};

	// Bindings
	customer_field.$input.on('change', () => {
		state.customer = customer_field.get_value();
		$('#lbl-cust-name').text(state.customer || '-');

		if (!state.customer) {
			reset_all();
			return;
		}

		inp_barcode.prop('disabled', false);
		btn_cam.prop('disabled', false);

		call_api("get_reconciliation_data", { customer: state.customer }, (r) => {
			if (r.message) {
				state.outstanding_containers = r.message.containers || [];
				render_quick_picks();
				update_balances();
			}
		});
	});

	transporter_field.$input.on('change', () => {
		state.transporter = transporter_field.get_value();
	});

	// Add Container
	const add_container = (passed_barcode = null) => {
		let barcode = passed_barcode || inp_barcode.val().trim();
		if (!barcode) return;

		if (!state.customer) {
			frappe.show_alert({ message: "Please select a Customer first.", indicator: "orange" });
			return;
		}

		inp_barcode.val('').prop('disabled', true);

		call_api("validate_and_fetch_container", { barcode: barcode, customer: state.customer }, (r) => {
			if (!r.exc && r.message) {
				let c = r.message;

				if (c.error) {
					frappe.show_alert({ message: c.error, indicator: "orange" });
				} else if (state.scanned_containers.find(x => x.name === c.name)) {
					frappe.show_alert({ message: `Container ${c.name} already scanned.`, indicator: "orange" });
				} else {
					// Add defaults
					c.condition = "Good";
					c.charge_to = "None";
					c.amount = 0;
					c.penalty = 0;
					c.heel_req = 0;
					c.heel_back = 0;
					c.remarks = "";

					state.scanned_containers.push(c);
					render_table();
					frappe.show_alert({ message: `${c.name} received!`, indicator: 'green' });
				}
			}
			inp_barcode.prop('disabled', false).focus();
		});
	};

	inp_barcode.on('keypress', function (e) {
		if (e.which === 13) {
			e.preventDefault();
			add_container();
		}
	});

	// Quick Pick
	function render_quick_picks() {
		if (!state.outstanding_containers || state.outstanding_containers.length === 0) {
			$('#quick-pick-list').html('<span style="font-size: 11px; color: #9ca3af;">No outstanding containers found.</span>');
			return;
		}
		let html = "";
		state.outstanding_containers.forEach(c => {
			if (!state.scanned_containers.find(sc => sc.name === c.name)) {
				html += `<div class="ct-tag" onclick="$('#inp-barcode').val('${c.name}'); $('#inp-barcode').trigger({type: 'keypress', which: 13});">${c.name}</div>`;
			}
		});
		if (html === "") {
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
					<td><input type="number" class="inline-input bind-input" data-field="heel_req" value="${c.heel_req}"></td>
					<td><input type="number" class="inline-input bind-input" data-field="heel_back" value="${c.heel_back}"></td>
					<td><input type="number" class="inline-input bind-input" data-field="penalty" value="${c.penalty}"></td>
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
	$(document).on('change input', '.bind-input', function () {
		let idx = $(this).closest('tr').data('idx');
		let field = $(this).data('field');
		let val = $(this).val();

		if (field === 'amount' || field === 'penalty' || field === 'heel_req' || field === 'heel_back') {
			val = parseFloat(val) || 0;
		}

		state.scanned_containers[idx][field] = val;
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
	const overlay = $('#cam-overlay');

	function stop_camera() {
		if (html5QrCode) {
			html5QrCode.stop().then(() => {
				html5QrCode.clear();
				html5QrCode = null;
				overlay.css('display', 'none');
			});
		} else {
			overlay.css('display', 'none');
		}
	}

	btn_cam.on('click', function () {
		if (typeof Html5Qrcode === 'undefined') {
			frappe.require("/assets/frappe/node_modules/html5-qrcode/html5-qrcode.min.js", function () {
				start_camera();
			});
		} else {
			start_camera();
		}
	});

	$('#btn-close-cam').on('click', stop_camera);

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
		overlay.css('display', 'flex');
		html5QrCode = new Html5Qrcode("camera-reader");

		window.last_scanned = "";
		window.last_scan_time = 0;

		let config = { fps: 15, qrbox: { width: 300, height: 100 }, aspectRatio: 1.777778, disableFlip: false };
		if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
			config.formatsToSupport = [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39];
		}

		html5QrCode.start(
			{ facingMode: "environment" },
			config,
			(decodedText, decodedResult) => {
				if (window.last_scanned === decodedText && (Date.now() - window.last_scan_time < 1500)) return;
				window.last_scanned = decodedText;
				window.last_scan_time = Date.now();
				beep();
				stop_camera();
				add_container(decodedText);
			},
			(err) => { }
		).catch((err) => {
			frappe.msgprint("Camera error: " + err);
			stop_camera();
		});
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
				btn_submit.prop('disabled', false).html('Submit reconciliation');
			});
		});
	}

	function reset_all() {
		state.scanned_containers = [];
		state.outstanding_containers = [];
		state.customer = null;
		state.transporter = null;

		customer_field.set_value('');
		transporter_field.set_value('');
		$('#lbl-cust-name').text('-');
		inp_barcode.prop('disabled', true).val('');
		btn_cam.prop('disabled', true);

		render_table();
	}

	// Init
	load_recents();
}