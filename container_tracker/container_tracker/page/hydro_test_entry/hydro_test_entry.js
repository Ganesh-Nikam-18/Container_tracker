frappe.pages['hydro-test-entry'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Hydro Test Entry',
        single_column: true
    });
	
    $(wrapper).closest('.layout-main-section').css({
        'max-width': '100%',
        'padding': '0 30px'
    });

    page.set_title_sub('Periodic hydrostatic testing of containers — pass rolls the next test due date forward');

    // Add top buttons
    page.set_primary_action('Submit test', function () {
        submit_hydro_test();
    });

    page.set_secondary_action('Reset', function () {
        if (confirm("Are you sure you want to reset this test sheet?")) {
            reset_form();
        }
    });

    // Create the layout
    let layout = `
        <style>
            .stat-card { border-left: 3px solid var(--border-color, #d1d8dd); border-radius: 4px; padding: 8px 12px; background: var(--card-bg, #fff); box-shadow: 0 1px 2px rgba(0,0,0,0.05); height: 100%; display: flex; flex-direction: column; justify-content: center; }
            .stat-val { font-size: 18px; font-weight: 600; margin: 2px 0; color: var(--text-color, #1f272e); }
            .stat-title { font-size: 10px; font-weight: 600; letter-spacing: 0.3px; margin-bottom: 2px; }
            .stat-danger { border-left-color: var(--red-500, #e74c3c); }
            .stat-warning { border-left-color: var(--yellow-500, #f39c12); }
            .stat-info { border-left-color: var(--blue-500, #3498db); }
            .stat-success { border-left-color: var(--green-500, #2ecc71); }
            .ct-card { border: 1px solid var(--border-color, #d1d8dd); border-radius: 4px; background-color: var(--card-bg, #fff); padding: 10px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .ct-table th { font-weight: 600 !important; font-size: 10px; color: var(--text-muted, #6c757d); border-top: none !important; border-bottom: 1px solid var(--border-color, #d1d8dd) !important; white-space: nowrap; padding: 4px !important; }
            .ct-table td { vertical-align: middle !important; border-top: 1px solid var(--border-color, #edf2f7) !important; font-size: 11px; padding: 4px !important; color: var(--text-color); }
            .pending-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-color, #edf2f7); }
            .pending-item:last-child { border-bottom: none; }
            
            /* Frappe specific overrides to compress inputs */
            .ct-card .form-control { height: 24px; padding: 2px 6px; font-size: 11px; border-radius: 3px; background-color: var(--control-bg); color: var(--text-color); border: 1px solid var(--border-color); }
            .ct-card .form-group { margin-bottom: 8px; }
            .ct-card label { font-size: 10px; font-weight: 600; margin-bottom: 2px; color: var(--text-color); }
            .ct-card h6 { font-size: 12px; margin-top: 0; margin-bottom: 8px; font-weight: 600; color: var(--text-color); }
        </style>
        
        <div style="max-width: 100%; margin: 0; padding: 15px 30px;">
            <div class="row" style="margin-top: 10px; margin-bottom: 15px;">
                <div class="col-md-3">
                <div class="stat-card stat-danger">
                    <div class="text-muted text-uppercase stat-title">Overdue</div>
                    <div class="stat-val" id="stat-overdue">0</div>
                    <div class="text-muted" style="font-size: 10.5px;">Test date already passed</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card stat-warning">
                    <div class="text-muted text-uppercase stat-title">Due in 60 days</div>
                    <div class="stat-val" id="stat-due60">0</div>
                    <div class="text-muted" style="font-size: 10.5px;">Plan the next test batch</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card stat-info">
                    <div class="text-muted text-uppercase stat-title">On this test sheet</div>
                    <div class="stat-val" id="stat-current">0</div>
                    <div class="text-muted" style="font-size: 10.5px;"><span id="stat-pass">0</span> pass · <span id="stat-fail">0</span> fail</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card stat-success">
                    <div class="text-muted text-uppercase stat-title">Tests recorded</div>
                    <div class="stat-val" id="stat-recorded">0</div>
                    <div class="text-muted" style="font-size: 10.5px;">Submitted entries</div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-md-8">
                <!-- Section 1 -->
                <div class="ct-card">
                    <h6 style="margin-bottom: 12px; font-weight: 600;">1 · Test details</h6>
                    <div class="row">
                        <div class="col-md-3">
                            <div class="form-group">
                                <label class="text-muted">Test agency / bay</label>
                                <div id="ctrl-agency"></div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label class="text-muted">Inspector</label>
                                <input type="text" class="form-control" id="inp-inspector">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label class="text-muted">Certificate no.</label>
                                <input type="text" class="form-control" id="inp-cert">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label class="text-muted">Add container manually</label>
                                <div id="ctrl-manual-container"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Section 2 -->
                <div class="ct-card">
                    <h6 style="margin-bottom: 12px; font-weight: 600;">2 · Containers under test (<span id="test-grid-count">0</span>)</h6>
                    <div class="table-responsive" style="min-height: 120px;">
                        <table class="table ct-table" id="test-grid">
                            <thead>
                                <tr>
                                    <th>Container</th>
                                    <th>Type</th>
                                    <th width="90px">Test pressure</th>
                                    <th width="75px">Tare before</th>
                                    <th width="75px">Tare after</th>
                                    <th width="75px">Perm. exp %</th>
                                    <th width="90px">Result</th>
                                    <th width="110px">Next test due</th>
                                    <th>Remarks</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
                        <div id="test-grid-empty" class="text-center text-muted" style="padding: 15px; font-size: 12px;">
                            No containers added to this test sheet yet.
                        </div>
                    </div>
                </div>
                
                <!-- Recent Tests -->
                <div class="ct-card">
                    <h6 style="margin-bottom: 12px; font-weight: 600;">Recent test entries</h6>
                    <div class="table-responsive">
                        <table class="table ct-table" id="recent-grid">
                            <thead>
                                <tr>
                                    <th>Entry</th>
                                    <th>Date</th>
                                    <th>Agency</th>
                                    <th>Certificate</th>
                                    <th>Containers</th>
                                    <th>Result mix</th>
                                </tr>
                            </thead>
                            <tbody>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <!-- Pending Testing -->
                <div class="ct-card">
                    <h6 style="margin-bottom: 12px; font-weight: 600;">Pending testing (<span id="pending-count">0</span>)</h6>
                    <div class="form-group" style="display:flex; gap: 8px;">
                        <select class="form-control" id="sel-pending-type" style="flex: 1;">
                            <option>All container types</option>
                        </select>
                        <button class="btn btn-default btn-sm" id="btn-add-all" style="height: 28px; padding: 2px 8px; font-size: 12px;">Add all</button>
                    </div>
                    <div id="pending-list" style="max-height: 350px; overflow-y: auto;">
                        <!-- Dynamic Pending Items -->
                    </div>
                </div>
            </div>
        </div>
        </div>
    `;

    $(page.body).html(layout);

    // State
    let test_containers = []; // Array of { id, type, tare_before, interval }

    // Setup Controls
    let agency_ctrl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Link',
            options: 'Supplier',
            fieldname: 'test_agency',
            placeholder: 'Select Agency'
        },
        parent: page.body.find('#ctrl-agency'),
        only_input: true
    });
    agency_ctrl.make_input();

    let manual_ctrl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Link',
            options: 'Containers',
            fieldname: 'manual_container',
            placeholder: 'Scanner or keyboard',
            get_query: function () {
                return {
                    filters: {
                        docstatus: 1,
                        status: ['in', ['Available', 'Under Maintenance']]
                    }
                };
            },
            onchange: function () {
                let val = this.get_value();
                if (val) {
                    add_container_by_id(val);
                    this.set_value('');
                }
            }
        },
        parent: page.body.find('#ctrl-manual-container'),
        only_input: true
    });
    manual_ctrl.make_input();

    // Load Container Types for Filter
    frappe.call({
        method: 'frappe.client.get_list',
        args: { doctype: 'Container Types', fields: ['name'] },
        callback: function (r) {
            if (r.message) {
                r.message.forEach(t => {
                    $('#sel-pending-type').append(`<option>${t.name}</option>`);
                });
            }
        }
    });

    // Events
    $('#sel-pending-type').on('change', load_pending);

    // Core Functions
    function load_dashboard() {
        frappe.call({
            method: 'container_tracker.container_tracker.page.hydro_test_entry.hydro_test_entry.get_dashboard_data',
            callback: function (r) {
                if (r.message) {
                    $('#stat-overdue').text(r.message.overdue);
                    $('#stat-due60').text(r.message.due_in_60);

                    let rbody = '';
                    r.message.recent_tests.forEach(t => {
                        let badge = t.result_mix === 'Pass'
                            ? `<span class="badge badge-success" style="background-color: #e8f5e9; color: #2e7d32;">Pass</span>`
                            : `<span class="badge badge-danger" style="background-color: #ffebee; color: #c62828;">Fail</span>`;

                        rbody += `
                            <tr>
                                <td style="font-weight: 500;"><a href="/app/hydro-test/${t.name}">${t.name}</a></td>
                                <td>${frappe.datetime.str_to_user(t.creation.split(' ')[0])}</td>
                                <td>${t.test_agency_bay || '—'}</td>
                                <td>${t.certificate_no || '—'}</td>
                                <td>${t.containers_count}</td>
                                <td>${badge}</td>
                            </tr>
                        `;
                    });
                    $('#recent-grid tbody').html(rbody);
                    $('#stat-recorded').text(r.message.recent_tests.length);
                }
            }
        });
    }

    function load_pending() {
        let type_filter = $('#sel-pending-type').val();
        frappe.call({
            method: 'container_tracker.container_tracker.page.hydro_test_entry.hydro_test_entry.get_pending_containers',
            args: { container_type: type_filter },
            callback: function (r) {
                let pbody = '';
                let count = 0;
                if (r.message) {
                    r.message.forEach(c => {
                        // Skip if already in test_containers
                        if (test_containers.find(tc => tc.id === c.name)) return;

                        count++;
                        pbody += `
                            <div class="pending-item">
                                <div>
                                    <div style="font-weight: 600;">${c.name}</div>
                                    <div class="text-muted text-xs">${c.type} — due ${c.test_due}</div>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span class="badge ${c.due_class}" style="background: transparent; border: 1px solid currentColor;">${c.due_status}</span>
                                    <button class="btn btn-xs btn-default btn-add-pending" data-id="${c.name}">Add</button>
                                </div>
                            </div>
                        `;
                    });
                }
                $('#pending-list').html(pbody || '<div class="text-muted text-center" style="padding: 20px;">No pending containers</div>');
                $('#pending-count').text(count);

                $('.btn-add-pending').on('click', function () {
                    let id = $(this).data('id');
                    add_container_by_id(id);
                });
            }
        });
    }

    function add_container_by_id(id) {
        if (test_containers.find(tc => tc.id === id)) {
            frappe.show_alert({ message: `Container ${id} is already in the list`, indicator: 'orange' });
            return;
        }

        frappe.call({
            method: 'container_tracker.container_tracker.page.hydro_test_entry.hydro_test_entry.get_container_details',
            args: { container_id: id },
            callback: function (r) {
                if (r.message) {
                    test_containers.push({
                        id: r.message.name,
                        type: r.message.type,
                        tare_before: r.message.tare_weight || 0,
                        interval: parseInt(r.message.hydro_test_interval) || 60
                    });
                    render_test_grid();
                    load_pending(); // Refresh pending to remove it
                }
            }
        });
    }

    function remove_container(id) {
        test_containers = test_containers.filter(tc => tc.id !== id);
        render_test_grid();
        load_pending();
    }

    function render_test_grid() {
        let tbody = '';

        test_containers.forEach(tc => {
            // Calculate default next due (today + interval months)
            let next_due = frappe.datetime.add_months(frappe.datetime.get_today(), tc.interval);

            tbody += `
                <tr data-id="${tc.id}">
                    <td style="font-weight: 500;">${tc.id}</td>
                    <td class="text-muted text-sm">${tc.type}</td>
                    <td>
                        <div class="input-group">
                            <input type="number" class="form-control input-xs inp-pressure" value="250">
                            <span class="input-group-addon" style="padding: 2px 5px; font-size:10px;">bar</span>
                        </div>
                    </td>
                    <td><input type="number" class="form-control input-xs inp-tare-before" value="${tc.tare_before}" readonly></td>
                    <td><input type="number" class="form-control input-xs inp-tare-after" value="${tc.tare_before}"></td>
                    <td><input type="number" class="form-control input-xs inp-exp" value="0"></td>
                    <td>
                        <select class="form-control input-xs sel-result">
                            <option value="Pass">Pass</option>
                            <option value="Fail - Repair">Fail - Repair</option>
                            <option value="Fail - Condemn">Fail - Condemn</option>
                        </select>
                    </td>
                    <td><input type="date" class="form-control input-xs inp-next-due" value="${next_due}"></td>
                    <td><input type="text" class="form-control input-xs inp-remarks"></td>
                    <td class="text-right">
                        <button class="btn btn-xs btn-default text-danger btn-remove" data-id="${tc.id}">
                            <i class="fa fa-times"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        $('#test-grid tbody').html(tbody);

        if (test_containers.length > 0) {
            $('#test-grid-empty').hide();
            $('#test-grid').show();
        } else {
            $('#test-grid-empty').show();
            $('#test-grid').hide();
        }

        $('#test-grid-count').text(test_containers.length);

        // Handlers
        $('.btn-remove').on('click', function () {
            remove_container($(this).data('id'));
        });

        $('.sel-result').on('change', update_summary);

        update_summary();
    }

    function update_summary() {
        let pass = 0;
        let fail = 0;

        $('#test-grid tbody tr').each(function () {
            let res = $(this).find('.sel-result').val();
            if (res === 'Pass') pass++;
            else fail++;
        });

        $('#sum-containers, #stat-current').text(test_containers.length);
        $('#sum-pass, #stat-pass').text(pass);
        $('#sum-fail, #stat-fail').text(fail);
    }

    function submit_hydro_test() {
        let agency = agency_ctrl.get_value();
        let inspector = $('#inp-inspector').val();
        let cert = $('#inp-cert').val();

        if (!agency || !inspector || !cert) {
            frappe.throw("Please fill out Test Agency, Inspector, and Certificate No.");
            return;
        }

        if (test_containers.length === 0) {
            frappe.throw("Please add at least one container to the test sheet.");
            return;
        }

        let items = [];
        $('#test-grid tbody tr').each(function () {
            let tr = $(this);
            items.push({
                container: tr.data('id'),
                type: test_containers.find(t => t.id === tr.data('id')).type,
                test_pressure: tr.find('.inp-pressure').val(),
                tare_before: tr.find('.inp-tare-before').val(),
                tare_after: tr.find('.inp-tare-after').val(),
                perm_expansion: tr.find('.inp-exp').val(),
                result: tr.find('.sel-result').val(),
                next_test_due: tr.find('.inp-next-due').val(),
                remarks: tr.find('.inp-remarks').val()
            });
        });

        let payload = {
            test_agency_bay: agency,
            inspector: inspector,
            certificate_no: cert,
            items: items
        };

        page.btn_primary.prop('disabled', true).text('Submitting...');

        frappe.call({
            method: 'container_tracker.container_tracker.page.hydro_test_entry.hydro_test_entry.submit_hydro_test',
            args: { payload: JSON.stringify(payload) },
            callback: function (r) {
                page.btn_primary.prop('disabled', false).text('Submit test');
                if (!r.exc && r.message) {
                    frappe.show_alert({ message: `Test Entry ${r.message} submitted successfully`, indicator: 'green' });
                    reset_form();
                    load_dashboard();
                    load_pending();
                } else {
                    frappe.show_alert({ message: "Submission failed or cancelled. Check logs.", indicator: 'red' });
                }
            },
            error: function (r) {
                page.btn_primary.prop('disabled', false).text('Submit test');
                frappe.show_alert({ message: "An error occurred during submission.", indicator: 'red' });
            }
        });
    }

    function reset_form() {
        $('#inp-inspector').val('');
        $('#inp-cert').val('');
        agency_ctrl.set_value('');
        test_containers = [];
        render_test_grid();
    }

    // Init
    load_dashboard();
    load_pending();

    $('#btn-add-all').on('click', function () {
        $('.btn-add-pending').each(function () {
            $(this).click();
        });
    });
}
